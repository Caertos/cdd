/**
 * @jest-environment node
 */
import {
  normalizeForSearch,
  filterContainers,
  healthWeight,
  sortContainers,
} from '../src/helpers/containerFilters.js';

/**
 * Container-shaped fixtures shared by the filterContainers tests.
 * Each row keeps name, image and state distinct, so a query term can be
 * pinned to the exact field a test claims to match.
 */
const CONTAINERS = [
  { name: 'mi-postgres', image: 'postgres:15', state: 'running' },
  { name: 'Caché', image: 'redis:7-alpine', state: 'exited' },
  { name: 'builder', image: 'node:20-alpine', state: 'exited' },
  { name: 'frontend', image: 'node:20', state: 'running' },
];

describe('normalizeForSearch', () => {
  test('lowercases the text', () => {
    expect(normalizeForSearch('CACHE')).toBe('cache');
  });

  test('strips accents', () => {
    expect(normalizeForSearch('caché')).toBe('cache');
    expect(normalizeForSearch('ÁÉÍÓÚÑ')).toBe('aeioun');
  });

  test.each([[''], [null], [undefined]])(
    'empty input %p → empty string',
    (input) => {
      expect(normalizeForSearch(input)).toBe('');
    }
  );

  test.each(['CACHE', 'caché', 'ÁÉÍÓÚÑ', 'Web Server', 'plain'])(
    'is idempotent: normalizing %s twice equals normalizing it once',
    (text) => {
      expect(normalizeForSearch(normalizeForSearch(text))).toBe(
        normalizeForSearch(text)
      );
    }
  );
});

describe('filterContainers', () => {
  test('matches by name', () => {
    // 'builder' appears only in the name of one container.
    expect(filterContainers(CONTAINERS, 'builder')).toEqual([CONTAINERS[2]]);
  });

  test('matches by image', () => {
    // 'redis' appears only in the image of one container.
    expect(filterContainers(CONTAINERS, 'redis')).toEqual([CONTAINERS[1]]);
  });

  test('matches by state', () => {
    // 'exited' finds the stopped containers.
    expect(filterContainers(CONTAINERS, 'exited')).toEqual([
      CONTAINERS[1],
      CONTAINERS[2],
    ]);
  });

  test('is case-insensitive', () => {
    expect(filterContainers(CONTAINERS, 'BUILDER')).toEqual([CONTAINERS[2]]);
    expect(filterContainers(CONTAINERS, 'Node')).toEqual([
      CONTAINERS[2],
      CONTAINERS[3],
    ]);
  });

  test('is accent-insensitive: query "cache" finds the container named "Caché"', () => {
    expect(filterContainers(CONTAINERS, 'cache')).toEqual([CONTAINERS[1]]);
  });

  test('multiple words: AND across words, OR across fields', () => {
    // 'node' lives in the image, 'exit' in the state: two different fields
    // of the same container satisfy the two words.
    expect(filterContainers(CONTAINERS, 'node exit')).toEqual([CONTAINERS[2]]);
  });

  test('a container matching only one word of the query is excluded', () => {
    const result = filterContainers(CONTAINERS, 'node exit');
    // frontend has 'node' but not 'exit'; Caché has 'exit' but not 'node'.
    expect(result).not.toContain(CONTAINERS[3]);
    expect(result).not.toContain(CONTAINERS[1]);
    expect(result).toHaveLength(1);
  });

  test('a word that matches no container excludes everything', () => {
    expect(filterContainers(CONTAINERS, 'node zzzz')).toEqual([]);
  });

  test('empty query returns all containers', () => {
    expect(filterContainers(CONTAINERS, '')).toEqual(CONTAINERS);
  });

  test('whitespace-only query returns all containers', () => {
    expect(filterContainers(CONTAINERS, '   ')).toEqual(CONTAINERS);
  });

  test('does not mutate the input array and returns a new reference', () => {
    const input = [...CONTAINERS];
    const snapshot = JSON.parse(JSON.stringify(input));

    const filtered = filterContainers(input, 'node');
    expect(filtered).not.toBe(input);
    expect(filtered).toHaveLength(2);
    expect(input).toEqual(snapshot);

    // The empty-query shortcut copies the array too, it never returns it as-is.
    const all = filterContainers(input, '');
    expect(all).not.toBe(input);
    expect(all).toEqual(snapshot);
    expect(input).toEqual(snapshot);
  });
});

