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
 * Reads the log once per container and status and caches the result, so
 * arrowing past a container and back does not re-read it.
 *
 * @param {Object|null} container - The selected row from getContainers()
 * @param {import('../helpers/health.js').HealthVerdict|null} verdict - Its health verdict
 * @returns {{diagnosis: import('../helpers/diagnostics/diagnose.js').Diagnosis|null, isLoading: boolean}}
 */
export function useDiagnostics(container, verdict) {
  const [diagnosis, setDiagnosis] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [nonce, setNonce] = useState(0);
  const cacheRef = useRef(new Map());

  const wanted = Boolean(container) && shouldDiagnose(verdict);
  const key = wanted ? diagnosticCacheKey(container, verdict) : null;

  const refresh = useCallback(() => {
    // Drop the entry *and* bump the nonce: without the token the effect would
    // not re-run, because neither `key` nor `wanted` changed.
    if (key) cacheRef.current.delete(key);
    setNonce((n) => n + 1);
  }, [key]);

  useEffect(() => {
    if (!wanted) {
      setDiagnosis(null);
      setIsLoading(false);
      return undefined;
    }

    const cached = cacheRef.current.get(key);
    if (cached) {
      setDiagnosis(cached);
      setIsLoading(false);
      return undefined;
    }

    let cancelled = false;
    setIsLoading(true);
    setDiagnosis(null);

    getLogsTail(container.id, DIAGNOSTIC_LOG_LINES)
      .then((logLines) => {
        if (cancelled) return;
        // `details` is null here on purpose: every rule reads verdict.facts,
        // which already carries what inspect told us. Passing inspect data
        // again would mean a second inspect call for no gain.
        const result = diagnose({
          container,
          details: null,
          logLines,
          profile: profileOf(container),
          verdict,
        });
        cacheRef.current.set(key, result);
        setDiagnosis(result);
      })
      .catch((err) => {
        // getLogsTail does not reject today; if it ever does, an explanation
        // panel must not become the thing that breaks the dashboard.
        logger.error('Failed to diagnose container %s', container.id, err);
        if (!cancelled) setDiagnosis(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // `container` and `verdict` are intentionally out of the dependency list.
    // They are fresh objects on every list refresh, and including them would
    // re-read the log every 3 s — which is what the cache key exists to
    // prevent. The verdict's code, exit code and restart count are already in
    // `key`, so a genuinely different failure still gets read.
  }, [key, wanted, nonce]);

  return { diagnosis, isLoading, refresh };
}
