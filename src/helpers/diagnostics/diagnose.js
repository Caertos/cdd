/**
 * Diagnostic engine — turns a health verdict plus a log excerpt into one
 * explanation.
 *
 * Pure: it reads a context and returns a Diagnosis. It never touches
 * Docker, never reads a clock and never mutates its input.
 *
 * The single most important property here is that `why` may be null.
 * Saying "I don't recognise it" plus the last lines is useful; inventing a
 * plausible cause destroys more trust than ten correct ones build.
 */
import { HEALTH_THRESHOLDS } from '../constants.js';
import { DIAGNOSTIC_RULES } from './rules.js';

/**
 * @typedef {Object} Diagnosis
 * @property {string} what        - What happened, from the verdict
 * @property {string|null} why    - Probable cause, or null when unrecognised
 * @property {string|null} ruleId - Rule that matched
 * @property {string[]} evidence  - Log lines that triggered it
 * @property {import('./rules.js').FixSuggestion|null} fix
 * @property {string[]} tail      - Last few lines, always shown
 */

/** How many of the lines read are shown in the panel. */
export const TAIL_LINES = 5;

/** Verdict codes that always deserve an explanation. */
const DIAGNOSABLE_CODES = new Set([
  'crashed',
  'crash-loop',
  'restarting',
  'unhealthy',
]);

/**
 * Translate a health verdict into the "what happened" sentence.
 *
 * @param {import('../health.js').HealthVerdict|null} verdict
 * @returns {string}
 */
export function describeWhat(verdict) {
  const facts = verdict?.facts ?? {};
  const code = verdict?.code;

  if (code === 'crashed') {
    const uptime = facts.uptimeMs;
    const when =
      typeof uptime === 'number'
        ? ` after ${Math.max(1, Math.round(uptime / 1000))}s`
        : '';
    return `It died${when} with exit code ${facts.exitCode ?? 'unknown'}.`;
  }

  if (code === 'crash-loop') {
    return `It keeps dying${facts.uptimeMs ? ` after ${Math.max(1, Math.round(facts.uptimeMs / 1000))}s` : ''} and Docker restarts it.`;
  }

  if (code === 'restarting') {
    return `Docker has restarted it ${facts.restartCount ?? 0} times.`;
  }

  if (code === 'unhealthy') {
    return 'Its own health check reports it as unhealthy.';
  }

  if (exitsCleanlyFast(facts)) {
    return 'It finished and exited on its own, almost immediately.';
  }

  if (code === 'stopped') {
    return 'It is stopped.';
  }

  if (code === 'paused') {
    return 'It is paused.';
  }

  if (code === 'starting') {
    return 'It is still starting up.';
  }

  if (code === 'running') {
    return 'It is running.';
  }

  return verdict?.headline
    ? `Its state is ${verdict.headline}.`
    : 'Nothing is known about this container.';
}

/**
 * True when the container succeeded quickly — a job, not a service.
 * Reads the verdict's facts rather than the code, because TASK-7 reports
 * this as a plain `stopped`, the same as a deliberate `docker stop`.
 *
 * @param {{exitCode: number|null, uptimeMs: number|null}} facts
 * @returns {boolean}
 */
function exitsCleanlyFast(facts) {
  return (
    facts?.exitCode === 0 &&
    typeof facts.uptimeMs === 'number' &&
    facts.uptimeMs < HEALTH_THRESHOLDS.FAST_EXIT_MS
  );
}

/**
 * Does this verdict deserve a diagnosis panel?
 *
 * Decided by `code`, never by `level`: TASK-7 puts `paused` at `warn` even
 * though pausing is a user decision and not a failure, and a clean quick
 * exit lands on `idle`. Asking about the level would either diagnose a
 * deliberate pause or miss a finished job.
 *
 * @param {import('../health.js').HealthVerdict|null} verdict
 * @returns {boolean}
 */
export function shouldDiagnose(verdict) {
  if (!verdict) return false;
  if (DIAGNOSABLE_CODES.has(verdict.code)) return true;
  return exitsCleanlyFast(verdict.facts);
}

/**
 * The log lines a rule points at as its evidence.
 *
 * A rule declares the substrings it looks for in `needles`, so the engine can
 * quote the exact lines that triggered it without re-running the predicate
 * against a fabricated single-line context. Rules driven by inspect facts
 * (OOM, clean exit) have no needles and correctly report no evidence.
 *
 * @param {string[]} logLines
 * @param {import('./rules.js').DiagnosticRule} rule
 * @returns {string[]}
 */
function evidenceFor(logLines, rule) {
  const needles = rule.needles;
  if (!Array.isArray(needles) || needles.length === 0) return [];
  const lowered = needles.map((n) => n.toLowerCase());
  return (logLines || [])
    .filter((line) => {
      const haystack = String(line).toLowerCase();
      return lowered.some((needle) => haystack.includes(needle));
    })
    .slice(0, 3);
}

/**
 * Evaluate the catalog against a context and return the diagnosis.
 *
 * Always returns an object. `why` is null when nothing matched, and the
 * caller is expected to show that honestly.
 *
 * @param {import('./rules.js').DiagnosticContext} ctx
 * @param {import('./rules.js').DiagnosticRule[]} [rules=DIAGNOSTIC_RULES]
 * @returns {Diagnosis}
 */
export function diagnose(ctx, rules = DIAGNOSTIC_RULES) {
  const context = ctx ?? {};
  const logLines = Array.isArray(context.logLines) ? context.logLines : [];
  const tail = logLines.slice(-TAIL_LINES);

  const winner = (rules ?? [])
    .filter((rule) => {
      try {
        return rule.match(context);
      } catch {
        // A malformed context must not take the panel down with it.
        return false;
      }
    })
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))[0];

  if (!winner) {
    return {
      what: describeWhat(context.verdict),
      why: null,
      ruleId: null,
      evidence: [],
      fix: null,
      tail,
    };
  }

  const fix = typeof winner.fix === 'function' ? winner.fix(context) : null;

  return {
    what: describeWhat(context.verdict),
    why: winner.explain(context),
    ruleId: winner.id,
    evidence: evidenceFor(logLines, winner),
    fix: fix ?? null,
    tail,
  };
}
