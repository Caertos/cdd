/**
 * @jest-environment node
 */
import { DIAGNOSTIC_RULES } from '../src/helpers/diagnostics/rules.js';
import { IMAGE_PROFILES } from '../src/helpers/constants.js';
import { evaluateHealth } from '../src/helpers/health.js';

const NOW = Date.parse('2026-10-05T12:00:00Z');

/**
 * Build a diagnostic context with sensible defaults. Each test overrides only
 * what it is actually about.
 */
function ctx(overrides = {}) {
  const {
    container = { id: 'a', name: 'app', image: 'postgres:17-alpine' },
    details = null,
    logLines = [],
    profile = IMAGE_PROFILES[container.image.split(':')[0]] ?? null,
    verdict = evaluateHealth(container, details, NOW),
  } = overrides;
  return { container, details, logLines, profile, verdict };
}

/** Details for a container that ran and exited. */
function exited({ exitCode = 1, uptimeMs = 2000 } = {}) {
  return {
    state: 'exited',
    exitCode,
    startedAt: new Date(NOW - uptimeMs).toISOString(),
    finishedAt: new Date(NOW).toISOString(),
    restartCount: 0,
    oomKilled: false,
    healthStatus: null,
  };
}

/** The rule ids that fire for a context, highest priority first. */
function matched(context) {
  return DIAGNOSTIC_RULES.filter((r) => r.match(context))
    .sort((a, b) => b.priority - a.priority)
    .map((r) => r.id);
}

function bestRule(context) {
  return DIAGNOSTIC_RULES.filter((r) => r.match(context)).sort(
    (a, b) => b.priority - a.priority
  )[0];
}

describe('diagnostic rule catalog — shape', () => {
  test('every rule has an id, a numeric priority and the three functions', () => {
    for (const rule of DIAGNOSTIC_RULES) {
      expect(typeof rule.id).toBe('string');
      expect(rule.id).not.toBe('');
      expect(typeof rule.priority).toBe('number');
      expect(typeof rule.match).toBe('function');
      expect(typeof rule.explain).toBe('function');
      // `fix` is optional, but when present it must return a shape.
      if (rule.fix) expect(typeof rule.fix).toBe('function');
    }
  });

  test('rule ids are unique', () => {
    const ids = DIAGNOSTIC_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every rule explains itself in plain language', () => {
    const context = ctx({ details: exited() });
    for (const rule of DIAGNOSTIC_RULES) {
      const text = rule.explain(context);
      expect(typeof text).toBe('string');
      expect(text.length).toBeGreaterThan(20);
    }
  });

  test('no rule fires on an empty context', () => {
    expect(matched(ctx())).toEqual([]);
  });

  test('fix, when offered, names its kind and whether the user must type', () => {
    const postgres = ctx({
      logLines: [
        'Error: Database is uninitialized and superuser password is not specified.',
      ],
    });
    const rule = bestRule(postgres);
    const fix = rule.fix(postgres);
    expect(fix.kind).toBe('add-env');
    expect(fix.patch.env).toHaveProperty('POSTGRES_PASSWORD');
    expect(fix.needsUserInput).toBe(true);
    expect(fix.label).toContain('POSTGRES_PASSWORD');
  });
});

describe('out-of-memory', () => {
  test('OOMKilled from inspect is decisive', () => {
    const context = ctx({ details: { ...exited(), oomKilled: true } });
    expect(matched(context)[0]).toBe('out-of-memory');
  });

  test('exit code 137 counts too', () => {
    expect(matched(ctx({ details: exited({ exitCode: 137 }) }))).toContain(
      'out-of-memory'
    );
  });

  test('an ordinary crash is not an OOM', () => {
    expect(matched(ctx({ details: exited({ exitCode: 1 }) }))).not.toContain(
      'out-of-memory'
    );
  });

  test('offers no automatic fix', () => {
    const context = ctx({ details: { ...exited(), oomKilled: true } });
    expect(bestRule(context).fix).toBeUndefined();
  });
});

