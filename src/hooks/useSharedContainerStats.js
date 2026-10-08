import { useState, useEffect, useRef } from 'react';
import { getStats } from '../helpers/dockerService/serviceComponents/containerStats.js';
import { REFRESH_INTERVALS } from '../helpers/constants.js';

const STATS_ERROR = 'Error fetching stats';
const EMPTY_STATS = new Map();
const EMPTY_ERRORS = new Map();

/**
 * Stable key for the running containers currently on screen. The visible list
 * is a fresh slice on every render, so depending on its identity would restart
 * the interval on each render; the joined ids only change when the set of
 * polled containers really changes.
 *
 * @param {Array<Object>} containers - Visible containers (may be a non-array)
 * @returns {string} Comma-joined ids of the running containers
 */
const runningKey = (containers) => {
  if (!Array.isArray(containers)) return '';
  return containers
    .filter((c) => c && c.state === 'running')
    .map((c) => c.id)
    .join(',');
};

const runningTargets = (containers) => {
  if (!Array.isArray(containers)) return [];
  return containers.filter((c) => c && c.state === 'running');
};

/**
 * Polls stats for every visible running container from a single interval.
 *
 * Replaces one poller per row (D10): the whole window shares one cycle, so N
 * running rows cost one timer instead of N. Stopped containers are never
 * polled, matching the previous per-row behaviour.
 *
 * @param {Array<Object>} visibleContainers - The visible slice of the list
 * @returns {{stats: Map<string, Object>, errors: Map<string, string>}} Latest
 *   stats and per-container errors, keyed by container id
 */
export function useSharedContainerStats(visibleContainers) {
  const [stats, setStats] = useState(EMPTY_STATS);
  const [errors, setErrors] = useState(EMPTY_ERRORS);

  // The effect reads the live list through this ref: the re-subscription is
  // keyed by ids only, so it must not close over a stale slice.
  const containersRef = useRef(visibleContainers);
  containersRef.current = visibleContainers;

  const key = runningKey(visibleContainers);

  useEffect(() => {
    if (!key) {
      setStats(EMPTY_STATS);
      setErrors(EMPTY_ERRORS);
      return;
    }

    let cancelled = false;

    const refresh = async () => {
      const targets = runningTargets(containersRef.current);
      const results = await Promise.all(
        targets.map(async (container) => {
          try {
            return { id: container.id, stats: await getStats(container.id) };
          } catch {
            return { id: container.id, error: STATS_ERROR };
          }
        })
      );
      if (cancelled) return;

      const nextStats = new Map();
      const nextErrors = new Map();
      for (const result of results) {
        if (result.error) nextErrors.set(result.id, result.error);
        else nextStats.set(result.id, result.stats);
      }
      setStats(nextStats);
      setErrors(nextErrors);
    };

    refresh();
    const timer = setInterval(refresh, REFRESH_INTERVALS.CONTAINER_STATS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [key]);

  return { stats, errors };
}
