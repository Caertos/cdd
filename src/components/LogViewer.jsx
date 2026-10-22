import React from 'react';
import { Box, Text } from 'ink';
import PropTypes from 'prop-types';
import { STRINGS } from '../helpers/strings.js';
import { sanitizeTerminalText } from '../helpers/sanitizeTerminalText.js';

/**
 * Log viewer panel. Shows a window onto the log inside a bordered box that
 * reserves its rows in the layout, so the frame never grows to the terminal
 * height and makes Ink stack a copy per redraw.
 * Purely presentational — keyboard handling is centralized in useControls.
 *
 * @param {Object} props
 * @param {Array<string>} props.logs - Array of log lines
 * @param {Function} [props.onExit] - Optional callback when the viewer closes
 * @param {Object} [props.container] - Optional container metadata (used for title)
 * @param {number} [props.height=15] - Lines shown at once
 * @returns {JSX.Element}
 */
export default function LogViewer({ logs, onExit: _onExit, container, height = 15 }) {
  const visibleLogs = logs.slice(-height);

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="green"
      paddingX={1}
    >
      <Text color="green">
        {STRINGS.logsTitle(sanitizeTerminalText(container?.name))}
      </Text>
      {visibleLogs.length === 0 ? (
        <Text dimColor>{STRINGS.noLogs}</Text>
      ) : (
        // The log is written by the container, not by CDD: its escape
        // sequences are sanitised away before Ink writes them to the screen.
        // wrap="truncate" keeps one log line on one row, so the panel never
        // grows past the rows reserved for it.
        visibleLogs.map((line, idx) => (
          <Text key={idx} wrap="truncate">
            {sanitizeTerminalText(line)}
          </Text>
        ))
      )}
    </Box>
  );
}

LogViewer.propTypes = {
  logs: PropTypes.arrayOf(PropTypes.string).isRequired,
  onExit: PropTypes.func,
  container: PropTypes.object,
  height: PropTypes.number,
};
