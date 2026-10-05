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
import React, { useEffect } from 'react';
import { Box, Text, Spacer, useApp } from 'ink';
import { setSuspendTerminal } from './helpers/appState.js';
import { useContainers } from './hooks/useContainers.js';
import { useContainerHealth } from './hooks/useContainerHealth.js';
import { useDiagnostics } from './hooks/useDiagnostics.js';
import { useControls } from './hooks/useControls.js';
import { useDockerLauncher } from './hooks/useDockerLauncher.js';
import ContainerSection from './components/ContainerSection.jsx';
import MessageFeedback from './components/MessageFeedback.jsx';
import Header from './components/Header.jsx';
import LogViewer from './components/LogViewer.jsx';
import ContainerCreationPrompt from './components/ContainerCreationPrompt.jsx';
import { DiagnosticPanel } from './components/DiagnosticPanel.jsx';
import { KeyHUD } from './components/KeyHUD.jsx';
import { HelpPanel } from './components/HelpPanel.jsx';
import { ConnectionNotice } from './components/ConnectionNotice.jsx';
import Footer from './components/Footer.jsx';
import { STRINGS } from './helpers/strings.js';

export default function App() {
  const { suspendTerminal } = useApp();
  const { containers, connection } = useContainers();
  const { health } = useContainerHealth(containers);
  const launcher = useDockerLauncher();
  const controls = useControls(containers, { connection, launcher });

  const selectedContainer = containers[controls.selected] ?? null;
  const diagnostics = useDiagnostics(
    selectedContainer,
    selectedContainer ? (health.get(selectedContainer.id) ?? null) : null
  );

  // Expose suspendTerminal to plain helpers (terminalHandover) via appState.
  useEffect(() => {
    setSuspendTerminal(suspendTerminal);
    return () => setSuspendTerminal(null);
  }, [suspendTerminal]);

  // When the daemon answers after a launch, re-probe and reload the list.
  useEffect(() => {
    if (launcher.status === 'ready') {
      connection.retry();
      launcher.reset();
    }
  }, [launcher.status, connection.retry, launcher.reset]);

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
        launcher={launcher}
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
          <Text color="yellow">
            {'⚠ '}
            {STRINGS.connection.staleWarning}
          </Text>
        )}
        <ContainerSection
          containers={containers}
          selected={controls.selected}
          health={health}
          connectionStatus={connection.status}
          isStale={connection.isStale}
          onCreate={() => controls.startCreation()}
        />
        {/* The panel takes room only when a container is failing and we have
            something to say about it — a deliberate stop gets nothing. */}
        {(diagnostics.diagnosis || diagnostics.isLoading) && (
          <DiagnosticPanel
            diagnosis={diagnostics.diagnosis}
            containerName={selectedContainer?.name ?? ''}
            isLoading={diagnostics.isLoading}
          />
        )}
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
            <Text color="cyan">{STRINGS.debugTitle}</Text>
            {controls.debugLogs.length === 0 ? (
              <Text dimColor>{STRINGS.debugEmpty}</Text>
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
