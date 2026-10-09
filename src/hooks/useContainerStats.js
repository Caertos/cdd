// DEPRECATED: replaced by `useSharedContainerStats` (TASK-9, PR F), which polls
// every visible running container from a single interval instead of one timer
// per row. Kept only while a consumer may still import it; delete once none do.
import { useState, useEffect } from 'react';
import { getStats } from '../helpers/dockerService/serviceComponents/containerStats.js';
import { REFRESH_INTERVALS } from '../helpers/constants.js';

const DEFAULT_STATS = { cpuPercent: 0, memPercent: 0, netIO: { rx: 0, tx: 0 } };

/**
 * @deprecated Use `useSharedContainerStats` instead (TASK-9, PR F).
 * Per-row poller kept only for any remaining consumer.
 *
 * @param {string} id - Docker container id
 * @param {string} state - Container state; only 'running' is polled
 * @returns {{stats: Object, statsError: string}}
 */
export function useContainerStats(id, state) {
  const [stats, setStats] = useState(DEFAULT_STATS);
  const [statsError, setStatsError] = useState('');

  useEffect(() => {
    if (state !== 'running') {
      setStats(DEFAULT_STATS);
      setStatsError('');
      return;
    }

    let isMounted = true;

    const fetchStats = async () => {
      try {
        const s = await getStats(id);
        if (isMounted) {
          setStats(s);
          setStatsError('');
        }
      } catch (err) {
        if (isMounted) {
          setStats(DEFAULT_STATS);
          setStatsError('Error fetching stats');
        }
      }
    };

    fetchStats();
    const timer = setInterval(fetchStats, REFRESH_INTERVALS.CONTAINER_STATS);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [id, state]);

  return { stats, statsError };
}
