/**
 * @jest-environment node
 */
import {
  normalizeForSearch,
  filterContainers,
  healthWeight,
  sortContainers,
  nextSortMode,
  FOLD_LETTERS,
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

describe('nextSortMode', () => {
  // The fixed cycle: 'state' → 'name' → 'created' → 'state'. 'state' is
  // both the default mode and the first entry of the cycle.
  test.each([
    ['state', 'name'],
    ['name', 'created'],
    ['created', 'state'],
  ])('mode %s advances to %s', (mode, expected) => {
    expect(nextSortMode(mode)).toBe(expected);
  });

  test("three applications from 'state' return to 'state'; a fourth lands one step past it", () => {
    expect(nextSortMode(nextSortMode(nextSortMode('state')))).toBe('state');
    // Four applications are NOT back at the start: they are on 'name'.
    // Asserting both pins the cycle length (three) instead of assuming it.
    expect(
      nextSortMode(nextSortMode(nextSortMode(nextSortMode('state'))))
    ).toBe('name');
  });

  test("a full lap from 'name' visits all three modes without repeats", () => {
    // ['name', next, next, next]: four values, only three distinct modes.
    const lap = ['name'];
    for (let step = 0; step < 3; step += 1) {
      lap.push(nextSortMode(lap[lap.length - 1]));
    }
    expect(lap).toEqual(['name', 'created', 'state', 'name']);
    expect(new Set(lap)).toEqual(new Set(['state', 'name', 'created']));
  });

  test.each([
    ['undefined', undefined],
    ['null', null],
    ['an empty string', ''],
    ['a bogus string', 'wobble'],
    ['a number', 42],
    ['NaN', Number.NaN],
    ['an object', { mode: 'created' }],
  ])(
    'an unusable input (%s) advances exactly like the default mode',
    (_label, value) => {
      let advanced;
      // Unusable input never throws.
      expect(() => {
        advanced = nextSortMode(value);
      }).not.toThrow();
      // Consistency with `sortContainers`: an unknown mode is treated as
      // the default 'state' and advanced from there, so both helpers
      // always agree on where an unusable mode starts.
      expect(advanced).toBe(nextSortMode('state'));
      expect(advanced).toBe('name');
    }
  );

  test('every value nextSortMode can return is a mode sortContainers accepts', () => {
    // A minimal list shaped for all three modes: id feeds the health
    // Map, name and createdAt feed the comparators.
    const sortable = [
      { id: 'x1', name: 'bravo', createdAt: 1700000020 },
      { id: 'x2', name: 'alpha', createdAt: 1700000010 },
    ];
    const health = new Map();
    const inputs = [
      'state',
      'name',
      'created',
      undefined,
      null,
      '',
      'wobble',
      42,
      Number.NaN,
      { mode: 'created' },
    ];

    const returned = new Set();
    for (const input of inputs) {
      expect(() => returned.add(nextSortMode(input))).not.toThrow();
    }
    // Only the three known modes may ever come back...
    expect([...returned].sort()).toEqual(['created', 'name', 'state']);
    // ...and `sortContainers` must sort a real list with each of them.
    for (const mode of returned) {
      let sorted;
      expect(() => {
        sorted = sortContainers(sortable, mode, { health });
      }).not.toThrow();
      expect(sorted).toHaveLength(sortable.length);
    }
  });
});

describe('normalizeForSearch folds letters that do not decompose', () => {
  // NFD (and NFKD) leave these letters intact — 'ø'.normalize('NFD') === 'ø' —
  // so the explicit FOLD_LETTERS table is the only thing folding them. The
  // table is imported from the implementation, not copied here: a letter
  // added later is covered by every assertion below without touching this
  // file.

  test.each(Object.entries(FOLD_LETTERS))(
    'folds the lowercase %s to %s',
    (letter, replacement) => {
      expect(normalizeForSearch(letter)).toBe(replacement);
    }
  );

  test.each(Object.entries(FOLD_LETTERS))(
    'folds the uppercase %s to %s',
    (letter, replacement) => {
      // toLowerCase() runs before the fold, so the uppercase shape reaches
      // it already lowercased and must land on the very same value.
      expect(normalizeForSearch(letter.toUpperCase())).toBe(replacement);
    }
  );

  test.each(Object.entries(FOLD_LETTERS))(
    'is idempotent on the table entry %s → %s',
    (letter, replacement) => {
      const fromLower = normalizeForSearch(letter);
      const fromUpper = normalizeForSearch(letter.toUpperCase());
      expect(normalizeForSearch(fromLower)).toBe(fromLower);
      expect(normalizeForSearch(fromUpper)).toBe(fromUpper);
      // The replacement itself must be a fixed point: a value that folds
      // again could reintroduce a foldable letter and break idempotency.
      expect(normalizeForSearch(replacement)).toBe(replacement);
    }
  );

  test('is idempotent over every table key, value and case at once', () => {
    const corpus = [
      Object.keys(FOLD_LETTERS).join(''),
      Object.keys(FOLD_LETTERS).join('').toUpperCase(),
      Object.values(FOLD_LETTERS).join(''),
      // Keys and values interleaved, so a fold sitting next to another
      // fold cannot compose into something new either.
      Object.entries(FOLD_LETTERS).flat().join(''),
    ];
    for (const text of corpus) {
      expect(normalizeForSearch(normalizeForSearch(text))).toBe(
        normalizeForSearch(text)
      );
    }
  });

  test('the table only holds lowercase letters that never decompose', () => {
    for (const letter of Object.keys(FOLD_LETTERS)) {
      // An uppercase key would be dead code: toLowerCase() runs first.
      expect(letter).toBe(letter.toLowerCase());
      // If NFD could decompose it, the diacritic strip would already fold
      // it and the table would be redundant for that letter.
      expect(letter.normalize('NFD')).toBe(letter);
      expect(letter.normalize('NFKD')).toBe(letter);
    }
  });

  test("Turkish 'İ' already folds through NFD; only dotless 'ı' is tabled", () => {
    // 'İ' decomposes to 'I' + combining dot, which the strip removes, so
    // listing it in FOLD_LETTERS would ship a dead entry — checked, not
    // assumed. Dotless 'ı' has no decomposition and does need the table.
    expect(normalizeForSearch('İ')).toBe('i');
    expect(normalizeForSearch('I')).toBe('i');
    expect(Object.keys(FOLD_LETTERS)).not.toContain('İ');
    expect(FOLD_LETTERS['ı']).toBe('i');
  });

  test('finds a container named brøtal-service when the user types o', () => {
    const containers = [
      { name: 'brøtal-service', image: 'nginx:1.25', state: 'exited' },
      { name: 'redis-cache', image: 'redis:7', state: 'exited' },
    ];
    // Nothing but the folded ø puts an 'o' in the first haystack: the raw
    // name has no literal 'o', and the second container has none in any
    // field, so it must stay out of the result.
    expect(containers[0].name).not.toContain('o');
    expect(filterContainers(containers, 'o')).toEqual([containers[0]]);
    // The query folds too, so typing the real letter finds it as well.
    expect(filterContainers(containers, 'ø')).toEqual([containers[0]]);
    // A word no fold can satisfy still excludes everything.
    expect(filterContainers(containers, 'brøtal zzzz')).toEqual([]);
  });

  test('the pre-existing accent folds still hold', () => {
    expect(normalizeForSearch('Caché')).toBe('cache');
    expect(normalizeForSearch('ÁÉÍÓÚÑ')).toBe('aeioun');
    expect(normalizeForSearch('CACHE')).toBe('cache');
  });
});

describe('healthWeight trusts only own properties', () => {
  // Jest runs every file of the suite in ONE process (`--runInBand`), so a
  // leaked Object.prototype key would break unrelated suites with a failure
  // that looks random. Every key this block writes is listed once here, so
  // the cleanup cannot drift away from the setup.
  const POLLUTED_KEYS = ['level', 'bogus'];

  /**
   * Removes every pollution key this block adds, whatever its value.
   * Deleting an absent key is a no-op, so it is safe to call twice.
   */
  function clearPollution() {
    for (const key of POLLUTED_KEYS) {
      delete Object.prototype[key];
    }
  }

  /**
   * Runs `body` with `entries` grafted onto Object.prototype and restores
   * the prototype in a `finally`: an assertion that throws mid-body cannot
   * leak the pollution into the next test, let alone the next file.
   *
   * @param {Object<string, unknown>} entries
   * @param {() => void} body
   */
  function withPollution(entries, body) {
    try {
      Object.assign(Object.prototype, entries);
      body();
    } finally {
      clearPollution();
    }
  }

  // The independent net: `finally` covers a thrown assertion inside a body,
  // this covers a body that never runs at all.
  afterEach(clearPollution);

  test('a verdict with no own level weighs as idle, even under pollution', () => {
    // The trap this closes: reading `verdict.level` walks the prototype
    // chain, so an empty verdict read Object.prototype.level and weighed 0.
    // That verdict is exactly the "not inspected yet" case the module
    // documents as idle, so broken containers would rise above it.
    expect(healthWeight({})).toBe(3);
    withPollution({ level: 'fail' }, () => {
      expect(healthWeight({})).toBe(3);
      expect(healthWeight(undefined)).toBe(3);
      expect(healthWeight(null)).toBe(3);
      expect(healthWeight({ code: 'running' })).toBe(3);
    });
  });

  test('a level inherited from a prototype is not the verdict own level', () => {
    // Two real ways an object carries a `level` it does not own: an explicit
    // prototype, and a class instance reading it off its prototype.
    const inherited = Object.create({ level: 'fail' });
    expect(Object.hasOwn(inherited, 'level')).toBe(false);
    expect(healthWeight(inherited)).toBe(3);

    class FakeVerdict {}
    FakeVerdict.prototype.level = 'fail';
    const instance = new FakeVerdict();
    expect(Object.hasOwn(instance, 'level')).toBe(false);
    expect(healthWeight(instance)).toBe(3);

    // Own property still wins over the inherited one it shadows.
    const shadowing = Object.create({ level: 'fail' });
    shadowing.level = 'warn';
    expect(healthWeight(shadowing)).toBe(1);
  });

  test('an own level still decides the weight while the prototype is polluted', () => {
    // The control: the own-property check must not over-block. Real verdicts
    // come from `verdict()` in src/helpers/health.js, an object literal whose
    // `level` is always own — so this fix must be invisible for them.
    withPollution({ level: 'fail' }, () => {
      expect(healthWeight(makeVerdict('crashed', 'fail'))).toBe(0);
      expect(healthWeight(makeVerdict('restarting', 'warn'))).toBe(1);
      expect(healthWeight(makeVerdict('running', 'ok'))).toBe(2);
      expect(healthWeight(makeVerdict('stopped', 'idle'))).toBe(3);
    });
  });

  test('the weight table ignores a numeric weight inherited from the prototype', () => {
    // The other trust point: the table answered from Object.prototype too,
    // and `typeof weight === 'number'` only catches an inherited FUNCTION
    // (toString, constructor). An inherited NUMBER passed the guard and made
    // an unknown level weigh 0 (fail) instead of falling back to idle.
    withPollution({ bogus: 0 }, () => {
      expect(healthWeight({ level: 'bogus' })).toBe(3);
      // Object.prototype's own members keep falling back to idle.
      expect(healthWeight({ level: 'toString' })).toBe(3);
      expect(healthWeight({ level: 'constructor' })).toBe(3);
      expect(healthWeight({ level: '__proto__' })).toBe(3);
    });
    // Any inherited number must be ignored, not just 0: a pollution value of
    // 1 would drop the unknown level among the healthy containers instead.
    for (const inherited of [1, 2, 3, -1, 0.5]) {
      withPollution({ bogus: inherited }, () => {
        expect(healthWeight({ level: 'bogus' })).toBe(3);
      });
    }
  });

  test("'state': an incomplete verdict keeps its place while the prototype is polluted", () => {
    // alpha HAS a health entry, but the entry carries no `level` of its own —
    // an incomplete health map (the shape TASK-9 §3.2 allows) reaches the
    // sort as a real object, not as undefined. That is the case the empty
    // verdict above describes at the user level: it must weigh as idle and
    // close the list, even though its name would sort it to the front.
    const containers = [
      { id: 'p1', name: 'alpha', createdAt: 1700000030 }, // verdict with no level
      { id: 'p2', name: 'bravo', createdAt: 1700000020 }, // warn
      { id: 'p3', name: 'zulu', createdAt: 1700000010 }, // fail
    ];
    const health = new Map([
      ['p1', { code: 'running', headline: '', facts: {} }],
      ['p2', makeVerdict('restarting', 'warn')],
      ['p3', makeVerdict('crashed', 'fail')],
    ]);
    const names = () =>
      sortContainers(containers, 'state', { health }).map(
        (container) => container.name
      );

    const expected = ['zulu', 'bravo', 'alpha'];
    expect(names()).toEqual(expected);
    // Under pollution alpha inherited 'fail' and outranked zulu, the only
    // container that is actually broken.
    withPollution({ level: 'fail' }, () => {
      expect(names()).toEqual(expected);
    });
    // A verdict that does not own `level` is idle polluted or not.
    withPollution({ level: 'warn' }, () => {
      expect(names()).toEqual(expected);
    });
  });

  test('leaves Object.prototype clean for every suite that runs next', () => {
    // Runs last in this block on purpose: if a cleanup were ever removed,
    // this is the test that says so instead of a stranger failing elsewhere.
    for (const key of POLLUTED_KEYS) {
      expect(Object.hasOwn(Object.prototype, key)).toBe(false);
    }
  });
});
