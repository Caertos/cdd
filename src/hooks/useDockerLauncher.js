import { useCallback, useEffect, useRef, useState } from 'react';
import {
  detectLaunchMethod as defaultDetectLaunchMethod,
  launchDocker as defaultLaunchDocker,
  launchDockerElevated as defaultLaunchDockerElevated,
  waitForDocker as defaultWaitForDocker,
} from '../helpers/dockerLauncher.js';
import { STRINGS } from '../helpers/strings.js';

/** @typedef {'idle'|'confirming'|'launching'|'waiting'|'ready'|'failed'|'timeout'} LaunchStatus */

const LAUNCH_TIMEOUT_MS = 90000;
const LAUNCH_POLL_MS = 2000;

/**
 * State machine that drives the "start Docker" flow.
 *
 * On mount it detects how Docker can be started (`detectLaunchMethod`). The
 * caller shows the launch key only when `canLaunch` is true. From there the
 * user confirms, the command runs (detached or elevated via terminal
 * handover), and the hook polls `waitForDocker` until the daemon answers.
 *
 * Every side effect is injectable via `overrides` so the transitions can be
 * tested deterministically without real child processes or a real daemon.
 *
 * @param {Object} [overrides={}]
 * @param {() => Promise<import('../helpers/dockerLauncher.js').LaunchMethod|null>} [overrides.detectLaunchMethod]
 * @param {(method) => Promise<{started: boolean, error?: string}>} [overrides.launchDocker]
 * @param {(method) => Promise<{started: boolean, exitCode: number|null}>} [overrides.launchDockerElevated]
 * @param {(options) => Promise<{ready: boolean, elapsedMs: number, reason?: 'timeout'|'aborted'}>} [overrides.waitForDocker]
 */
export function useDockerLauncher(overrides = {}) {
  const {
    detectLaunchMethod = defaultDetectLaunchMethod,
    launchDocker = defaultLaunchDocker,
    launchDockerElevated = defaultLaunchDockerElevated,
    waitForDocker = defaultWaitForDocker,
  } = overrides;

  const [method, setMethod] = useState(null);
  const [status, setStatus] = useState('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState(null);

  const abortRef = useRef(null);
  const mountedRef = useRef(false);

  // Resolve how to start Docker on mount.
  useEffect(() => {
    let cancelled = false;
    Promise.resolve(detectLaunchMethod()).then((result) => {
      if (!cancelled && mountedRef.current) {
        setMethod(result);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [detectLaunchMethod]);

  // Abort any in-flight wait and mark unmounted so late continuations no-op.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
    };
  }, []);

  const start = useCallback(() => {
    if (status !== 'idle') return;
    setError(null);
    setElapsedMs(0);
    setStatus('confirming');
  }, [status]);

  const runWait = useCallback(
    async (controller) => {
      const result = await waitForDocker({
        timeoutMs: LAUNCH_TIMEOUT_MS,
        pollMs: LAUNCH_POLL_MS,
        onTick: (ms) => {
          if (mountedRef.current) setElapsedMs(ms);
        },
        signal: controller.signal,
      });

      if (!mountedRef.current) return;

      if (result.ready) {
        setStatus('ready');
      } else if (result.reason === 'timeout') {
        setStatus('timeout');
      } else if (result.reason === 'aborted') {
        // The user cancelled the wait; Docker keeps starting in the
        // background, so the flow returns to idle rather than failed.
        setElapsedMs(0);
        setStatus('idle');
      }
    },
    [waitForDocker]
  );

  const confirm = useCallback(async () => {
    if (status !== 'confirming' || !method) return;

    setError(null);
    setElapsedMs(0);
    setStatus('launching');

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const launch = method.needsPrivileges
        ? launchDockerElevated
        : launchDocker;
      const result = await launch(method);

      if (!mountedRef.current) return;

      if (!result.started) {
        abortRef.current = null;
        setError(result.error || STRINGS.dockerLauncher.launchFailed);
        setStatus('failed');
        return;
      }

      setStatus('waiting');
      await runWait(controller);
    } catch (err) {
      if (!mountedRef.current) return;
      abortRef.current = null;
      setError(err?.message || STRINGS.dockerLauncher.launchFailed);
      setStatus('failed');
    }
  }, [status, method, launchDocker, launchDockerElevated, runWait]);

  const keepWaiting = useCallback(async () => {
    if (status !== 'timeout' || !method) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setElapsedMs(0);
    setStatus('waiting');
    await runWait(controller);
  }, [status, method, runWait]);

  const cancelWait = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setError(null);
    setElapsedMs(0);
    setStatus('idle');
  }, []);

  return {
    method,
    canLaunch: method !== null,
    status,
    elapsedMs,
    error,
    start,
    confirm,
    cancelWait,
    keepWaiting,
    reset,
  };
}
