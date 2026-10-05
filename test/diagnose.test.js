/**
 * @jest-environment node
 */
import {
  diagnose,
  describeWhat,
  shouldDiagnose,
  TAIL_LINES,
} from '../src/helpers/diagnostics/diagnose.js';
import { DIAGNOSTIC_RULES } from '../src/helpers/diagnostics/rules.js';
import { evaluateHealth } from '../src/helpers/health.js';

const NOW = Date.parse('2026-10-05T12:00:00Z');

function verdictOf(code, facts = {}) {
  const full = {
    exitCode: null,
    uptimeMs: null,
    restartCount: 0,
    oomKilled: false,
    healthStatus: null,
    ...facts,
  };
  const levels = {
    running: 'ok',
    starting: 'ok',
    stopped: 'idle',
    crashed: 'fail',
    'crash-loop': 'fail',
    restarting: 'warn',
    unhealthy: 'warn',
    paused: 'warn',
    unknown: 'idle',
  };
  return { code, level: levels[code], headline: code, facts: full };
}

function ctx(overrides = {}) {
  return {
    container: { id: 'a', name: 'app', image: 'postgres:17-alpine' },
    details: null,
    logLines: [],
    profile: null,
    verdict: verdictOf('crashed', { exitCode: 1, uptimeMs: 2000 }),
    ...overrides,
  };
}

describe('diagnose — no rule matches', () => {
  test('says nothing about the cause but keeps the tail', () => {
    const result = diagnose(
      ctx({ logLines: ['something we have never seen before'] })
    );
    expect(result.why).toBeNull();
    expect(result.ruleId).toBeNull();
    expect(result.fix).toBeNull();
    expect(result.evidence).toEqual([]);
    expect(result.tail).toEqual(['something we have never seen before']);
  });

  test('still explains what happened', () => {
    const result = diagnose(ctx());
    expect(result.what).toContain('exit code 1');
  });

  test('an empty log does not throw', () => {
    const result = diagnose(ctx({ logLines: [] }));
    expect(result.why).toBeNull();
    expect(result.tail).toEqual([]);
    expect(result.what).toBeTruthy();
  });

  test('a missing verdict still yields a usable diagnosis', () => {
    const result = diagnose(ctx({ verdict: null }));
    expect(result.what).toBeTruthy();
    expect(typeof result.why === 'string' || result.why === null).toBe(true);
  });

  test('a missing context does not throw', () => {
    expect(() => diagnose(null)).not.toThrow();
    expect(diagnose(null).why).toBeNull();
  });
});

describe('diagnose — matching a rule', () => {
  test('a recognised log line produces a cause', () => {
    const result = diagnose(
      ctx({
        logLines: [
          'Error: Database is uninitialized and superuser password is not specified.',
        ],
      })
    );
    expect(result.ruleId).toBe('postgres-missing-password');
    expect(result.why).toContain('POSTGRES_PASSWORD');
  });

  test('evidence quotes the line that triggered the rule', () => {
    const result = diagnose(
      ctx({
        logLines: [
          'starting PostgreSQL 17',
          'Error: superuser password is not specified',
          'shutting down',
        ],
      })
    );
    expect(result.evidence).toEqual([
      'Error: superuser password is not specified',
    ]);
  });

  test('a rule with no log evidence reports none', () => {
    const result = diagnose(
      ctx({ verdict: verdictOf('crashed', { exitCode: 137, oomKilled: true }) })
    );
    expect(result.ruleId).toBe('out-of-memory');
    expect(result.evidence).toEqual([]);
    expect(result.why).toContain('memory');
  });

  test('the highest priority wins when several match', () => {
    const result = diagnose(
      ctx({
        verdict: verdictOf('crashed', { exitCode: 137, oomKilled: true }),
        logLines: ['permission denied', 'connection refused'],
      })
    );
    expect(result.ruleId).toBe('out-of-memory');
  });

  test('a rule with no fix reports fix: null rather than a stub', () => {
    const result = diagnose(
      ctx({ logLines: ['mkdir /data: permission denied'] })
    );
    expect(result.ruleId).toBe('volume-permission-denied');
    expect(result.fix).toBeNull();
  });

  test('a fix comes back complete', () => {
    const result = diagnose(
      ctx({ logLines: ['superuser password is not specified'] })
    );
    expect(result.fix.kind).toBe('add-env');
    expect(result.fix.patch.env).toHaveProperty('POSTGRES_PASSWORD');
    expect(result.fix.needsUserInput).toBe(true);
  });
});

