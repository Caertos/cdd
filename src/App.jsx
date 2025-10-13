/**
 * Main React component for the CDD CLI UI.
 * Componente principal de React para la UI del CLI CDD.
 *
 * @component
 * @returns {JSX.Element} The rendered app / La app renderizada
 * @example
 * // EN: Render the app
 * // ES: Renderizar la app
 * <App />
 */
import React from "react";
import { Box, Text, Spacer } from "ink";
import { useContainers } from "./hooks/useContainers";
import { useControls } from "./hooks/useControls";
import ContainerList from "./components/ContainerList";
import MessageFeedback from "./components/MessageFeedback";
import Header from "./components/Header";
import LogViewer from "./components/LogViewer";

export default function App() {
  const { containers } = useContainers();
  const { selected, message, messageColor, showLogs, logs, exitLogs } =
    useControls(containers);

  return (
    <>
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
          <ContainerList containers={containers} selected={selected} />
        )}
        <Spacer />
        <MessageFeedback message={message} color={messageColor} />
        <Text>Use ↑/↓ for navigation</Text>
        <Text>•I to initiate selected container</Text>
        <Text>•P to stop selected container</Text>
        <Text>•L to view logs of selected container</Text>
        <Text>•Q to quit</Text>
        <Box justifyContent="flex-end" width="100%">
          <Text dimColor>Crafted by Carlos Cochero • 2025</Text>
        </Box>
      </Box>
      {showLogs && (
        <LogViewer
          logs={logs}
          onExit={exitLogs}
          container={containers[selected]}
        />
      )}
    </>
  );
}
