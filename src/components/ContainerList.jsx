/**
 * List component for Docker containers.
 *
 * @component
 * @param {Object} props - Component props
 * @param {Array} props.containers - Containers to display
 * @param {number} [props.selected] - Index of the currently selected container
 * @param {boolean} [props.isStale=false] - Whether the data is potentially outdated
 * @returns {JSX.Element} Rendered list
 */
import React from 'react';
import PropTypes from 'prop-types';
import { Box } from 'ink';
import ContainerRow from './ContainerRow.jsx';

export default function ContainerList({
  containers,
  selected,
  isStale = false,
}) {
  return (
    <>
      {containers.map((container, i) => (
        <Box key={container.id} flexDirection="row" paddingLeft={1}>
          <ContainerRow
            container={container}
            isSelected={i === selected}
            isStale={isStale}
          />
        </Box>
      ))}
    </>
  );
}

ContainerList.propTypes = {
  containers: PropTypes.arrayOf(PropTypes.object).isRequired,
  selected: PropTypes.number,
  isStale: PropTypes.bool,
};
