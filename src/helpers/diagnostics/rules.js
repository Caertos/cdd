/**
 * Diagnostic rule catalog — pure data plus the predicates that read it.
 *
 * Adding knowledge to CDD means adding an element to DIAGNOSTIC_RULES and a
 * case to the test file. If these were chained `if`s the catalog would be
 * untouchable within six months.
 *
 * Two rules govern the whole file:
 *
 * 1. **Never invent a cause.** A rule only fires on evidence we actually
 *    read — a log line or an inspect fact. When nothing matches, the panel
 *    says so (principle 5 of the roadmap).
 * 2. **A concrete signal beats a generic one.** `priority` encodes that;
 *    diagnose() keeps the highest match.
 */
import { HEALTH_THRESHOLDS } from '../constants.js';
import { STRINGS } from '../strings.js';

/**
 * @typedef {Object} DiagnosticContext
 * @property {Object} container       - Row from getContainers(), plus `env` once inspect has been read
 * @property {import('../dockerService/serviceComponents/containerInspect.js').ContainerDetails|null} details - inspect data
 * @property {import('../health.js').HealthVerdict} verdict - Health verdict
 * @property {string[]} logLines      - Last lines read from the container log
 * @property {Object|null} profile     - IMAGE_PROFILES entry, when the image is known
 */

/**
 * @typedef {Object} FixSuggestion
 * @property {'add-env'|'change-port'} kind
 * @property {string} label  - Button text, e.g. 'Recreate with POSTGRES_PASSWORD'
 * @property {Object} patch  - Changes to apply: { env: {...}, ports: {...} }
 * @property {boolean} needsUserInput - True when the user must supply a value
 */

/**
 * @typedef {Object} DiagnosticRule
 * @property {string} id
 * @property {number} priority - Higher wins when several rules match
 * @property {(ctx: DiagnosticContext) => boolean} match
 * @property {(ctx: DiagnosticContext) => string} explain
 * @property {string[]} [needles] - Lowercase substrings this rule looks for in
 *   the log, so the panel can quote the lines that triggered it. Omitted by
 *   rules driven by inspect facts, which have no log evidence to quote.
 * @property {(ctx: DiagnosticContext) => FixSuggestion|null} [fix]
 */

/** Case-insensitive "any of these substrings appears in the log" test. */
function logHas(ctx, ...needles) {
  const haystack = (ctx.logLines || []).join('\n').toLowerCase();
  return needles.some((needle) => haystack.includes(needle));
}

/**
 * The label for an "add this variable" fix.
 *
 * When the fix has no value to give — a password — the button says so, because
 * a label that promises a working container it cannot build is worse than no
 * label at all.
 *
 * @param {string} key
 * @param {boolean} needsUserInput
 * @returns {string}
 */
function addEnvLabel(key, needsUserInput) {
  return needsUserInput
    ? STRINGS.diagnostics.fix.addEnvInputNeeded(key)
    : STRINGS.diagnostics.fix.addEnv(key);
}

/** Facts from the health verdict, tolerating a missing verdict. */
function factsOf(ctx) {
  return ctx.verdict?.facts ?? {};
}

/**
 * First env key the image requires that the container was not given.
 *
 * Returns null when we cannot tell: an absent `env` array means inspect has
 * not been read yet, and claiming a variable is missing when we simply have
 * not looked would be inventing a cause.
 *
 * @param {DiagnosticContext} ctx
 * @returns {string|null}
 */
function missingRequiredEnv(ctx) {
  const required = ctx.profile?.requiredEnv;
  // Read from inspect, not from the list row: getContainers() does not carry
  // env, so a rule reading ctx.container.env matched only inside the tests.
  // ctx.container.env stays as a fallback so a caller that does have it wins.
  const given = ctx.details?.env ?? ctx.container?.env;
  if (!Array.isArray(required) || required.length === 0) return null;
  if (!Array.isArray(given)) return null;
  const flat = given.join('\n').toLowerCase();
  return required.find((key) => !flat.includes(key.toLowerCase())) ?? null;
}

/**
 * The host port the log complains about, read backwards from the message.
 * Docker writes it just before the failure: "…0.0.0.0:8080 failed: port is
 * already allocated".
 *
 * @param {DiagnosticContext} ctx
 * @returns {string|null}
 */
function busyHostPort(ctx) {
  for (const line of ctx.logLines || []) {
    const at = line.toLowerCase().indexOf('already');
    if (at === -1) continue;
    if (!/already (in use|allocated)/i.test(line)) continue;
    const before = line.slice(0, at).match(/:(\d{2,5})\b/);
    if (before) return before[1];
  }
  return null;
}

