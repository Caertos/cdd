import React from 'react';
import { Box, Text } from 'ink';
import chalk from 'chalk';
import PropTypes from 'prop-types';
import { getAppVersion } from '../helpers/appInfo.js';
import { STRINGS } from '../helpers/strings.js';

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
}) {
  const formattedVersion = VERSION === 'unknown' ? 'unknown' : `v${VERSION}`;
  const summary = query.trim()
    ? STRINGS.filter.summary(visibleCount, totalCount, query)
    : STRINGS.containerFound(totalCount);

  return (
    <Box justifyContent="space-between">
      <Text color="cyanBright">
        🐳 {chalk.bold('CDD')}
        <Text color="gray"> — CLI Docker Dashboard</Text>
      </Text>
      <Box flexDirection="column" alignItems="flex-end">
        <Text color="gray">{formattedVersion}</Text>
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
};
