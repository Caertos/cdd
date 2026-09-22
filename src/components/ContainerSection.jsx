import React from 'react';
import { Text } from 'ink';
import ContainerList from './ContainerList.jsx';
import { EmptyState } from './EmptyState.jsx';
import PropTypes from 'prop-types';
import { STRINGS } from '../helpers/strings.js';

/**
 * Section that displays the list of containers or a message when none exist.
 *
 * @param {Object} props
 * @param {Array<Object>} props.containers - Array of container objects to display
 * @param {number} [props.selected] - Index of the currently selected container
 * @param {'connecting'|'ok'|'error'} [props.connectionStatus] - Docker connection status
 * @param {boolean} [props.isStale=false] - Whether the data is potentially outdated
 * @param {Function} [props.onCreate] - Open the creation wizard
 * @returns {JSX.Element}
 */
export default function ContainerSection({
  containers,
  selected,
  connectionStatus,
  isStale = false,
  onCreate,
}) {
  if (!containers || containers.length === 0) {
    if (connectionStatus === 'ok') {
      return <EmptyState onCreate={onCreate} />;
    }
    return <Text>{STRINGS.noContainers}</Text>;
  }
  return (
    <ContainerList
      containers={containers}
      selected={selected}
      isStale={isStale}
    />
  );
}

ContainerSection.propTypes = {
  containers: PropTypes.array.isRequired,
  selected: PropTypes.number,
  connectionStatus: PropTypes.string,
  isStale: PropTypes.bool,
  onCreate: PropTypes.func,
};
