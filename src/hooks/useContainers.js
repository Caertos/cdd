/**
 * React hook to manage Docker containers state.
 *
 * @returns {{containers: Array<Object>, connection: import('./useDockerConnection.js').ConnectionState & { retry: () => void, reportResult: (err?: Error) => void }}}
 */
import React, { useState, useEffect } from 'react';
import { getContainers } from '../helpers/dockerService/serviceComponents/containerList.js';
import { REFRESH_INTERVALS } from '../helpers/constants.js';
import { useDockerConnection } from './useDockerConnection.js';

export function useContainers() {
  const connection = useDockerConnection();
  const [containers, setContainers] = useState([]);

  useEffect(() => {
    let alive = true;
    const fetch = async () => {
      try {
        const list = await getContainers();
        if (!alive) return;
        setContainers(list);
        connection.reportResult();
      } catch (err) {
        if (!alive) return;
        connection.reportResult(err);
        // Important: do NOT clear containers. Mark as stale instead.
      }
    };
    fetch();

    // Normal mode: poll on an interval. Error mode: useDockerConnection
    // bumps retryToken (auto every 5s, or immediately on manual R retry).
    if (connection.status === 'error') {
      return () => {
        alive = false;
      };
    }

    const timer = setInterval(fetch, REFRESH_INTERVALS.CONTAINER_LIST);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [connection.status, connection.retryToken]);

  return { containers, connection };
}
