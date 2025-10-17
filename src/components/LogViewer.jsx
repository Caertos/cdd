import React from "react";
import { Text, useInput } from "ink";
import { safeCall } from "../helpers/safeCall";
import PropTypes from 'prop-types';

/**
 * Log viewer overlay component. Shows the most recent lines and closes on ESC.
 *
 * @param {Object} props
 * @param {Array<string>} props.logs - Array of log lines
 * @param {Function} [props.onExit] - Optional callback when the viewer closes
 * @param {Object} [props.container] - Optional container metadata (used for title)
 * @returns {JSX.Element}
 */
export default function LogViewer({ logs, onExit, container }) {
  useInput((input, key) => {
    if (key.escape) {
      safeCall(onExit);
    }
  });

  const visibleLogs = logs.slice(-15);

  return (
    <>
      <Text color="green">{container?.name ?? "Container"} logs, press ESC to exit</Text>
      {visibleLogs.length === 0 ? (
        <Text dimColor>No logs...</Text>
      ) : (
        visibleLogs.map((line, idx) => <Text key={idx}>{line}</Text>)
      )}
    </>
  );
}

LogViewer.propTypes = {
  logs: PropTypes.arrayOf(PropTypes.string).isRequired,
  onExit: PropTypes.func,
  container: PropTypes.object,
};