describe('postgres-missing-password', () => {
  test("recognises the real postgres refusal", () => {
    const context = ctx({
      details: exited(),
      logLines: [
        'Error: Database is uninitialized and superuser password is not specified.',
        '2026-10-05 11:59:01.101 UTC [1] LOG:  starting PostgreSQL 17',
      ],
    });
    expect(matched(context)[0]).toBe('postgres-missing-password');
  });

  test('fix adds POSTGRES_PASSWORD and needs the user to fill it', () => {
    const context = ctx({ logLines: ['superuser password is not specified'] });
    const fix = bestRule(context).fix(context);
    expect(fix.patch.env.POSTGRES_PASSWORD).toBe('');
    expect(fix.needsUserInput).toBe(true);
  });

  test('a healthy postgres log does not match', () => {
    const context = ctx({
      logLines: [
        'database system is ready to accept connections',
        'LOG:  database system is shut down',
      ],
    });
    expect(matched(context)).not.toContain('postgres-missing-password');
  });
});

describe('mysql-missing-password', () => {
  test('recognises the mysql refusal', () => {
    const context = ctx({
      container: { id: 'b', name: 'db', image: 'mysql:8.4' },
      logLines: [
        'ERROR: You need to specify one of MYSQL_ROOT_PASSWORD, MYSQL_ALLOW_EMPTY_PASSWORD, or MYSQL_RANDOM_ROOT_PASSWORD',
      ],
    });
    expect(matched(context)[0]).toBe('mysql-missing-password');
  });

  test('the fix names the profile key, not a hardcoded one', () => {
    const context = ctx({
      container: { id: 'b', name: 'db', image: 'mariadb:11-alpine', env: [] },
      logLines: ['you need to specify one of MYSQL_ROOT_PASSWORD'],
    });
    expect(bestRule(context).fix(context).patch.env).toHaveProperty(
      'MARIADB_ROOT_PASSWORD'
    );
  });
});

describe('mssql-missing-eula', () => {
  test('recognises the unattended-environment refusal', () => {
    const context = ctx({
      container: { id: 'c', name: 'sql', image: 'mssql:2022-latest' },
      logLines: [
        'mssql: this is an unattended environment and ACCEPT_EULA is not set.',
      ],
    });
    expect(matched(context)[0]).toBe('mssql-missing-eula');
  });

  test('the fix is complete on its own — no user input needed', () => {
    const context = ctx({ logLines: ['ACCEPT_EULA is not set'] });
    const fix = bestRule(context).fix(context);
    expect(fix.patch.env.ACCEPT_EULA).toBe('Y');
    expect(fix.needsUserInput).toBe(false);
  });
});

describe('port-in-use', () => {
  const daemonMessage = [
    'Error response from daemon: driver failed programming external connectivity on endpoint web: Bind for 0.0.0.0:8080 failed: port is already allocated',
  ];

  test('recognises the daemon message and names the port', () => {
    const context = ctx({
      container: { id: 'd', name: 'web', image: 'nginx:1.27-alpine' },
      logLines: daemonMessage,
    });
    expect(matched(context)[0]).toBe('port-in-use');
    expect(bestRule(context).fix(context).patch.ports).toEqual({ '8080': null });
  });

  test('a bind failure reports the port too', () => {
    const context = ctx({
      logLines: [
        'listen tcp 0.0.0.0:80: bind: address already in use',
      ],
    });
    expect(bestRule(context).fix(context).patch.ports).toEqual({ '80': null });
  });

  test('a message with no port in it offers no fix rather than a wrong one', () => {
    const context = ctx({
      logLines: ['Error: port is already allocated'],
    });
    expect(bestRule(context).fix(context)).toBeNull();
  });
});