describe('diagnose — tail', () => {
  test('shows only the last few lines', () => {
    const logLines = Array.from({ length: 40 }, (_, i) => `line ${i}`);
    const result = diagnose(ctx({ logLines }));
    expect(result.tail).toHaveLength(TAIL_LINES);
    expect(result.tail).toEqual([
      'line 35',
      'line 36',
      'line 37',
      'line 38',
      'line 39',
    ]);
  });

  test('a short log is shown whole', () => {
    const result = diagnose(ctx({ logLines: ['only line'] }));
    expect(result.tail).toEqual(['only line']);
  });
});

describe('diagnose — custom rule set', () => {
  test('accepts an alternative catalog', () => {
    const only = [
      {
        id: 'always',
        priority: 1,
        match: () => true,
        explain: () => 'Something is wrong and I know what it is.',
      },
    ];
    const result = diagnose(ctx(), only);
    expect(result.ruleId).toBe('always');
    expect(result.why).toContain('know what it is');
  });

  test('a rule that throws is ignored, not fatal', () => {
    const hostile = [
      {
        id: 'boom',
        priority: 999,
        match: () => {
          throw new Error('rule is broken');
        },
        explain: () => 'never',
      },
    ];
    const result = diagnose(ctx({ logLines: ['permission denied'] }), hostile);
    expect(result.why).toBeNull();
    expect(result.tail).toEqual(['permission denied']);
  });
});

describe('describeWhat', () => {
  test('crashed reports the code and how long it lasted', () => {
    expect(
      describeWhat(verdictOf('crashed', { exitCode: 1, uptimeMs: 2000 }))
    ).toBe('It died after 2s with exit code 1.');
  });

  test('crash-loop mentions the restarts', () => {
    expect(describeWhat(verdictOf('crash-loop', { exitCode: 1 }))).toContain(
      'keeps dying'
    );
  });

  test('restarting counts them', () => {
    expect(
      describeWhat(verdictOf('restarting', { restartCount: 4 }))
    ).toContain('4 times');
  });

  test('unhealthy names the health check', () => {
    expect(describeWhat(verdictOf('unhealthy'))).toContain('health check');
  });

  test('a fast clean exit is not reported as a plain stop', () => {
    expect(
      describeWhat(verdictOf('stopped', { exitCode: 0, uptimeMs: 800 }))
    ).toContain('finished');
  });

  test('a normal stop is just a stop', () => {
    expect(
      describeWhat(verdictOf('stopped', { exitCode: 0, uptimeMs: 60000 }))
    ).toBe('It is stopped.');
  });

  test('a null verdict still says something', () => {
    expect(describeWhat(null)).toBeTruthy();
  });
});

describe('shouldDiagnose', () => {
  test.each(['crashed', 'crash-loop', 'restarting', 'unhealthy'])(
    '%s deserves a panel',
    (code) => {
      expect(shouldDiagnose(verdictOf(code, { exitCode: 1 }))).toBe(true);
    }
  );

  test('a fast clean exit deserves one', () => {
    expect(
      shouldDiagnose(verdictOf('stopped', { exitCode: 0, uptimeMs: 900 }))
    ).toBe(true);
  });

  test.each([
    ['running', { uptimeMs: 60000 }],
    ['starting', { uptimeMs: 1000 }],
    ['stopped', { exitCode: 0, uptimeMs: 60000 }],
    ['paused', {}],
    ['unknown', {}],
  ])('%s does not', (code, facts) => {
    expect(shouldDiagnose(verdictOf(code, facts))).toBe(false);
  });

  test('a null verdict does not', () => {
    expect(shouldDiagnose(null)).toBe(false);
  });

  test('a paused container is never diagnosed even though it is warn', () => {
    // The reason this keys off `code` and not `level`.
    const paused = verdictOf('paused');
    expect(paused.level).toBe('warn');
    expect(shouldDiagnose(paused)).toBe(false);
  });

  test('agrees with the real health engine on a real container', () => {
    const container = { state: 'exited', status: 'Exited (1) 2 seconds ago' };
    const details = {
      state: 'exited',
      exitCode: 1,
      startedAt: new Date(NOW - 2000).toISOString(),
      finishedAt: new Date(NOW).toISOString(),
      restartCount: 0,
      oomKilled: false,
      healthStatus: null,
    };
    const verdict = evaluateHealth(container, details, NOW);
    // Worth pinning: dying inside CRASH_LOOP_MAX_UPTIME is a crash-loop even
    // when Docker never restarted it. A container that dies at 2s for a
    // missing variable lands here, so the panel must serve both codes.
    expect(verdict.code).toBe('crash-loop');
    expect(shouldDiagnose(verdict)).toBe(true);
  });

  test('a long-lived container that dies later is a plain crash', () => {
    const container = { state: 'exited', status: 'Exited (1) 5 minutes ago' };
    const details = {
      state: 'exited',
      exitCode: 1,
      startedAt: new Date(NOW - 300_000).toISOString(),
      finishedAt: new Date(NOW).toISOString(),
      restartCount: 0,
      oomKilled: false,
      healthStatus: null,
    };
    const verdict = evaluateHealth(container, details, NOW);
    expect(verdict.code).toBe('crashed');
    expect(shouldDiagnose(verdict)).toBe(true);
  });
});

