import React, { useRef, useCallback } from "react";
import { getLogsStream } from "../helpers/dockerService/serviceComponents/containerLogs";

/**
 * Hook that manages opening and closing a logs stream for a container.
 *
 * @returns {Object} { openLogs, closeLogs }
 */
export function useLogsStream() {
  const logsStreamRef = useRef(null);

  const openLogs = useCallback((containerId, setLogs) => {
    setLogs([]);
    logsStreamRef.current = getLogsStream(
      containerId,
      (data) => setLogs((prev) => ([...prev, ...data.split("\n").filter(Boolean)])),
      () => {},
      (err) => setLogs((prev) => ([...prev, `Error: ${err.message}`]))
    );
  }, []);

  const closeLogs = useCallback(() => {
    if (logsStreamRef.current) {
      logsStreamRef.current.destroy?.();
      logsStreamRef.current = null;
    }
  }, []);

  return { openLogs, closeLogs };
}