/** @type {DiagnosticRule[]} */
export const DIAGNOSTIC_RULES = [
  {
    // Only the flag, never the exit code. 137 is SIGKILL, which Docker also
    // sends for `docker kill` and a stop that timed out — calling that "out of
    // memory" is exactly the invented cause this catalog must not produce.
    id: 'out-of-memory',
    priority: 100,
    match: (ctx) => factsOf(ctx).oomKilled === true,
    explain: () => STRINGS.diagnostics.explain['out-of-memory'],
  },
  {
    id: 'postgres-missing-password',
    priority: 90,
    match: (ctx) =>
      logHas(
        ctx,
        'superuser password is not specified',
        'database is uninitialized and superuser password is not specified'
      ),
    needles: ['superuser password is not specified'],
    explain: () => STRINGS.diagnostics.explain['postgres-missing-password'],
    fix: () => ({
      kind: 'add-env',
      label: addEnvLabel('POSTGRES_PASSWORD', true),
      patch: { env: { POSTGRES_PASSWORD: '' } },
      needsUserInput: true,
    }),
  },
  {
    id: 'mysql-missing-password',
    priority: 90,
    match: (ctx) => {
      const missing = missingRequiredEnv(ctx);
      const profilePointsAtMysql =
        missing !== null && /^(MYSQL|MARIADB)_/.test(missing);
      return (
        logHas(
          ctx,
          'you need to specify one of mysql_root_password',
          'you need to specify one of mariadb_root_password'
        ) || profilePointsAtMysql
      );
    },
    needles: [
      'you need to specify one of mysql_root_password',
      'you need to specify one of mariadb_root_password',
    ],
    explain: () => STRINGS.diagnostics.explain['mysql-missing-password'],
    fix: (ctx) => {
      const key =
        missingRequiredEnv(ctx) ||
        (ctx.profile?.requiredEnv || []).find((k) =>
          /^(MYSQL|MARIADB)_/.test(k)
        ) ||
        'MYSQL_ROOT_PASSWORD';
      return {
        kind: 'add-env',
        label: addEnvLabel(key, true),
        patch: { env: { [key]: '' } },
        needsUserInput: true,
      };
    },
  },
  {
    id: 'mssql-missing-eula',
    priority: 90,
    match: (ctx) =>
      logHas(
        ctx,
        'the microsoft software license terms must be accepted',
        'accept_eula',
        'mssql: this is an unattended environment'
      ),
    needles: [
      'the microsoft software license terms must be accepted',
      'accept_eula',
    ],
    explain: () => STRINGS.diagnostics.explain['mssql-missing-eula'],
    fix: () => ({
      kind: 'add-env',
      label: STRINGS.diagnostics.fix.addEnv('ACCEPT_EULA=Y'),
      patch: { env: { ACCEPT_EULA: 'Y' } },
      needsUserInput: false,
    }),
  },
  {
    id: 'port-in-use',
    priority: 85,
    match: (ctx) =>
      logHas(
        ctx,
        'port is already allocated',
        'address already in use',
        'bind: address already in use'
      ),
    needles: ['port is already allocated', 'address already in use'],
    explain: () => STRINGS.diagnostics.explain['port-in-use'],
    // The concrete free port is chosen later, by applyFix, which owns the
    // lookup against the real container list.
    fix: (ctx) => {
      const port = busyHostPort(ctx);
      if (!port) return null;
      return {
        kind: 'change-port',
        label: STRINGS.diagnostics.fix.changePort(port),
        patch: { ports: { [port]: null } },
        needsUserInput: false,
      };
    },
  },
  {
    // A verdict fact rather than a log message: the container succeeded.
    // The code guard matters as much as the exit code — Docker reports
    // ExitCode 0 while a container runs, so facts alone would call a container
    // that just started "a job that finished on purpose".
    id: 'clean-exit',
    priority: 80,
    match: (ctx) => {
      if (ctx.verdict?.code !== 'stopped') return false;
      const { exitCode, uptimeMs } = factsOf(ctx);
      return (
        exitCode === 0 &&
        typeof uptimeMs === 'number' &&
        uptimeMs < HEALTH_THRESHOLDS.FAST_EXIT_MS
      );
    },
    explain: () => STRINGS.diagnostics.explain['clean-exit'],
  },
  {
    // Weaker: a profile can only say what the image usually needs, not what
    // went wrong. It is the fallback when no log line identifies the problem,
    // and only fires once inspect has actually told us the container's env.
    id: 'missing-required-env',
    priority: 60,
    match: (ctx) => missingRequiredEnv(ctx) !== null,
    explain: (ctx) => {
      const key = missingRequiredEnv(ctx);
      return `${ctx.profile?.requiredEnv?.length ?? 0} required variable${(ctx.profile?.requiredEnv?.length ?? 0) === 1 ? '' : 's'} this image expects, and ${key} is not set.`;
    },
    fix: (ctx) => {
      const key = missingRequiredEnv(ctx);
      return {
        kind: 'add-env',
        label: addEnvLabel(key, true),
        patch: { env: { [key]: '' } },
        needsUserInput: true,
      };
    },
  },
  {
    id: 'no-command',
    priority: 50,
    match: (ctx) =>
      logHas(
        ctx,
        'no command specified',
        'no entrypoint specified',
        'no cmd / entrypoint specified'
      ),
    needles: [
      'no command specified',
      'no entrypoint specified',
      'no cmd / entrypoint specified',
    ],
    explain: () => STRINGS.diagnostics.explain['no-command'],
  },
  {
    id: 'volume-permission-denied',
    priority: 50,
    match: (ctx) => logHas(ctx, 'permission denied'),
    needles: ['permission denied'],
    explain: () => STRINGS.diagnostics.explain['volume-permission-denied'],
  },
  {
    id: 'executable-not-found',
    priority: 50,
    match: (ctx) =>
      logHas(
        ctx,
        'executable file not found',
        'is not recognized as an internal'
      ),
    needles: ['executable file not found', 'is not recognized as an internal'],
    explain: () => STRINGS.diagnostics.explain['executable-not-found'],
  },
  {
    // Weakest signal in the catalog, and deliberately scoped down: we cannot
    // yet tell "another container" from "another machine". See TASK-8 §3.4.
    id: 'connection-refused',
    priority: 40,
    match: (ctx) =>
      logHas(
        ctx,
        'connection refused',
        'could not connect to server',
        'econnrefused'
      ),
    needles: [
      'connection refused',
      'could not connect to server',
      'econnrefused',
    ],
    explain: () => STRINGS.diagnostics.explain['connection-refused'],
  },
];
