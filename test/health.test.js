/**
 * @jest-environment node
 */
import {
  evaluateHealth,
  computeUptime,
  levelStyle,
} from '../src/helpers/health.js';
import { STRINGS } from '../src/helpers/strings.js';

// Fixed instant, injected everywhere: the engine never reads the clock.
const NOW = Date.parse('2026-01-01T12:00:00.000Z');

/** inspect-shaped details with sensible defaults. */
function details(overrides = {}) {
  return {
    id: 'abc123',
    state: 'exited',
    exitCode: 0,
    startedAt: null,
    finishedAt: null,
    restarting: false,
    restartCount: 0,
    healthStatus: null,
    oomKilled: false,
    labels: {},
    ...overrides,
  };
}

/** A finished run that lasted `uptimeMs`, ending just before NOW. */
function finished(exitCode, uptimeMs, extra = {}) {
  return details({
    state: 'exited',
    exitCode,
    startedAt: new Date(NOW - uptimeMs - 1000).toISOString(),
    finishedAt: new Date(NOW - 1000).toISOString(),
    ...extra,
  });
}

/** A run still alive, started `uptimeMs` ago. */
function alive(extra = {}) {
  const { uptimeMs = 3_600_000, ...rest } = extra;
  return details({
    state: 'running',
    exitCode: null,
    startedAt: new Date(NOW - uptimeMs).toISOString(),
    finishedAt: '0001-01-01T00:00:00Z',
    ...rest,
  });
}

describe('evaluateHealth — verdict catalogue', () => {
  test('clean exit (code 0) → stopped / idle', () => {
    const v = evaluateHealth({ state: 'exited' }, finished(0, 3_600_000), NOW);
    expect(v.code).toBe('stopped');
    expect(v.level).toBe('idle');
    expect(v.headline).toBe(STRINGS.health.stopped);
  });

  test('failure (code 1, alive 5 min) → crashed / fail', () => {
    const v = evaluateHealth({ state: 'exited' }, finished(1, 300_000), NOW);
    expect(v.code).toBe('crashed');
    expect(v.level).toBe('fail');
    expect(v.headline).toBe(STRINGS.health.crashed(1));
  });

  test('quick death (code 1, alive 2 s) → crash-loop / fail', () => {
    const v = evaluateHealth({ state: 'exited' }, finished(1, 2_000), NOW);
    expect(v.code).toBe('crash-loop');
    expect(v.level).toBe('fail');
    expect(v.headline).toBe(STRINGS.health.crashLoop(2));
  });

  test('restart loop (restartCount 5, alive 30 s) → restarting / warn', () => {
    const v = evaluateHealth(
      { state: 'running' },
      alive({ uptimeMs: 30_000, restartCount: 5 }),
      NOW
    );
    expect(v.code).toBe('restarting');
    expect(v.level).toBe('warn');
    expect(v.headline).toBe(STRINGS.health.restarting(5));
  });

  test('Restarting flag wins even with a low count', () => {
    const v = evaluateHealth(
      { state: 'running' },
      alive({ uptimeMs: 3_600_000, restarting: true, restartCount: 0 }),
      NOW
    );
    expect(v.code).toBe('restarting');
  });

  test('old restarts are not a loop (count high, uptime long)', () => {
    const v = evaluateHealth(
      { state: 'running' },
      alive({ uptimeMs: 3_600_000, restartCount: 9 }),
      NOW
    );
    expect(v.code).toBe('running');
  });

  test('unhealthy health check → unhealthy / warn', () => {
    const v = evaluateHealth(
      { state: 'running' },
      alive({ healthStatus: 'unhealthy' }),
      NOW
    );
    expect(v.code).toBe('unhealthy');
    expect(v.level).toBe('warn');
    expect(v.headline).toBe(STRINGS.health.unhealthy);
  });

  test('healthy health check → running', () => {
    const v = evaluateHealth(
      { state: 'running' },
      alive({ healthStatus: 'healthy' }),
      NOW
    );
    expect(v.code).toBe('running');
  });

  test('just started (2 s) → starting / ok', () => {
    const v = evaluateHealth(
      { state: 'running' },
      alive({ uptimeMs: 2_000 }),
      NOW
    );
    expect(v.code).toBe('starting');
    expect(v.level).toBe('ok');
  });

  test('long running (1 h) → running / ok', () => {
    const v = evaluateHealth(
      { state: 'running' },
      alive({ uptimeMs: 3_600_000 }),
      NOW
    );
    expect(v.code).toBe('running');
    expect(v.level).toBe('ok');
    expect(v.headline).toBe(STRINGS.health.running);
  });

  test('paused → paused / warn', () => {
    const v = evaluateHealth(
      { state: 'paused' },
      details({ state: 'paused', exitCode: null }),
      NOW
    );
    expect(v.code).toBe('paused');
    expect(v.level).toBe('warn');
  });

  test('OOM kill is reported in facts', () => {
    const v = evaluateHealth(
      { state: 'exited' },
      finished(137, 300_000, { oomKilled: true }),
      NOW
    );
    expect(v.code).toBe('crashed');
    expect(v.facts.exitCode).toBe(137);
    expect(v.facts.oomKilled).toBe(true);
  });
});

