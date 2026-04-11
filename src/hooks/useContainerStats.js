import { useState, useEffect } from 'react';
import { getStats } from '../helpers/dockerService/serviceComponents/containerStats.js';
import { REFRESH_INTERVALS } from '../helpers/constants.js';

const DEFAULT_STATS = { cpuPercent: 0, memPercent: 0, netIO: { rx: 0, tx: 0 } };

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
