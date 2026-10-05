import { HEALTH_THRESHOLDS } from './constants.js';
import { STRINGS } from './strings.js';

/**
 * @typedef {Object} HealthFacts
 * @property {number|null} exitCode
 * @property {number|null} uptimeMs
 * @property {number} restartCount
 * @property {boolean} oomKilled
 * @property {string|null} healthStatus
 */

/**
 * @typedef {Object} HealthVerdict
 * @property {'running'|'starting'|'stopped'|'crashed'|'crash-loop'|'restarting'|'unhealthy'|'paused'|'unknown'} code
 * @property {'ok'|'idle'|'warn'|'fail'} level - Decides the colour.
 * @property {string} headline - Short row text, without icon.
 * @property {HealthFacts} facts - Raw data TASK-8 will use to explain.
 */

const LEVEL_STYLES = {
  ok: { symbol: '🟢', color: 'green' },
  idle: { symbol: '⚪', color: 'gray' },
  warn: { symbol: '🟠', color: 'yellow' },
  fail: { symbol: '🔴', color: 'red' },
};

/**
 * Build a verdict with the given fields.
 *
 * @param {HealthVerdict['code']} code
 * @param {HealthVerdict['level']} level
 * @param {string} headline
 * @param {HealthFacts} facts
 * @returns {HealthVerdict}
 */
function verdict(code, level, headline, facts) {
  return { code, level, headline, facts };
}

/**
 * Parse an ISO timestamp, rejecting Docker's zero time
 * (`0001-01-01T00:00:00Z`, which parses to a negative epoch value).
 *
 * @param {unknown} value
 * @returns {number|null} epoch milliseconds, or null when unusable
 */
function parseTime(value) {
  if (typeof value !== 'string' || value.length === 0) return null;
  const ms = Date.parse(value);
  if (Number.isNaN(ms) || ms <= 0) return null;
  return ms;
}

/**
 * Whole seconds a duration represents, never below 1 so the headline
 * always reads naturally ('died after 1s' instead of '0s').
 *
 * @param {number} ms
 * @returns {number}
 */
function toSeconds(ms) {
  return Math.max(1, Math.round(ms / 1000));
}

/**
 * Milliseconds the container was alive on its last run.
 * For a finished run it is `finishedAt - startedAt`; while running it is
 * `now - startedAt`.
 *
 * @param {import('./dockerService/serviceComponents/containerInspect.js').ContainerDetails|null} details
 * @param {number} now - current timestamp in ms (injected)
 * @returns {number|null} null when there is not enough information
 */
export function computeUptime(details, now) {
  if (!details) return null;
  const started = parseTime(details.startedAt);
  if (started === null) return null;

  const finished = parseTime(details.finishedAt);
  if (finished !== null && finished >= started) {
    return finished - started;
  }
  return now - started;
}

/**
 * Basic verdict used when `inspect` data is missing or failed.
 * Derived only from the list summary, so the UI never blocks or breaks.
 *
 * @param {Object|null} container - List summary ({ state, status })
 * @returns {HealthVerdict}
 */
function basicVerdict(container) {
  const state = container?.state;
  const facts = {
    exitCode: null,
    uptimeMs: null,
    restartCount: 0,
    oomKilled: false,
    healthStatus: null,
  };

  if (state === 'running') {
    return verdict('running', 'ok', STRINGS.health.running, facts);
  }
  if (state === 'paused') {
    return verdict('paused', 'warn', STRINGS.health.paused, facts);
  }
  if (state === 'exited' || state === 'dead') {
    return verdict('stopped', 'idle', STRINGS.health.stopped, facts);
  }
  if (typeof state === 'string' && state.length > 0) {
    return verdict('unknown', 'idle', state.toUpperCase(), facts);
  }
  return verdict('unknown', 'idle', STRINGS.health.unknown, facts);
}

/**
 * Calculate the health verdict of a container.
 *
 * Pure: `now` is injected so the time thresholds can be tested without
 * waiting and without touching `Date.now()` inside.
 *
 * Rules are evaluated in order; the first match wins:
 * unhealthy → restarting → crash-loop → crashed → stopped → starting →
 * running → paused.
 *
 * @param {Object|null} container - List summary ({ state, status })
 * @param {import('./dockerService/serviceComponents/containerInspect.js').ContainerDetails|null} details - inspect data, if available
 * @param {number} now - current timestamp in ms
 * @returns {HealthVerdict}
 */
export function evaluateHealth(container, details, now) {
  if (!details) {
    return basicVerdict(container);
  }

  const uptime = computeUptime(details, now);
  const facts = {
    exitCode: typeof details.exitCode === 'number' ? details.exitCode : null,
    uptimeMs: uptime,
    restartCount:
      typeof details.restartCount === 'number' ? details.restartCount : 0,
    oomKilled: details.oomKilled === true,
    healthStatus: details.healthStatus ?? null,
  };

  if (details.healthStatus === 'unhealthy') {
    return verdict('unhealthy', 'warn', STRINGS.health.unhealthy, facts);
  }

  const restarting =
    details.restarting === true ||
    (facts.restartCount > HEALTH_THRESHOLDS.RESTART_COUNT_ALERT &&
      uptime !== null &&
      uptime < HEALTH_THRESHOLDS.RESTART_WINDOW);
  if (restarting) {
    return verdict(
      'restarting',
      'warn',
      STRINGS.health.restarting(facts.restartCount),
      facts
    );
  }

  const state = details.state ?? container?.state;

  if (state === 'paused') {
    return verdict('paused', 'warn', STRINGS.health.paused, facts);
  }

  if (state === 'running') {
    if (uptime !== null && uptime < HEALTH_THRESHOLDS.STARTING_GRACE) {
      return verdict('starting', 'ok', STRINGS.health.starting, facts);
    }
    return verdict('running', 'ok', STRINGS.health.running, facts);
  }

  if (facts.exitCode !== null && facts.exitCode !== 0) {
    if (uptime !== null && uptime < HEALTH_THRESHOLDS.CRASH_LOOP_MAX_UPTIME) {
      return verdict(
        'crash-loop',
        'fail',
        STRINGS.health.crashLoop(toSeconds(uptime)),
        facts
      );
    }
    return verdict(
      'crashed',
      'fail',
      STRINGS.health.crashed(facts.exitCode),
      facts
    );
  }

  if (facts.exitCode === 0) {
    return verdict('stopped', 'idle', STRINGS.health.stopped, facts);
  }

  return basicVerdict(container);
}

/**
 * Colour and symbol for a verdict level.
 *
 * @param {HealthVerdict['level']} level
 * @returns {{ symbol: string, color: string }}
 */
export function levelStyle(level) {
  return LEVEL_STYLES[level] ?? LEVEL_STYLES.idle;
}
