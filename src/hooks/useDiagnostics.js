import { useCallback, useEffect, useRef, useState } from 'react';
import { getLogsTail } from '../helpers/dockerService/serviceComponents/containerLogs.js';
import { diagnose, shouldDiagnose } from '../helpers/diagnostics/diagnose.js';
import { IMAGE_PROFILES } from '../helpers/constants.js';
import { normalizeImageName } from '../helpers/imageNameUtils.js';
import { logger } from '../helpers/logger.js';

/** How many log lines the rules get to read. */
export const DIAGNOSTIC_LOG_LINES = 50;

/**
 * Cache key for one failure.
 *
 * Deliberately *not* keyed on `container.status`: Docker renders that as
 * "Exited (1) 2 seconds ago", so it changes every second and the panel would
 * re-read the log forever, flickering between loading and loaded.
 *
 * The verdict identifies the failure instead: a container's code plus its exit
 * code and restart count say whether this is the same failure as last time. A
 * Docker restart bumps restartCount, so a crash-restart-crash cycle gets a new
 * key and is read again, while arrowing past a container and back reuses what
 * we already have.
 *
 * @param {Object} container
 * @param {import('../helpers/health.js').HealthVerdict|null} verdict
 * @returns {string}
 */
export function diagnosticCacheKey(container, verdict) {
  const facts = verdict?.facts ?? {};
  return [
    container?.id ?? '',
    verdict?.code ?? '',
    facts.exitCode ?? '',
    facts.restartCount ?? '',
  ].join(':');
}

/**
 * The IMAGE_PROFILES entry for a container, when we know the image.
 *
 * @param {Object} container
 * @returns {Object|null}
 */
function profileOf(container) {
  const base = normalizeImageName(container?.image);
  if (!base) return null;
  return IMAGE_PROFILES[base] ?? null;
}

/**
 * Diagnose the selected container, but only when it deserves it.
 *
 * Reads the log once per failure and caches it, so arrowing past a container
 * and back does not re-read it.
 *
 * The log and the diagnosis are cached separately, on purpose. Inspect data
 * arrives after the first render, and the profile-based rules need Config.Env,
 * so the diagnosis has to be recomputed once it lands — without that, the first
 * (env-blind) verdict would be cached and the rule would never fire. Keeping
 * the lines means the recompute costs nothing.
 *
 * @param {Object|null} container - The selected row from getContainers()
 * @param {import('../helpers/health.js').HealthVerdict|null} verdict - Its health verdict
 * @param {import('../helpers/dockerService/serviceComponents/containerInspect.js').ContainerDetails|null} [details]
 *   - Inspect data already fetched by useContainerHealth; no extra Docker call
 * @returns {{diagnosis: import('../helpers/diagnostics/diagnose.js').Diagnosis|null, isLoading: boolean}}
 */
export function useDiagnostics(container, verdict, details = null) {
  const [diagnosis, setDiagnosis] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [nonce, setNonce] = useState(0);
  // Two caches: lines per failure, diagnosis per (failure + what we knew).
  const logsRef = useRef(new Map());
  const diagnosesRef = useRef(new Map());

  const wanted = Boolean(container) && shouldDiagnose(verdict);
  const key = wanted ? diagnosticCacheKey(container, verdict) : null;
  // Included so the diagnosis is rebuilt when inspect lands, but the cached
  // log lines are reused.
  const knowledge = details ? 'inspected' : 'blind';

  const refresh = useCallback(() => {
    // Drop both *and* bump the nonce: without the token the effect would not
    // re-run, because neither `key` nor `wanted` changed.
    if (key) {
      logsRef.current.delete(key);
      diagnosesRef.current.delete(key);
    }
    setNonce((n) => n + 1);
  }, [key]);

  useEffect(() => {
    if (!wanted) {
      setDiagnosis(null);
      setIsLoading(false);
      return undefined;
    }

    // One entry per failure, tagged with how much we knew when it was built.
    // Keyed by `key` alone so refresh() can drop it in one go.
    const cached = diagnosesRef.current.get(key);
    if (cached && cached.knowledge === knowledge) {
      setDiagnosis(cached.result);
      setIsLoading(false);
      return undefined;
    }

    const run = (logLines) => {
      const result = diagnose({
        container,
        details,
        logLines,
        profile: profileOf(container),
        verdict,
      });
      diagnosesRef.current.set(key, { knowledge, result });
      setDiagnosis(result);
    };

    // The cache holds the *promise*, not its value: when inspect lands while a
    // read is in flight, the next effect run has to be able to join that read
    // instead of starting a second one. Caching the resolved lines only worked
    // when the first read happened to finish first.
    let pending = logsRef.current.get(key);
    if (!pending) {
      pending = getLogsTail(container.id, DIAGNOSTIC_LOG_LINES);
      // Never rejected (getLogsTail resolves empty on failure), but a stray
      // rejection must not become an unhandled promise.
      pending = pending.catch((err) => {
        // An explanation panel must not be the thing that breaks the dashboard.
        logger.error('Failed to read log for %s', container.id, err);
        return [];
      });
      logsRef.current.set(key, pending);
    }

    let cancelled = false;
    setIsLoading(true);
    setDiagnosis(null);

    pending
      .then((logLines) => {
        if (cancelled) return;
        run(logLines);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // container and verdict are fresh objects on every 3 s list refresh, so this
    // effect re-runs often. That is deliberate and cheap: the log cache means a
    // re-run is a Map lookup and a diagnose() over lines already in memory,
    // never a Docker read.
  }, [key, wanted, knowledge, details, container, verdict, nonce]);

  return { diagnosis, isLoading, refresh };
}
