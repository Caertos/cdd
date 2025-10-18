/**
 * Main React component for the CDD CLI UI.
 * Handles container listing, action feedback, optional creation prompt,
 * and renders the live debug log panel (toggle with the D shortcut).
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
        {controls.showDebugLogs && (
          <Box marginTop={1} flexDirection="column" borderStyle="round" borderColor="gray" padding={1}>
            <Text color="cyan">Debug log — press D or ESC to close</Text>
            {controls.debugLogs.length === 0 ? (
              <Text dimColor>No debug entries yet. Run with CDD_LOG_LEVEL=debug for verbose output.</Text>
            ) : (
              controls.debugLogs.slice(-15).map((line, idx) => (
                <Text key={idx} color="gray">{line}</Text>
              ))
            )}
          </Box>
        )}
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
