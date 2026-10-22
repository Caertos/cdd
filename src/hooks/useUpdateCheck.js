import { useCallback, useEffect, useRef, useState } from 'react';
import { checkForUpdate as defaultCheckForUpdate } from '../helpers/updateCheck.js';
import {
  detectInstallMethod as defaultDetectInstallMethod,
  installUpdate as defaultInstallUpdate,
} from '../helpers/updateInstaller.js';
import { getAppVersion } from '../helpers/appInfo.js';

/** @typedef {'idle'|'available'|'confirming'|'updating'|'updated'|'failed'} UpdateStatus */

/**
 * Checks npm for a newer CDD on mount and drives the "update now" flow.
 *
 * @param {Object} [overrides={}] - Injectable side effects for tests
 * @param {Function} [overrides.checkForUpdate]
 * @param {Function} [overrides.detectInstallMethod]
 * @param {Function} [overrides.installUpdate]
 * @param {string} [overrides.currentVersion]
 */
export function useUpdateCheck(overrides = {}) {
  const {
    checkForUpdate = defaultCheckForUpdate,
    detectInstallMethod = defaultDetectInstallMethod,
    installUpdate = defaultInstallUpdate,
    currentVersion = getAppVersion(),
  } = overrides;

  const [info, setInfo] = useState(null);
  const [method, setMethod] = useState(null);
  const [status, setStatus] = useState('idle');
  const [exitCode, setExitCode] = useState(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve(checkForUpdate({ currentVersion }))
      .then((result) => {
        if (cancelled || !mountedRef.current || !result?.updateAvailable)
          return;
        setInfo(result);
        setMethod(detectInstallMethod());
        setStatus('available');
      })
      .catch(() => {
        // checkForUpdate never throws; this guards injected fakes.
      });
    return () => {
      cancelled = true;
    };
  }, [checkForUpdate, detectInstallMethod, currentVersion]);

  const openConfirm = useCallback(() => {
    setStatus((s) => (s === 'available' ? 'confirming' : s));
  }, []);

  const cancel = useCallback(() => {
    setStatus((s) => (s === 'confirming' ? 'available' : s));
  }, []);

  const confirm = useCallback(async () => {
    if (status !== 'confirming' || !method?.command) return;
    setStatus('updating');
    let result;
    try {
      result = await installUpdate(method);
    } catch {
      result = { ok: false, exitCode: null };
    }
    if (!mountedRef.current) return;
    setExitCode(result.exitCode);
    setStatus(result.ok ? 'updated' : 'failed');
  }, [status, method, installUpdate]);

  /** Back to the banner after a failure, so the user can retry with U. */
  const acknowledge = useCallback(() => {
    setStatus((s) => (s === 'failed' ? 'available' : s));
  }, []);

  return {
    status,
    current: info?.current ?? currentVersion,
    latest: info?.latest ?? null,
    method,
    exitCode,
    canSelfUpdate: Boolean(method?.command),
    openConfirm,
    confirm,
    cancel,
    acknowledge,
  };
}
