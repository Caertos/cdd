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
import React from 'react';
import { Box, Text, Spacer } from 'ink';
import { useContainers } from './hooks/useContainers.js';
import { useControls } from './hooks/useControls.js';
import ContainerSection from './components/ContainerSection.jsx';
import MessageFeedback from './components/MessageFeedback.jsx';
import Header from './components/Header.jsx';
import LogViewer from './components/LogViewer.jsx';
import ContainerCreationPrompt from './components/ContainerCreationPrompt.jsx';
import { KeyHUD } from './components/KeyHUD.jsx';
import { HelpPanel } from './components/HelpPanel.jsx';
import { ConnectionNotice } from './components/ConnectionNotice.jsx';
import Footer from './components/Footer.jsx';

export default function App() {
  const { containers, connection } = useContainers();
  const controls = useControls(containers, { connection });

  if (controls.creatingContainer) {
    return (
      <>
        <ContainerCreationPrompt
          step={controls.creationStep}
          imageName={controls.imageNameInput}
          containerName={controls.containerNameInput}
          portInput={controls.portInput}
          envInput={controls.envInput}
          cursors={controls.creation.cursors}
          message={controls.message}
          messageColor={controls.messageColor}
          suggestions={controls.creation.activeItems}
          selectedSuggestionIndex={controls.creation.selectedSuggestionIndex}
          visibleOffset={controls.creation.visibleOffset}
          isSearchingHub={controls.creation.isSearchingHub}
          hubResults={controls.creation.hubResults}
          hasSuggestedEnv={controls.creation.hasSuggestedEnv}
          confirmDiscard={controls.confirmDiscard}
          reviewRows={controls.creation.reviewRows}
          reviewWarnings={controls.creation.reviewWarnings}
          focusedReviewRow={controls.creation.focusedReviewRow}
          isLoadingPreview={controls.creation.isLoadingPreview}
          revealSecrets={controls.creation.revealSecrets}
        />
        {controls.showHelp && (
          <HelpPanel
            context={controls.context}
            bindings={controls.keymapBindings}
          />
        )}
      </>
    );
  }

  // Connection error with no cached data — show the connection screen
  if (connection.status === 'error' && containers.length === 0) {
    return (
      <ConnectionNotice
        error={connection.error}
        nextRetryIn={connection.nextRetryIn}
        onRetry={connection.retry}
        onExit={() => process.exit(0)}
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
        {connection.isStale && (
          <Text color="yellow">{'⚠ '}Lost connection to Docker — retrying</Text>
        )}
        <ContainerSection
          containers={containers}
          selected={controls.selected}
          connectionStatus={connection.status}
          isStale={connection.isStale}
          onCreate={() => controls.startCreation()}
        />
        <Spacer />
        <MessageFeedback
          message={controls.message}
          color={controls.messageColor}
        />
        <KeyHUD bindings={controls.keymapBindings} />
        {controls.showDebugLogs && (
          <Box
            marginTop={1}
            flexDirection="column"
            borderStyle="round"
            borderColor="gray"
            padding={1}
          >
            <Text color="cyan">Debug log — press D or ESC to close</Text>
            {controls.debugLogs.length === 0 ? (
              <Text dimColor>
                No debug entries yet. Run with CDD_LOG_LEVEL=debug for verbose
                output.
              </Text>
            ) : (
              controls.debugLogs.slice(-15).map((line, idx) => (
                <Text key={idx} color="gray">
                  {line}
                </Text>
              ))
            )}
          </Box>
        )}
        <Footer />
      </Box>
      {controls.showHelp && (
        <HelpPanel
          context={controls.context}
          bindings={controls.keymapBindings}
        />
      )}
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
