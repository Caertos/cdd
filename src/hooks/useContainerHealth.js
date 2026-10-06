import { useState, useEffect, useRef, useCallback } from 'react';
import { getManyContainerDetails } from '../helpers/dockerService/serviceComponents/containerInspect.js';
import { evaluateHealth } from '../helpers/health.js';
import { logger } from '../helpers/logger.js';

/** How many `inspect` calls may be in flight at once. */
const MAX_CONCURRENCY = 5;

/**
 * Keep health verdicts for the container list, inspecting only the
 * containers whose summary changed since the previous cycle.
 *
 * Cache key is `${id}:${status}`: Docker's `Status` text changes as the
 * container lives, which naturally invalidates the cached verdict without
 * CDD having to track history of its own.
 *
 * @param {Array<Object>} containers - Normalized list from getContainers()
 * @returns {{
 *   health: Map<string, import('../helpers/health.js').HealthVerdict>,
 *   details: Map<string, import('../helpers/dockerService/serviceComponents/containerInspect.js').ContainerDetails>,
 *   refresh: (id: string) => void
 * }}
 */
export function useContainerHealth(containers) {
  const [health, setHealth] = useState(() => new Map());
  // The inspect data is already being fetched; it used to be discarded after
  // the verdict was computed. TASK-8's profile-based rules need Config.Env, and
  // re-inspecting here would double the Docker calls for no new information.
  const [details, setDetails] = useState(() => new Map());
  const [refreshToken, setRefreshToken] = useState(0);
  const cacheRef = useRef(new Map());

  useEffect(() => {
    const list = Array.isArray(containers) ? containers : [];
    const now = Date.now();

    // Forget containers that left the list.
    const present = new Set(list.map((container) => container.id));
    for (const id of cacheRef.current.keys()) {
      if (!present.has(id)) {
        cacheRef.current.delete(id);
      }
    }

    // Reuse cached verdicts; inspect only what changed.
    const next = new Map();
    const toInspect = [];
    for (const container of list) {
      const cached = cacheRef.current.get(container.id);
      if (cached && cached.status === container.status) {
        next.set(container.id, cached.verdict);
      } else {
        toInspect.push(container.id);
        // Show the basic verdict until inspect answers.
        next.set(container.id, evaluateHealth(container, null, now));
      }
    }
    setHealth(next);

    if (toInspect.length === 0) {
      return undefined;
    }

    logger.debug('Inspecting %d container(s) for health', toInspect.length);
    let cancelled = false;

    getManyContainerDetails(toInspect, { concurrency: MAX_CONCURRENCY }).then(
      (detailsMap) => {
        if (cancelled) return;
        const changedIds = new Set(toInspect);
        setHealth((prev) => {
          const updated = new Map(prev);
          for (const container of list) {
            if (!changedIds.has(container.id)) continue;
            const details = detailsMap.get(container.id) ?? null;
            const verdict = evaluateHealth(container, details, now);
            updated.set(container.id, verdict);
            cacheRef.current.set(container.id, {
              status: container.status,
              verdict,
            });
          }
          return updated;
        });
        setDetails((prev) => {
          const updated = new Map(prev);
          for (const container of list) {
            if (!changedIds.has(container.id)) continue;
            const found = detailsMap.get(container.id);
            if (found) updated.set(container.id, found);
          }
          return updated;
        });
      }
    );

    return () => {
      cancelled = true;
    };
  }, [containers, refreshToken]);

  const refresh = useCallback((id) => {
    cacheRef.current.delete(id);
    setRefreshToken((token) => token + 1);
  }, []);

  return { health, details, refresh };
}
