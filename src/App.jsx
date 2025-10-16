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
import ContainerSection from "./components/ContainerSection";
import MessageFeedback from "./components/MessageFeedback";
import Header from "./components/Header";
import LogViewer from "./components/LogViewer";
import ContainerCreationPrompt from "./components/ContainerCreationPrompt";
import UsageMenu from "./components/UsageMenu";
import Footer from "./components/Footer";

export default function App() {
  const { containers } = useContainers();
  const controls = useControls(containers);

  if (controls.creatingContainer) {
    return (
      <ContainerCreationPrompt
        step={controls.creationStep}
        imageName={controls.imageNameInput}
        containerName={controls.containerNameInput}
        portInput={controls.portInput}
        envInput={controls.envInput}
        message={controls.message}
        messageColor={controls.messageColor}
      />
    );
  }

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
        <ContainerSection containers={containers} selected={controls.selected} />
        <Spacer />
        <MessageFeedback message={controls.message} color={controls.messageColor} />
        <UsageMenu />
        <Footer />
      </Box>
      {controls.showLogs && (
        <LogViewer
          logs={controls.logs}
          onExit={controls.exitLogs}
          container={containers[controls.selected]}
        />
      )}
    </>
  );
}
