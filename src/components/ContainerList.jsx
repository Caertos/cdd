/**
 * List component for Docker containers.
 *
 * @component
 * @param {Object} props - Component props
 * @param {Array} props.containers - Containers to display
 * @returns {JSX.Element} Rendered list
 * @example
 * // Render with containers
 * <ContainerList containers={containers} />
 */
import React from "react";
import PropTypes from 'prop-types';
import { Box } from "ink";
import ContainerRow from "./ContainerRow.jsx";

export default function ContainerList({ containers, selected }) {
  return (
    <>
      {containers.map((container, i) => (
        <Box key={container.id} flexDirection="row" paddingLeft={1}>
          <ContainerRow container={container} isSelected={i === selected} />
        </Box>
      ))}
    </>
  );
}

ContainerList.propTypes = {
  containers: PropTypes.arrayOf(PropTypes.object).isRequired,
  selected: PropTypes.number,
};
