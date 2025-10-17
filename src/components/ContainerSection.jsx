import React from "react";
import { Text } from "ink";
import ContainerList from "./ContainerList.jsx";
import PropTypes from 'prop-types';

/**
 * Section that displays the list of containers or a message when none exist.
 *
 * @param {Object} props
 * @param {Array<Object>} props.containers - Array of container objects to display
 * @param {number} [props.selected] - Index of the currently selected container
 * @returns {JSX.Element}
 */
export default function ContainerSection({ containers, selected }) {
  if (!containers || containers.length === 0) {
    return <Text>No containers found</Text>;
  }
  return <ContainerList containers={containers} selected={selected} />;
}

ContainerSection.propTypes = {
  containers: PropTypes.array.isRequired,
  selected: PropTypes.number,
};
