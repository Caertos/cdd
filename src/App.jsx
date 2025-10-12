import React from "react";
import { useState, useEffect } from "react";
import { Box, Text, Spacer } from "ink";
import { getContainers } from "./dockerService";
import ContainerRow from "./components/ContainerRow";
import Header from "./components/Header";

export default function App() {
  const [containers, setContainers] = useState([]);

  useEffect(() => {
    const fetch = async () => setContainers(await getContainers());
    fetch();
    const timer = setInterval(fetch, 3000);
    return () => clearInterval(timer);
  }, []);

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