/**
 * Builds a verdict with the exact shape `evaluateHealth` produces (see
 * `src/helpers/health.js`): `{ code, level, headline, facts }`. The sort
 * only reads `level`, but the fixtures stay honest about the real object.
 *
 * @param {string} code
 * @param {string} level
 * @returns {Object}
 */
const makeVerdict = (code, level) => ({
  code,
  level,
  headline: `${code} (${level})`,
  facts: {
    exitCode: null,
    uptimeMs: null,
    restartCount: 0,
    oomKilled: false,
    healthStatus: null,
  },
});

/**
 * Deterministic Fisher–Yates shuffle with a fixed seed, so the
 * "shuffled input gives the same output" tests reproduce run to run.
 *
 * @param {Array} list
 * @returns {Array} a new array holding the same elements, permuted
 */
function shuffle(list) {
  const out = [...list];
  let seed = 42;
  for (let i = out.length - 1; i > 0; i -= 1) {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    const j = seed % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

describe('healthWeight', () => {
  // Real levels: fail → warn → ok → idle, lower sorts first.
  test.each([
    ['fail', 0],
    ['warn', 1],
    ['ok', 2],
    ['idle', 3],
  ])('weighs the level %s as %i', (level, weight) => {
    expect(healthWeight(makeVerdict('running', level))).toBe(weight);
  });

  test('lower weight sorts first: fail, warn, ok, idle', () => {
    // The levels arrive in reverse order: only the weights may reorder them.
    const levels = ['idle', 'ok', 'warn', 'fail'];
    const sorted = [...levels].sort(
      (a, b) =>
        healthWeight(makeVerdict('running', a)) -
        healthWeight(makeVerdict('running', b))
    );
    expect(sorted).toEqual(['fail', 'warn', 'ok', 'idle']);
  });

  test.each([[undefined], [null], [{}]])(
    'an absent verdict (%p) weighs as idle',
    (verdict) => {
      expect(healthWeight(verdict)).toBe(3);
    }
  );

  test.each(['nonsense', 'FAIL', 'running'])(
    'an unknown level %s falls back to the idle weight',
    (level) => {
      // 'running' is a `code`, never a `level`; 'FAIL' is the wrong case.
      expect(healthWeight(makeVerdict('unknown', level))).toBe(3);
    }
  );

  test.each(['__proto__', 'constructor', 'toString'])(
    'the hostile level %s never leaks an Object.prototype member as a weight',
    (level) => {
      // A naive `HEALTH_WEIGHTS[level] ?? idle` would return Object.prototype,
      // Object or a function here: truthy, but useless as a sort weight.
      const weight = healthWeight(makeVerdict('unknown', level));
      expect(weight).toBe(3);
      expect(Number.isFinite(weight)).toBe(true);
    }
  );

  test('never returns NaN, whatever the verdict contains', () => {
    const inputs = [
      undefined,
      null,
      {},
      makeVerdict('running', 'ok'),
      makeVerdict('crashed', 'fail'),
      makeVerdict('unknown', 'nonsense'),
      makeVerdict('unknown', '__proto__'),
      makeVerdict('unknown', 'constructor'),
      makeVerdict('unknown', 'toString'),
      { level: NaN },
      { level: 42 },
      'not a verdict',
    ];
    for (const input of inputs) {
      // A NaN weight would silently corrupt Array.prototype.sort.
      expect(Number.isFinite(healthWeight(input))).toBe(true);
    }
  });

  test('reads level, not code', () => {
    // Same level, different code → the same weight.
    expect(healthWeight(makeVerdict('crashed', 'fail'))).toBe(
      healthWeight(makeVerdict('crash-loop', 'fail'))
    );
    expect(healthWeight(makeVerdict('crashed', 'fail'))).toBe(0);
    // A code that spells out a level must not override the real level.
    expect(healthWeight(makeVerdict('fail', 'ok'))).toBe(2);
  });
});

describe('sortContainers', () => {
  /**
   * State-sort fixture: ids feed the health Map, names decide the order
   * inside each weight level. omega has NO entry in the Map — it has not
   * been inspected yet — so it belongs to the idle group.
   * Expected order: delta, bravo, alpha, echo, charlie, omega.
   */
  const STATE_CONTAINERS = [
    { id: 'c1', name: 'omega', createdAt: 1700000060 }, // no verdict at all
    { id: 'c2', name: 'alpha', createdAt: 1700000010 }, // ok
    { id: 'c3', name: 'delta', createdAt: 1700000040 }, // fail
    { id: 'c4', name: 'bravo', createdAt: 1700000020 }, // warn
    { id: 'c5', name: 'charlie', createdAt: 1700000050 }, // idle verdict
    { id: 'c6', name: 'echo', createdAt: 1700000030 }, // ok
  ];
  const STATE_HEALTH = new Map([
    ['c2', makeVerdict('running', 'ok')],
    ['c3', makeVerdict('crashed', 'fail')],
    ['c4', makeVerdict('restarting', 'warn')],
    ['c5', makeVerdict('stopped', 'idle')],
    ['c6', makeVerdict('running', 'ok')],
  ]);

  /**
   * Name-sort fixture: names that differ only by case, accents or id, so
   * the alphabetical comparison and both tie-breaks (raw text, then id)
   * stay visible. Expected order: n2, n5, n4, n3, n6, n1.
   */
  const NAME_CONTAINERS = [
    { id: 'n1', name: 'web' },
    { id: 'n2', name: 'API' },
    { id: 'n3', name: 'cache' },
    { id: 'n4', name: 'Caché' },
    { id: 'n5', name: 'builder' },
    { id: 'n6', name: 'cache' }, // exact twin of n3: only the id differs
  ];

  /**
   * Created-sort fixture: three usable Unix-epoch-second timestamps
   * (newest first), then every flavour of unusable timestamp, which must
   * sink to the end instead of floating to the top.
   * Expected order: newest, middle, oldest, then the bad-* names by name.
   */
  const CREATED_CONTAINERS = [
    { id: 't1', name: 'newest', createdAt: 1700000030 },
    { id: 't2', name: 'middle', createdAt: 1700000020 },
    { id: 't3', name: 'oldest', createdAt: 1700000010 },
    { id: 't4', name: 'bad-missing' }, // createdAt absent
    { id: 't5', name: 'bad-nan', createdAt: Number.NaN },
    { id: 't6', name: 'bad-string', createdAt: '2024-01-01' }, // not a number
    { id: 't7', name: 'bad-zero', createdAt: 0 }, // Docker zero time
    { id: 't8', name: 'bad-negative', createdAt: -5 }, // Docker zero time
  ];

  test("'state' (default): trouble first, alphabetical inside each level", () => {
    const sorted = sortContainers(STATE_CONTAINERS, 'state', {
      health: STATE_HEALTH,
    });
    expect(sorted.map((container) => container.name)).toEqual([
      'delta', // fail
      'bravo', // warn
      'alpha', // ok
      'echo', // ok — alphabetical after alpha
      'charlie', // idle verdict
      'omega', // no verdict: the idle group too
    ]);
  });

  test("'state': a container with no health entry lands in the idle group", () => {
    const sorted = sortContainers(STATE_CONTAINERS, 'state', {
      health: STATE_HEALTH,
    });
    const names = sorted.map((container) => container.name);
    // omega has no verdict: it never rises to the top of the list...
    expect(names[0]).not.toBe('omega');
    // ...nor above a genuinely ok container...
    expect(names.indexOf('omega')).toBeGreaterThan(names.indexOf('alpha'));
    expect(names.indexOf('omega')).toBeGreaterThan(names.indexOf('echo'));
    // ...it simply closes the idle group.
    expect(names.indexOf('omega')).toBe(names.length - 1);
  });

  test.each([[undefined], [null], ['wobble'], [42]])(
    'an omitted or unknown mode %p falls back to the default state sort',
    (mode) => {
      const fallback = sortContainers(STATE_CONTAINERS, mode, {
        health: STATE_HEALTH,
      });
      const explicit = sortContainers(STATE_CONTAINERS, 'state', {
        health: STATE_HEALTH,
      });
      expect(fallback).toEqual(explicit);
    }
  );

  test("'name': alphabetical, case- and accent-insensitive, id breaks ties", () => {
    const sorted = sortContainers(NAME_CONTAINERS, 'name', {
      health: STATE_HEALTH,
    });
    expect(sorted.map((container) => container.id)).toEqual([
      'n2', // API
      'n5', // builder
      'n4', // Caché → 'cache'; the raw text sorts before the lowercase twin
      'n3', // cache
      'n6', // cache twin: only the id decides
      'n1', // web
    ]);
  });

  test("'created': newest first, unusable timestamps last", () => {
    const sorted = sortContainers(CREATED_CONTAINERS, 'created', {
      health: STATE_HEALTH,
    });
    expect(sorted.map((container) => container.name)).toEqual([
      'newest', // 1700000030
      'middle', // 1700000020
      'oldest', // 1700000010
      // Missing, NaN, non-numeric and <= 0 timestamps sink to the end,
      // alphabetical among themselves:
      'bad-missing',
      'bad-nan',
      'bad-negative',
      'bad-string',
      'bad-zero',
    ]);
  });

  test.each(['state', 'name', 'created'])(
    'mode %s: does not mutate the input or the health map, returns a new array',
    (mode) => {
      const input = [...STATE_CONTAINERS];
      const inputSnapshot = JSON.parse(JSON.stringify(input));
      const healthSnapshot = JSON.parse(JSON.stringify([...STATE_HEALTH]));

      const sorted = sortContainers(input, mode, { health: STATE_HEALTH });

      expect(sorted).not.toBe(input);
      expect(input).toEqual(inputSnapshot);
      expect(STATE_HEALTH.size).toBe(healthSnapshot.length);
      expect(JSON.parse(JSON.stringify([...STATE_HEALTH]))).toEqual(
        healthSnapshot
      );
    }
  );

  test.each(['state', 'name', 'created'])(
    'mode %s: a non-array of containers → []',
    (mode) => {
      for (const input of [null, undefined, 'containers', 7, { id: 'c1' }]) {
        expect(sortContainers(input, mode, { health: STATE_HEALTH })).toEqual(
          []
        );
      }
    }
  );

  test.each([
    ['ctx omitted', undefined],
    ['ctx without health', {}],
    ['health null', { health: null }],
    ['health not a Map', { health: 'not-a-map' }],
  ])(
    '%s: never throws in any mode and every container weighs as idle',
    (_label, ctx) => {
      for (const mode of ['state', 'name', 'created']) {
        let sorted;
        expect(() => {
          sorted = sortContainers(STATE_CONTAINERS, mode, ctx);
        }).not.toThrow();
        expect(sorted).toHaveLength(STATE_CONTAINERS.length);
      }
      // Without a usable health map every container weighs idle, so the
      // state sort degrades to plain alphabetical order.
      const names = sortContainers(STATE_CONTAINERS, 'state', ctx).map(
        (container) => container.name
      );
      expect(names).toEqual([
        'alpha',
        'bravo',
        'charlie',
        'delta',
        'echo',
        'omega',
      ]);
    }
  );

  test.each([
    ['state', STATE_CONTAINERS],
    ['name', NAME_CONTAINERS],
    ['created', CREATED_CONTAINERS],
  ])(
    'mode %s: a shuffled input yields the same output as the original',
    (mode, input) => {
      const ctx = { health: STATE_HEALTH };
      const expected = sortContainers(input, mode, ctx);
      const shuffled = shuffle(input);
      // The shuffle must really permute, otherwise this proves nothing.
      expect(shuffled).not.toEqual(input);
      expect(sortContainers(shuffled, mode, ctx)).toEqual(expected);
    }
  );
});
