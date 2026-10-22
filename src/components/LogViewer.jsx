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
 * @param {number} [props.scrollOffset=0] - Lines scrolled up from the newest
 * @param {boolean} [props.following=true] - Whether new lines pull the view down
 * @param {number} [props.pending=0] - Lines that arrived while paused
 * @returns {JSX.Element}
 */
export default function LogViewer({
  logs,
  onExit: _onExit,
  container,
  height = 15,
  scrollOffset = 0,
  following = true,
  pending = 0,
}) {
  // Clamp here too: a burst of lines or a trimmed buffer must never leave the
  // window past either end.
  const maxOffset = Math.max(0, logs.length - height);
  const offset = Math.min(Math.max(0, scrollOffset), maxOffset);
  const end = logs.length - offset;
  const start = Math.max(0, end - height);
  const visibleLogs = logs.slice(start, end);

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="green"
      paddingX={1}
    >
      <Text color="green">
        {STRINGS.logsTitle(sanitizeTerminalText(container?.name))}
        {following ? '' : STRINGS.logsPaused(pending)}
      </Text>
      {visibleLogs.length === 0 ? (
        <Text dimColor>{STRINGS.noLogs}</Text>
      ) : (
        // The log is written by the container, not by CDD: its escape
        // sequences are sanitised away before Ink writes them to the screen.
        // wrap="truncate" keeps one log line on one row, so the panel never
        // grows past the rows reserved for it.
        visibleLogs.map((line, idx) => (
          <Text key={start + idx} wrap="truncate">
            {sanitizeTerminalText(line)}
          </Text>
        ))
      )}
      <Text dimColor wrap="truncate">
        {STRINGS.logsHint}
      </Text>
    </Box>
  );
}

LogViewer.propTypes = {
  logs: PropTypes.arrayOf(PropTypes.string).isRequired,
  onExit: PropTypes.func,
  container: PropTypes.object,
  height: PropTypes.number,
  scrollOffset: PropTypes.number,
  following: PropTypes.bool,
  pending: PropTypes.number,
};
