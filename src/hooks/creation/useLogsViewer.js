import { useState, useRef } from "react";

/**
 * Custom hook to manage the logs viewer state and stream reference.
 * Handles showing/hiding logs and storing log lines.
 *
 * @returns {Object} Logs viewer state and helpers
 * @property {boolean} showLogs - Whether the logs viewer is open
 * @property {function} setShowLogs - Setter for showLogs
 * @property {Array<string>} logs - Array of log lines
 * @property {function} setLogs - Setter for logs
 * @property {object} logsStreamRef - Ref to the logs stream (for cleanup)
 * @property {function} openLogs - Helper to open logs for a container
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
   * Closes the logs viewer and cleans up the stream.
   */
  function closeLogs() {
    setShowLogs(false);
    setLogs([]);
    if (logsStreamRef.current) {
      logsStreamRef.current.destroy?.();
      logsStreamRef.current = null;
    }
  }

  return {
    showLogs,
    setShowLogs,
    logs,
    setLogs,
    logsStreamRef,
    openLogs,
    closeLogs,
  };
}
