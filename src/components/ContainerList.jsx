import React from "react";
import { Box, Text } from "ink";
import ContainerRow from "./ContainerRow";

export default function ContainerList({ containers, selected }) {
  return (
    <>
      {containers.map((container, i) => (
        <Box key={container.id} flexDirection="row" alignItems="center">
          <Text color={i === selected ? "green" : undefined}>
            {i === selected ? "➤" : "  "}
          </Text>
          <ContainerRow container={container} isSelected={i === selected} />
        </Box>
      ))}
    </>
  );
}
