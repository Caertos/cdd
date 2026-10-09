import { useState, useEffect, useRef } from 'react';
import { getStats } from '../helpers/dockerService/serviceComponents/containerStats.js';
import { REFRESH_INTERVALS } from '../helpers/constants.js';

const STATS_ERROR = 'Error fetching stats';
const EMPTY_STATS = new Map();
const EMPTY_ERRORS = new Map();

/**
 * Stable key for the running containers currently on screen. The visible list
 * is a fresh slice on every render, so depending on its identity would restart
 * the interval on each render; sorting the ids before joining makes the key
 * change only when the SET of polled container ids changes, not when the same
 * set is merely reordered.
 *
 * @param {Array<Object>} containers - Visible containers (may be a non-array)
 * @returns {string} Sorted, comma-joined ids of the running containers
 */
const runningKey = (containers) => {
  if (!Array.isArray(containers)) return '';
  return containers
    .filter((c) => c && c.state === 'running')
    .map((c) => c.id)
    .sort()
    .join(',');
};

const runningTargets = (containers) => {
  if (!Array.isArray(containers)) return [];
  return containers.filter((c) => c && c.state === 'running');
};

/**
 * Keeps only the entries whose id is still present. Returns the same map when
 * every key is still present, so a key change that keeps the whole set causes
 * no state update and React can skip the re-render.
 *
 * @param {Map<string, *>} map - Current per-id values
 * @param {Set<string>} idSet - Ids that must be kept
 * @returns {Map<string, *>} The original map, or a pruned copy
 */
const pruneToIds = (map, idSet) => {
  for (const id of map.keys()) {
    if (!idSet.has(id)) {
      const next = new Map();
      for (const [keptId, value] of map) {
        if (idSet.has(keptId)) next.set(keptId, value);
      }
      return next;
    }
  }
  return map;
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
    // Drop only the ids that left the visible set on a key change: entries for
    // containers that are still present keep their last published values, so
    // adding or removing one row does not blank every other row until the next
    // fetch settles. With no running containers the id set is empty and both
    // Maps end up empty, as before.
    const ids = new Set(runningTargets(containersRef.current).map((c) => c.id));
    setStats((prev) => pruneToIds(prev, ids));
    setErrors((prev) => pruneToIds(prev, ids));

    if (!key) return;

    let cancelled = false;

    // Publish each container as soon as its own request settles. Updating the
    // Maps per-id keeps one slow (or non-settling) request from blocking the
    // CPU/MEM bars of every other visible row.
    const publish = (id, snapshot, error) => {
      if (cancelled) return;
      if (error) {
        setStats((prev) => {
          if (!prev.has(id)) return prev;
          const next = new Map(prev);
          next.delete(id);
          return next;
        });
        setErrors((prev) => new Map(prev).set(id, error));
      } else {
        setStats((prev) => new Map(prev).set(id, snapshot));
        setErrors((prev) => {
          if (!prev.has(id)) return prev;
          const next = new Map(prev);
          next.delete(id);
          return next;
        });
      }
    };

    const poll = async (id) => {
      try {
        publish(id, await getStats(id));
      } catch {
        publish(id, null, STATS_ERROR);
      }
    };

    const refresh = () => {
      for (const container of runningTargets(containersRef.current)) {
        poll(container.id);
      }
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
