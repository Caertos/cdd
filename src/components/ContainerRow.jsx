import React from 'react';
import { Box, Text } from 'ink';
import StatsBar from './StatsBar.jsx';
import PropTypes from 'prop-types';
import { useContainerStats } from '../hooks/useContainerStats.js';
import { STRINGS } from '../helpers/strings.js';

const stateText = (state) => {
  if (state === 'running')
    return { text: STRINGS.stateRunning, color: 'green' };
  if (state === 'exited') return { text: STRINGS.stateExited, color: 'red' };
  if (state === 'paused') return { text: STRINGS.statePaused, color: 'yellow' };
  return { text: state.toUpperCase(), color: 'gray' };
};

/**
 * Row component that renders information and live stats for a container.
 *
 * @param {Object} props
 * @param {Object} props.container - Container object with id, name, image, state and ports
 * @param {boolean} [props.isStale=false] - Whether the data is potentially outdated
 * @returns {JSX.Element}
 */
export default function ContainerRow({
  container,
  isSelected = false,
  isStale = false,
}) {
  const { id, name, image, state } = container;
  const { stats, statsError } = useContainerStats(id, state);

  const formatPorts = (ports) => {
    if (!ports || ports.length === 0) return '';
    if (Array.isArray(ports)) {
      return ports.map((p, _i) => `🔗 ${p}`).join('  ');
    }
    return `🔗 ${ports}`;
  };

  const truncate = (s, max = 20) => {
    if (!s) return '';
    return s.length > max ? s.slice(0, max - 1) + '…' : s;
  };

  const stateInfo = stateText(state);
  const dimColor = isStale ? 'gray' : undefined;

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box flexDirection="row" alignItems="center">
        <Box width={2} minWidth={2} justifyContent="flex-end" paddingRight={1}>
          <Text color={isSelected ? 'green' : undefined}>
            {isSelected ? '➤' : '  '}
          </Text>
        </Box>
        <Box width={18} flexShrink={1} paddingRight={1}>
          <Text color="cyan" dimColor={dimColor}>
            {truncate(name, 18)}
          </Text>
        </Box>
        <Box width={18} flexShrink={1} paddingRight={1}>
          <Text color="gray" dimColor={dimColor}>
            {truncate(image, 18)}
          </Text>
        </Box>
        <Box width={14} minWidth={12} paddingRight={1}>
          <Text color={stateInfo.color} dimColor={dimColor}>
            {stateInfo.text}
          </Text>
        </Box>
        <Box flexGrow={1} flexShrink={1} paddingLeft={0} paddingRight={1}>
          <Text color="yellow" dimColor={dimColor}>
            {formatPorts(container.ports)}
          </Text>
        </Box>
        <Box flexShrink={0} paddingLeft={1}>
          {state === 'running' ? (
            <StatsBar
              cpu={parseFloat(stats.cpuPercent)}
              mem={parseFloat(stats.memPercent)}
            />
          ) : null}
        </Box>
      </Box>
      {statsError && <Text color="red">{statsError}</Text>}
    </Box>
  );
}

ContainerRow.propTypes = {
  container: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    image: PropTypes.string,
    state: PropTypes.string,
    ports: PropTypes.oneOfType([PropTypes.array, PropTypes.string]),
  }).isRequired,
  isSelected: PropTypes.bool,
  isStale: PropTypes.bool,
};
