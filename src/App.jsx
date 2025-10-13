import React from "react";
import { Box, Text, Spacer } from "ink";
import { useContainers } from "./hooks/useContainers";
import ContainerRow from "./components/ContainerRow";
import Header from "./components/Header";

export default function App() {
  const { containers } = useContainers();

  return (
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor="cyan"
        padding={1}
      >
        <Header count={containers.length} />
        <Text> </Text>
        {containers.length === 0 ? (
          <Text>No containers found</Text>
        ) : (
          containers.map((container) => (
            <ContainerRow key={container.id} container={container} />
          ))
        )}
        <Spacer />
        <Box marginTop={1}>
          <Text dimColor>Press Ctrl+C to exit</Text>
        </Box>
        <Text dimColor>Crafted by Carlos Cochero • 2025</Text>
      </Box>
  );
}