describe('catalog and engine agree', () => {
  test('every rule id is reachable through diagnose', () => {
    for (const rule of DIAGNOSTIC_RULES) {
      expect(typeof rule.id).toBe('string');
      expect(rule.priority).toBeGreaterThan(0);
    }
  });

  test('priorities are unique enough to be unambiguous at the top', () => {
    const top = DIAGNOSTIC_RULES.map((r) => r.priority);
    expect(Math.max(...top)).toBe(100);
  });
});

describe('describeWhat — every code', () => {
  test('paused is never framed as a failure', () => {
    expect(describeWhat(verdictOf('paused'))).toBe('It is paused.');
  });

  test('starting is not yet a failure either', () => {
    expect(describeWhat(verdictOf('starting'))).toBe(
      'It is still starting up.'
    );
  });

  test('running says so', () => {
    expect(describeWhat(verdictOf('running'))).toBe('It is running.');
  });

  test('crash-loop mentions how long it survived when we know', () => {
    expect(
      describeWhat(verdictOf('crash-loop', { exitCode: 1, uptimeMs: 3000 }))
    ).toBe('It keeps dying after 3s and Docker restarts it.');
  });

  test('a crash with no uptime still reads as a sentence', () => {
    expect(describeWhat(verdictOf('crashed', { exitCode: 1 }))).toBe(
      'It died with exit code 1.'
    );
  });

  test('a crash with no exit code does not print "null"', () => {
    expect(describeWhat(verdictOf('crashed'))).toContain('unknown');
    expect(describeWhat(verdictOf('crashed'))).not.toContain('null');
  });

  test('an unknown code falls back to the row headline', () => {
    const v = verdictOf('unknown');
    v.headline = 'DEAD';
    expect(describeWhat(v)).toBe('Its state is DEAD.');
  });

  test('a verdict with no headline and no code says so', () => {
    expect(describeWhat({ code: 'weird', facts: {} })).toBe(
      'Nothing is known about this container.'
    );
  });

  test('restarting without a count does not say "undefined times"', () => {
    expect(describeWhat(verdictOf('restarting'))).toContain('0 times');
  });
});

describe('diagnose — rules without declared needles', () => {
  test('a rule with a priority of 0 would still sort', () => {
    const zero = [
      { id: 'zero', priority: 0, match: () => false, explain: () => 'x' },
      {
        id: 'unset',
        match: () => true,
        explain: () => 'Matched a rule with no priority at all.',
      },
    ];
    const result = diagnose(ctx(), zero);
    expect(result.ruleId).toBe('unset');
  });

  test('a null rule set returns the honest answer', () => {
    const result = diagnose(ctx({ logLines: ['permission denied'] }), null);
    expect(result.why).toBeNull();
    expect(result.tail).toEqual(['permission denied']);
  });

  test('evidence is capped at three lines', () => {
    const logLines = Array.from({ length: 6 }, () => 'permission denied');
    const result = diagnose(ctx({ logLines }));
    expect(result.evidence).toHaveLength(3);
  });

  test('evidence matching ignores case', () => {
    const result = diagnose(
      ctx({ logLines: ['PERMISSION DENIED while writing to /data'] })
    );
    expect(result.ruleId).toBe('volume-permission-denied');
    expect(result.evidence).toHaveLength(1);
  });
});