describe('evaluateHealth — missing or incomplete data', () => {
  test('null details → basic verdict from state, no throw', () => {
    expect(evaluateHealth({ state: 'running' }, null, NOW).code).toBe(
      'running'
    );
    expect(evaluateHealth({ state: 'exited' }, null, NOW).code).toBe('stopped');
    expect(evaluateHealth({ state: 'paused' }, null, NOW).code).toBe('paused');
  });

  test('missing state → unknown headline, no throw', () => {
    const v = evaluateHealth({}, null, NOW);
    expect(v.code).toBe('unknown');
    expect(v.headline).toBe(STRINGS.health.unknown);
  });

  test('unexpected non-empty state is uppercased in the basic verdict', () => {
    const v = evaluateHealth({ state: 'restarting' }, null, NOW);
    expect(v.code).toBe('unknown');
    expect(v.headline).toBe('RESTARTING');
  });

  test('missing timestamps → no crash-loop, reported as crashed', () => {
    const v = evaluateHealth(
      { state: 'exited' },
      details({ state: 'exited', exitCode: 1 }),
      NOW
    );
    expect(v.code).toBe('crashed');
    expect(v.facts.uptimeMs).toBeNull();
  });

  test('no exit code and not running → basic verdict', () => {
    const v = evaluateHealth(
      { state: 'exited' },
      details({ state: 'exited', exitCode: null }),
      NOW
    );
    expect(v.code).toBe('stopped');
  });

  test('non-numeric inspect fields fall back to safe defaults', () => {
    const v = evaluateHealth(
      { state: 'running' },
      details({
        state: 'running',
        restartCount: null,
        exitCode: 'oops',
        startedAt: new Date(NOW - 3_600_000).toISOString(),
        finishedAt: '0001-01-01T00:00:00Z',
      }),
      NOW
    );
    expect(v.facts.restartCount).toBe(0);
    expect(v.facts.exitCode).toBeNull();
    expect(v.code).toBe('running');
  });

  test('uses the list state when inspect omits it', () => {
    const v = evaluateHealth(
      { state: 'running' },
      details({
        state: null,
        startedAt: new Date(NOW - 3_600_000).toISOString(),
        finishedAt: '0001-01-01T00:00:00Z',
      }),
      NOW
    );
    expect(v.code).toBe('running');
  });
});

describe('computeUptime', () => {
  test('finished run uses finishedAt - startedAt', () => {
    expect(computeUptime(finished(0, 60_000), NOW)).toBe(60_000);
  });

  test('running container uses now - startedAt', () => {
    expect(computeUptime(alive({ uptimeMs: 12_000 }), NOW)).toBe(12_000);
  });

  test('zero-time finishedAt is ignored while running', () => {
    const d = details({
      state: 'running',
      startedAt: new Date(NOW - 5_000).toISOString(),
      finishedAt: '0001-01-01T00:00:00Z',
    });
    expect(computeUptime(d, NOW)).toBe(5_000);
  });

  test('null details or missing start → null', () => {
    expect(computeUptime(null, NOW)).toBeNull();
    expect(computeUptime(details({ startedAt: null }), NOW)).toBeNull();
  });
});

describe('levelStyle', () => {
  test('maps each level to icon and colour', () => {
    expect(levelStyle('ok')).toEqual({ symbol: '🟢', color: 'green' });
    expect(levelStyle('idle')).toEqual({ symbol: '⚪', color: 'gray' });
    expect(levelStyle('warn')).toEqual({ symbol: '🟠', color: 'yellow' });
    expect(levelStyle('fail')).toEqual({ symbol: '🔴', color: 'red' });
  });

  test('unknown level falls back to idle', () => {
    expect(levelStyle('nope')).toEqual({ symbol: '⚪', color: 'gray' });
  });
});
