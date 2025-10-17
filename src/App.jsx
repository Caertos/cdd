/**
 * Main React component for the CDD CLI UI.
 *
 * @component
 * @returns {JSX.Element} The rendered app
 * @example
 * // Render the app
 * <App />
 */
import React from "react";
import { Box, Text, Spacer } from "ink";
import { useContainers } from "./hooks/useContainers.js";
import { useControls } from "./hooks/useControls.js";
import ContainerSection from "./components/ContainerSection.jsx";
import MessageFeedback from "./components/MessageFeedback.jsx";
import Header from "./components/Header.jsx";
import LogViewer from "./components/LogViewer.jsx";
import ContainerCreationPrompt from "./components/ContainerCreationPrompt.jsx";
import UsageMenu from "./components/UsageMenu.jsx";
import Footer from "./components/Footer.jsx";

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
