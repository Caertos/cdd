import React from 'react';
import { Text } from 'ink';
import PropTypes from 'prop-types';
import { STRINGS } from '../helpers/strings.js';
import { sanitizeTerminalText } from '../helpers/sanitizeTerminalText.js';

/**
 * Log viewer overlay component. Shows the most recent lines.
 * Purely presentational — keyboard handling is centralized in useControls.
 *
 * @param {Object} props
 * @param {Array<string>} props.logs - Array of log lines
 * @param {Function} [props.onExit] - Optional callback when the viewer closes
 * @param {Object} [props.container] - Optional container metadata (used for title)
 * @returns {JSX.Element}
 */
export default function LogViewer({ logs, onExit: _onExit, container }) {
  const visibleLogs = logs.slice(-15);

  return (
    <>
      <Text color="green">
        {STRINGS.logsTitle(sanitizeTerminalText(container?.name))}
      </Text>
      {visibleLogs.length === 0 ? (
        <Text dimColor>{STRINGS.noLogs}</Text>
      ) : (
        // The log is written by the container, not by CDD: its escape
        // sequences are sanitised away before Ink writes them to the screen.
        visibleLogs.map((line, idx) => (
          <Text key={idx}>{sanitizeTerminalText(line)}</Text>
        ))
      )}
    </>
  );
}

LogViewer.propTypes = {
  logs: PropTypes.arrayOf(PropTypes.string).isRequired,
  onExit: PropTypes.func,
  container: PropTypes.object,
};
