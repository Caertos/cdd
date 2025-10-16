/**
 * List component for Docker containers.
 * Componente de lista para contenedores Docker.
 *
 * @component
 * @param {Object} props - Component props / Props del componente
 * @param {Array} props.containers - Containers to display / Contenedores a mostrar
 * @returns {JSX.Element} Rendered list / Lista renderizada
 * @example
 * // EN: Render with containers
 * // ES: Renderizar con contenedores
 * <ContainerList containers={containers} />
 */
import React from "react";
import { Box, Text } from "ink";
import ContainerRow from "./ContainerRow";

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
