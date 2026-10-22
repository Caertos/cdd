import { useState, useRef, useEffect } from 'react';
import { safeCall } from '../../helpers/safeCall.js';

/**
 * Custom hook to manage the logs viewer state and stream reference.
 * Handles showing/hiding logs and storing log lines.
 *
 * @returns {Object} Logs viewer state and helpers
 * @property {boolean} showLogs - Whether the logs viewer is open
 * @property {function} setShowLogs - Setter for showLogs
 * @property {Array<string>} logs - Array of log lines
 * @property {function} setLogs - Setter for logs
 * @property {object} logsStreamRef - Ref to the { stop() } handle returned by getLogsStream
 * @property {function} openLogs - Helper to open logs for a container
 * @property {function} stopLogsStream - Stops the stream without touching the UI state
 * @property {function} closeLogs - Helper to close logs and cleanup
 */
export function useLogsViewer() {
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState([]);
  const logsStreamRef = useRef(null);

  /**
   * Opens the logs viewer and resets logs.
   */
  function openLogs() {
    setShowLogs(true);
    setLogs([]);
  }

  /**
   * Stops the log stream, if any, without touching the UI state.
   * Idempotent: the handle is cleared before stop() so a re-entrant call
   * finds nothing to do.
   */
  function stopLogsStream() {
    const handle = logsStreamRef.current;
    logsStreamRef.current = null;
    if (handle) {
      safeCall(handle.stop);
    }
  }

  /**
   * Closes the logs viewer and cleans up the stream.
   */
  function closeLogs() {
    // Stop first: clearing the state must not race a chunk that is already
    // on its way (D9).
    stopLogsStream();
    setShowLogs(false);
    setLogs([]);
  }

  // Unmount cleanup: quitting CDD with the viewer open (the `q` path has a
  // delay, useExitHandler) must not leave the stream writing into a dead tree.
  useEffect(() => {
    return () => {
      const handle = logsStreamRef.current;
      logsStreamRef.current = null;
      if (handle) {
        safeCall(handle.stop);
      }
    };
  }, []);

  return {
    showLogs,
    setShowLogs,
    logs,
    setLogs,
    logsStreamRef,
    openLogs,
    stopLogsStream,
    closeLogs,
  };
}
