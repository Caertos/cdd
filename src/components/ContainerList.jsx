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
import { Box, Text } from "ink";
import ContainerRow from "./ContainerRow.jsx";

export default function ContainerList({ containers, selected }) {
  return (
    <>
      {containers.map((container, i) => (
        <Box key={container.id} flexDirection="row" alignItems="flex-start">
          <Box width={2} minWidth={2} justifyContent="flex-end">
            <Text color={i === selected ? "green" : undefined}>
              {i === selected ? "➤" : "  "}
            </Text>
          </Box>
          <Box flexGrow={1} paddingLeft={1}>
            <ContainerRow container={container} isSelected={i === selected} />
          </Box>
        </Box>
      ))}
    </>
  );
}

ContainerList.propTypes = {
  containers: PropTypes.arrayOf(PropTypes.object).isRequired,
  selected: PropTypes.number,
};
