/**
 * List component for Docker containers.
 *
 * @component
 * @param {Object} props - Component props
 * @param {Array} props.containers - Containers to display
 * @param {number} [props.selected] - Index of the currently selected container
 * @param {Map} [props.health] - Health verdicts keyed by container id
 * @param {boolean} [props.isStale=false] - Whether the data is potentially outdated
 * @param {number} [props.availableRows] - Rows the terminal can show; omit to render every row
 * @returns {JSX.Element} Rendered list
 */
import React from 'react';
import PropTypes from 'prop-types';
import { Box, Text } from 'ink';
import ContainerRow from './ContainerRow.jsx';
import { useVisibleWindow } from '../hooks/useVisibleWindow.js';
import { useSharedContainerStats } from '../hooks/useSharedContainerStats.js';
import { STRINGS } from '../helpers/strings.js';

export default function ContainerList({
  containers,
  selected,
  health,
  isStale = false,
  availableRows,
}) {
  const total = containers.length;
  // Without a height budget the whole list is visible (current behaviour).
  const budget = Number.isFinite(availableRows) ? availableRows : total;
  const { offset, visibleCount, hiddenAbove, hiddenBelow } = useVisibleWindow({
    total,
    selectedIndex: selected ?? -1,
    availableRows: budget,
  });

  // Only the rows actually on screen are polled (D10): the shared hook gets
  // the visible slice, never the full list.
  const windowed = containers.slice(offset, offset + visibleCount);
  const { stats, errors } = useSharedContainerStats(windowed);

  return (
    <>
      {hiddenAbove > 0 ? (
        <Box flexDirection="row" paddingLeft={1}>
          <Text dimColor>{STRINGS.listWindow.moreAbove(hiddenAbove)}</Text>
        </Box>
      ) : null}
      {windowed.map((container, i) => {
        const iGlobal = offset + i;
        return (
          <Box key={container.id} flexDirection="row" paddingLeft={1}>
            <ContainerRow
              container={container}
              verdict={health?.get(container.id)}
              isSelected={iGlobal === selected}
              isStale={isStale}
              stats={stats.get(container.id)}
              statsError={errors.get(container.id)}
            />
          </Box>
        );
      })}
      {hiddenBelow > 0 ? (
        <Box flexDirection="row" paddingLeft={1}>
          <Text dimColor>{STRINGS.listWindow.moreBelow(hiddenBelow)}</Text>
        </Box>
      ) : null}
    </>
  );
}

ContainerList.propTypes = {
  containers: PropTypes.arrayOf(PropTypes.object).isRequired,
  selected: PropTypes.number,
  health: PropTypes.object,
  isStale: PropTypes.bool,
  availableRows: PropTypes.number,
};
