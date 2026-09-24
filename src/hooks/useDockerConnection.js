import { useState, useEffect, useRef, useCallback } from 'react';
import { classifyDockerError } from '../helpers/dockerErrors.js';
import { CONNECTION_RETRY_INTERVAL } from '../helpers/constants.js';

/**
 * @typedef {Object} ConnectionState
 * @property {'connecting'|'ok'|'error'} status
 * @property {import('../helpers/dockerErrors.js').DockerErrorInfo|null} error
 * @property {number} lastOkAt   - Timestamp of the last successful probe
 * @property {boolean} isStale   - true if there were containers before and now it fails
 * @property {number} nextRetryIn - Seconds until the next automatic retry (0 when healthy)
 */

/**
 * Manages the Docker connection state and automatic retry.
 *
 * @param {Object} [options]
 * @param {number} [options.retryIntervalMs=CONNECTION_RETRY_INTERVAL]
 * @returns {ConnectionState & { retry: () => void, reportResult: (err?: Error) => void }}
 */
export function useDockerConnection(options = {}) {
  const { retryIntervalMs = CONNECTION_RETRY_INTERVAL } = options;

  const [status, setStatus] = useState('connecting');
  const [error, setError] = useState(null);
  const [lastOkAt, setLastOkAt] = useState(0);
  const [isStale, setIsStale] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const [nextRetryIn, setNextRetryIn] = useState(0);

  const hadDataRef = useRef(false);

  // Automatic retry while in error state, with a live countdown.
  // retryToken in deps: every auto or manual retry restarts the cycle.
  useEffect(() => {
    if (status !== 'error') {
      setNextRetryIn(0);
      return undefined;
    }

    const totalSeconds = Math.ceil(retryIntervalMs / 1000);
    setNextRetryIn(totalSeconds);

    const retryTimer = setInterval(() => {
      setRetryToken((t) => t + 1);
    }, retryIntervalMs);

    const tickTimer = setInterval(() => {
      setNextRetryIn((s) => (s > 0 ? s - 1 : 0));
    }, 1000);

    return () => {
      clearInterval(retryTimer);
      clearInterval(tickTimer);
    };
  }, [status, retryIntervalMs, retryToken]);

  const reportResult = useCallback((err) => {
    if (err) {
      setStatus('error');
      setError(classifyDockerError(err));
      if (hadDataRef.current) {
        setIsStale(true);
      }
    } else {
      setStatus('ok');
      setError(null);
      setLastOkAt(Date.now());
      setIsStale(false);
      hadDataRef.current = true;
    }
  }, []);

  const retry = useCallback(() => {
    setRetryToken((t) => t + 1);
  }, []);

  return {
    status,
    error,
    lastOkAt,
    isStale,
    reportResult,
    retry,
    retryToken,
    nextRetryIn,
  };
}
