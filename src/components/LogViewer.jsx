import React from 'react';
import { withKeys } from '../helpers/listKeys.js';
import { Box, Text } from 'ink';
import PropTypes from 'prop-types';
import { STRINGS } from '../helpers/strings.js';
import { sanitizeTerminalText } from '../helpers/sanitizeTerminalText.js';
import { splitHighlight } from '../helpers/logSearch.js';
import { PromptField } from './PromptField.jsx';

/**
 * Log viewer panel. Shows a window onto the log, a header that says whether
 * it is following, and a last row that is either the hint or the search.
 * Purely presentational — keyboard handling is centralized in useControls.
 *
 * @param {Object} props
 * @param {Array<string>} props.logs - The lines to draw (already filtered when the filter is on)
 * @param {Function} [props.onExit] - Optional callback when the viewer closes
 * @param {Object} [props.container] - Optional container metadata (used for title)
 * @param {number} [props.height=15] - Lines shown at once
 * @param {number} [props.scrollOffset=0] - Lines scrolled up from the newest
 * @param {boolean} [props.following=true] - Whether new lines pull the view down
 * @param {number} [props.pending=0] - Lines that arrived while paused
 * @param {Object} [props.search] - { open, query, cursor, filter, matchCount, matchPos }
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
  search,
}) {
  // Clamp here too: a burst of lines or a trimmed buffer must never leave the
  // window past either end.
  const maxOffset = Math.max(0, logs.length - height);
  const offset = Math.min(Math.max(0, scrollOffset), maxOffset);
  const end = logs.length - offset;
  const start = Math.max(0, end - height);
  const visibleLogs = logs.slice(start, end);
  const query = search?.query ?? '';

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
        <Text dimColor>
          {query ? STRINGS.logsMatches(0, -1) : STRINGS.noLogs}
        </Text>
      ) : (
        // The log is written by the container, not by CDD: its escape
        // sequences are sanitised away before Ink writes them to the screen.
        // wrap="truncate" keeps one log line on one row, so the panel never
        // grows past the rows reserved for it.
        withKeys(visibleLogs).map(({ item: line, key }) => (
          <Text key={key} wrap="truncate">
            {highlighted(sanitizeTerminalText(line), query)}
          </Text>
        ))
      )}
      <Footer search={search} />
    </Box>
  );
}

/** The line, with the matches of the query inverted. */
function highlighted(line, query) {
  if (!query) return line;
  return withKeys(
    splitHighlight(line, query),
    (part) => `${part.match}:${part.text}`
  ).map(({ item: part, key }) =>
    part.match ? (
      <Text key={key} inverse>
        {part.text}
      </Text>
    ) : (
      part.text
    )
  );
}

/** The last row: the search field and its counters, or the key hint. */
function Footer({ search }) {
  if (search?.open) {
    return (
      <Box columnGap={2}>
        <PromptField
          label={STRINGS.logsSearchLabel}
          value={sanitizeTerminalText(search.query)}
          cursor={search.cursor}
        />
        <Text dimColor wrap="truncate">
          {STRINGS.logsMatches(search.matchCount, search.matchPos)}
          {'  '}
          {STRINGS.logsSearchKeys(true, search.filter)}
        </Text>
      </Box>
    );
  }
  if (search?.query) {
    return (
      <Text dimColor wrap="truncate">
        {`/${sanitizeTerminalText(search.query)}  `}
        {STRINGS.logsMatches(search.matchCount, search.matchPos)}
        {'  '}
        {STRINGS.logsSearchKeys(false, search.filter)}
      </Text>
    );
  }
  return (
    <Text dimColor wrap="truncate">
      {STRINGS.logsHint}
    </Text>
  );
}

Footer.propTypes = {
  search: PropTypes.object,
};

LogViewer.propTypes = {
  logs: PropTypes.arrayOf(PropTypes.string).isRequired,
  onExit: PropTypes.func,
  container: PropTypes.object,
  height: PropTypes.number,
  scrollOffset: PropTypes.number,
  following: PropTypes.bool,
  pending: PropTypes.number,
  search: PropTypes.object,
};
