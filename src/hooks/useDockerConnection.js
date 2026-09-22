import { useState, useEffect, useRef, useCallback } from 'react';
import { classifyDockerError } from '../helpers/dockerErrors.js';
import { CONNECTION_RETRY_INTERVAL } from '../helpers/constants.js';

/**
 * @typedef {Object} ConnectionState
 * @property {'connecting'|'ok'|'error'} status
 * @property {import('../helpers/dockerErrors.js').DockerErrorInfo|null} error
 * @property {number} lastOkAt   - Timestamp of the last successful probe
 * @property {boolean} isStale   - true if there were containers before and now it fails
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

  const hadDataRef = useRef(false);
  const timerRef = useRef(null);

  // Automatic retry while in error state
  useEffect(() => {
    if (status !== 'error') {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = setInterval(() => {
      setRetryToken((t) => t + 1);
    }, retryIntervalMs);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
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

  return { status, error, lastOkAt, isStale, reportResult, retry, retryToken };
}
