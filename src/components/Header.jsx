import React from 'react';
import { Box, Text } from 'ink';
import chalk from 'chalk';
import PropTypes from 'prop-types';
import { getAppVersion } from '../helpers/appInfo.js';
import { STRINGS } from '../helpers/strings.js';
import { sanitizeTerminalText } from '../helpers/sanitizeTerminalText.js';

/**
 * Header component displayed at the top of the CLI UI.
 *
 * Owns the whole list summary — how many are shown of how many, the active
 * filter and the active order — so it is never split across components
 * (TASK-9 §4). The order stays on its own yellow line so a reordered list has
 * a visible reason.
 *
 * @component
 * @param {Object} props
 * @param {number} props.visibleCount - Rows shown (after filter and sort)
 * @param {number} props.totalCount - Rows before filtering
 * @param {string} [props.query] - Active filter text, '' when none
 * @param {string} [props.sortMode] - Active sort mode shown under the counter
 * @param {{ status: string, latest: string|null }} [props.update] - Update
 *   state from useUpdateCheck; the badge only shows for 'available'/'failed'
 * @returns {JSX.Element}
 * @example
 * <Header visibleCount={12} totalCount={25} query="pg" sortMode="state" />
 */

const VERSION = getAppVersion();

export default function Header({
  visibleCount = 0,
  totalCount = 0,
  query = '',
  sortMode,
  update,
}) {
  const formattedVersion = VERSION === 'unknown' ? 'unknown' : `v${VERSION}`;
  // The badge shares the version's own line so the header never gains a row
  // (reservedRows would have to change otherwise). `latest` already passed
  // isValidVersion inside checkForUpdate, so it needs no sanitising here.
  const showUpdate =
    update?.latest &&
    (update.status === 'available' || update.status === 'failed');
  const summary = query.trim()
    ? STRINGS.filter.summary(
        visibleCount,
        totalCount,
        sanitizeTerminalText(query)
      )
    : STRINGS.containerFound(totalCount);

  return (
    <Box justifyContent="space-between">
      <Text color="cyanBright">
        🐳 {chalk.bold('CDD')}
        <Text color="gray"> — CLI Docker Dashboard</Text>
      </Text>
      <Box flexDirection="column" alignItems="flex-end">
        <Text color="gray">
          {formattedVersion}
          {showUpdate && (
            <Text color="yellow"> · {STRINGS.update.badge(update.latest)}</Text>
          )}
        </Text>
        <Text color="gray">{summary}</Text>
        {sortMode && (
          <Text color="yellow">{STRINGS.sortMode[sortMode] ?? sortMode}</Text>
        )}
      </Box>
    </Box>
  );
}

Header.propTypes = {
  visibleCount: PropTypes.number,
  totalCount: PropTypes.number,
  query: PropTypes.string,
  sortMode: PropTypes.string,
  update: PropTypes.shape({
    status: PropTypes.string,
    latest: PropTypes.string,
  }),
};
