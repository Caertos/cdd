import React from 'react';
import { Box, Text } from 'ink';
import ContainerList from './ContainerList.jsx';
import { EmptyState } from './EmptyState.jsx';
import PropTypes from 'prop-types';
import { STRINGS } from '../helpers/strings.js';

/**
 * Section that displays the list of containers or a message when none exist.
 *
 * @param {Object} props
 * @param {Array<Object>} props.containers - Containers to display (already filtered and ordered)
 * @param {number} [props.selected] - Index of the currently selected container
 * @param {Map} [props.health] - Health verdicts keyed by container id
 * @param {'connecting'|'ok'|'error'} [props.connectionStatus] - Docker connection status
 * @param {boolean} [props.isStale=false] - Whether the data is potentially outdated
 * @param {string} [props.query] - Active filter text, '' when none
 * @param {number} [props.totalCount] - Containers before filtering, for the no-match line
 * @param {Function} [props.onCreate] - Open the creation wizard
 * @returns {JSX.Element}
 */
export default function ContainerSection({
  containers,
  selected,
  health,
  connectionStatus,
  isStale = false,
  query = '',
  totalCount = 0,
  onCreate,
}) {
  if (!containers || containers.length === 0) {
    // A query that matched nothing is not "no containers": they are there and
    // the filter just hid them. Falling into EmptyState here would offer to
    // create a container that already exists, so it gets its own state with a
    // way out (§3.1, §4).
    if (query.trim()) {
      return (
        <Box flexDirection="column" paddingLeft={1}>
          <Text color="yellow">
            {STRINGS.filter.noMatch(totalCount, query)}
          </Text>
          <Text dimColor>{STRINGS.filter.noMatchHint}</Text>
        </Box>
      );
    }
    if (connectionStatus === 'ok') {
      return <EmptyState onCreate={onCreate} />;
    }
    return <Text>{STRINGS.noContainers}</Text>;
  }
  return (
    <ContainerList
      containers={containers}
      selected={selected}
      health={health}
      isStale={isStale}
    />
  );
}

ContainerSection.propTypes = {
  containers: PropTypes.array.isRequired,
  selected: PropTypes.number,
  health: PropTypes.object,
  connectionStatus: PropTypes.string,
  isStale: PropTypes.bool,
  query: PropTypes.string,
  totalCount: PropTypes.number,
  onCreate: PropTypes.func,
};