describe('clean-exit', () => {
  test('a container that exited 0 immediately is not a failure', () => {
    const context = ctx({
      container: { id: 'e', name: 'job', image: 'alpine:3' },
      details: exited({ exitCode: 0, uptimeMs: 900 }),
    });
    expect(matched(context)[0]).toBe('clean-exit');
  });

  test('exit 0 after a long run is a normal stop, not a diagnosis', () => {
    const context = ctx({
      details: exited({ exitCode: 0, uptimeMs: 60_000 }),
    });
    expect(matched(context)).not.toContain('clean-exit');
  });

  test('the threshold is the shared one, not a local copy', () => {
    const context = ctx({
      details: exited({ exitCode: 0, uptimeMs: 1999 }),
    });
    expect(matched(context)).toContain('clean-exit');
  });
});

describe('missing-required-env', () => {
  test('fires once inspect has told us the variable is absent', () => {
    const context = ctx({
      container: {
        id: 'f',
        name: 'db',
        image: 'postgres:17-alpine',
        env: ['POSTGRES_DB=app'],
      },
    });
    expect(matched(context)).toContain('missing-required-env');
    expect(bestRule(context).fix(context).patch.env).toHaveProperty(
      'POSTGRES_PASSWORD'
    );
  });

  test('stays silent when the variable is there', () => {
    const context = ctx({
      container: {
        id: 'f',
        name: 'db',
        image: 'postgres:17-alpine',
        env: ['POSTGRES_PASSWORD=x', 'POSTGRES_DB=app'],
      },
    });
    expect(matched(context)).not.toContain('missing-required-env');
  });

  test('stays silent when we have not read the env yet', () => {
    // No `env` on the container: claiming a variable is missing when we
    // simply have not looked would be inventing a cause.
    const context = ctx({
      container: { id: 'f', name: 'db', image: 'postgres:17-alpine' },
    });
    expect(matched(context)).not.toContain('missing-required-env');
  });

  test('loses to a concrete log message', () => {
    const context = ctx({
      container: {
        id: 'f',
        name: 'db',
        image: 'postgres:17-alpine',
        env: [],
      },
      logLines: ['superuser password is not specified'],
    });
    expect(matched(context)[0]).toBe('postgres-missing-password');
  });

  test('says nothing about images with no required env', () => {
    const context = ctx({
      container: { id: 'g', name: 'web', image: 'nginx:1.27-alpine', env: [] },
    });
    expect(matched(context)).not.toContain('missing-required-env');
  });
});

describe('rules with no fix', () => {
  const cases = [
    ['no-command', ['docker: Error response from daemon: no command specified.']],
    ['volume-permission-denied', ['mkdir /data: permission denied']],
    ['executable-not-found', ['exec: "python": executable file not found in $PATH']],
    ['connection-refused', ['Error: connect ECONNREFUSED 172.18.0.3:5432']],
  ];

  test.each(cases)('%s recognises its message', (id, logLines) => {
    expect(matched(ctx({ logLines }))).toContain(id);
  });

  test.each(cases)('%s offers no automatic fix', (id, logLines) => {
    const context = ctx({ logLines });
    expect(bestRule(context).id).toBe(id);
    expect(bestRule(context).fix).toBeUndefined();
  });

  test('a healthy log matches none of them', () => {
    const context = ctx({
      logLines: [
        '10.0.0.1 - - [05/Oct/2026:12:00:00] "GET / HTTP/1.1" 200 615',
        'ready to handle connections',
      ],
    });
    expect(matched(context)).toEqual([]);
  });
});

describe('priority ordering', () => {
  test('a concrete inspect fact outranks a log message', () => {
    const context = ctx({
      details: { ...exited({ exitCode: 137 }), oomKilled: true },
      logLines: ['connection refused'],
    });
    expect(matched(context)[0]).toBe('out-of-memory');
  });

  test('the generic connection message is the weakest signal', () => {
    const context = ctx({
      logLines: ['connection refused'],
    });
    expect(matched(context)).toEqual(['connection-refused']);
  });
});
