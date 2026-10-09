import React from 'react';
import { Box, Text } from 'ink';
import StatsBar from './StatsBar.jsx';
import PropTypes from 'prop-types';
import { STRINGS } from '../helpers/strings.js';
import { levelStyle } from '../helpers/health.js';

const stateText = (state) => {
  if (!state || typeof state !== 'string') {
    return { text: STRINGS.health.unknown, color: 'gray' };
  }
  if (state === 'running')
    return { text: STRINGS.stateRunning, color: 'green' };
  if (state === 'exited') return { text: STRINGS.stateExited, color: 'red' };
  if (state === 'paused') return { text: STRINGS.statePaused, color: 'yellow' };
  return { text: state.toUpperCase(), color: 'gray' };
};

const verdictText = (verdict) => {
  const { symbol, color } = levelStyle(verdict.level);
  return { text: `${symbol} ${verdict.headline}`, color };
};

/**
 * Row component that renders information and live stats for a container.
 *
 * @param {Object} props
 * @param {Object} props.container - Container object with id, name, image, state and ports
 * @param {Object} [props.verdict] - Health verdict from useContainerHealth
 * @param {boolean} [props.isSelected=false] - Whether the row is selected
 * @param {boolean} [props.isStale=false] - Whether the data is potentially outdated
 * @param {Object} [props.stats] - Live stats for the row (from useSharedContainerStats)
 * @param {string} [props.statsError] - Stats error to show next to the state
 * @returns {JSX.Element}
 */
export default function ContainerRow({
  container,
  verdict,
  isSelected = false,
  isStale = false,
  stats = { cpuPercent: 0, memPercent: 0 },
  statsError = '',
}) {
  const { name, image, state } = container;

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

  const stateInfo = verdict ? verdictText(verdict) : stateText(state);
  const dimColor = isStale ? 'gray' : undefined;

  return (
    <Box flexDirection="row" alignItems="center">
      <Box width={2} minWidth={2} justifyContent="flex-end" paddingRight={1}>
        <Text color={isSelected ? 'green' : undefined} wrap="truncate-end">
          {isSelected ? '➤' : ' '}
        </Text>
      </Box>
      <Box width={19} flexShrink={0} paddingRight={1}>
        <Text color="cyan" dimColor={dimColor} wrap="truncate-end">
          {truncate(name, 18)}
        </Text>
      </Box>
      <Box width={18} flexShrink={1} paddingRight={1}>
        <Text color="gray" dimColor={dimColor} wrap="truncate-end">
          {truncate(image, 18)}
        </Text>
      </Box>
      <Box width={12} minWidth={12} paddingRight={1}>
        <Text color={stateInfo.color} dimColor={dimColor} wrap="truncate-end">
          {stateInfo.text}
          {statsError ? <Text color="red"> {statsError}</Text> : null}
        </Text>
      </Box>
      <Box flexGrow={1} flexShrink={1} paddingLeft={0} paddingRight={1}>
        <Text color="yellow" dimColor={dimColor} wrap="truncate-end">
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
  verdict: PropTypes.shape({
    code: PropTypes.string,
    level: PropTypes.string,
    headline: PropTypes.string,
    facts: PropTypes.object,
  }),
  isSelected: PropTypes.bool,
  isStale: PropTypes.bool,
  stats: PropTypes.shape({
    cpuPercent: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    memPercent: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  }),
  statsError: PropTypes.string,
};
