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
import { Text, useApp } from 'ink';
import { setSuspendTerminal } from './helpers/appState.js';
import { useContainers } from './hooks/useContainers.js';
import { useContainerHealth } from './hooks/useContainerHealth.js';
import { useControls } from './hooks/useControls.js';
import { useDockerLauncher } from './hooks/useDockerLauncher.js';
import { useUpdateCheck } from './hooks/useUpdateCheck.js';
import { useTerminalHeight } from './hooks/useTerminalHeight.js';
import {
  reservedRows,
  logViewLines,
  helpPanelRows,
  chromeRows,
  MIN_LIST_ROWS_WITH_DIAGNOSIS,
  HELP_CHROME_ROWS,
  COMPACT_ROWS,
} from './helpers/reservedRows.js';
import { AppShell } from './components/AppShell.jsx';
import { ViewTabs } from './components/ViewTabs.jsx';
import Header from './components/Header.jsx';
import ContainerCreationPrompt from './components/ContainerCreationPrompt.jsx';
import { KeyHUD } from './components/KeyHUD.jsx';
import { HelpPanel } from './components/HelpPanel.jsx';
import { ConnectionNotice } from './components/ConnectionNotice.jsx';
import Footer from './components/Footer.jsx';
import { ContainersView } from './views/ContainersView.jsx';
import { ProjectsView } from './views/ProjectsView.jsx';
import { ImagesView } from './views/ImagesView.jsx';

/**
 * Whether the diagnosis panel fits: it needs a failing container to talk
 * about, gives way to the logs and help panels, and leaves the list a few rows.
 */
function shouldShowDiagnosis(controls, connection, terminalRows, compact) {
  const wantsDiagnosis = Boolean(controls.diagnosis || controls.isDiagnosing);
  if (!wantsDiagnosis || controls.showLogs || controls.showHelp) return false;
  return (
    terminalRows -
      reservedRows({
        hasDiagnosis: true,
        showDebug: controls.showDebugLogs,
        isFiltering: controls.view.isFiltering,
        isStale: connection.isStale,
        hasMessage: Boolean(controls.message),
        compact,
      }) >=
    MIN_LIST_ROWS_WITH_DIAGNOSIS
  );
}

/**
 * @param {Object} [props]
 * @param {number} [props.rows] - Fixed terminal height; tests use it because a
 *   non-TTY run reports no height and would fall back to 24 rows.
 */
export default function App({ rows }) {
  const { suspendTerminal } = useApp();
  const { containers, connection } = useContainers();
  const { health, details } = useContainerHealth(containers);
  const launcher = useDockerLauncher();
  // NODE_ENV=test makes checkForUpdate skip the network, so the unit and e2e
  // suites never touch the registry (shouldSkipCheck).
  const updater = useUpdateCheck();
  // Terminal height feeds the container list's visible-window budget below.
  const terminalRows = useTerminalHeight(rows);
  // health goes in so useControls owns the one diagnosis the panel renders and
  // the F key acts on. Two hooks would mean reading the log twice.
  const controls = useControls(containers, {
    connection,
    launcher,
    health,
    details,
    updater,
  });

  // The shell drops its footer and padding on a short terminal; every row
  // count below has to know it.
  const compact = Number.isFinite(terminalRows) && terminalRows < COMPACT_ROWS;

  // Log lines the logs panel shows; the viewer is sized to the rows left.
  const logLines = logViewLines(terminalRows);
  const setLogsViewHeight = controls.setLogsViewHeight;
  useEffect(() => {
    setLogsViewHeight?.(logLines);
  }, [setLogsViewHeight, logLines]);

  // The diagnosis gives way to the logs panel while it is open: both answer
  // "why is this container failing", and together they would not fit. It also
  // stays out when the terminal is too short to leave the list a few rows:
  // a frame as tall as the terminal makes Ink stack a copy of it per redraw.
  const showDiagnosis = shouldShowDiagnosis(
    controls,
    connection,
    terminalRows,
    compact
  );

  // Help opens under the list, like the logs panel, and takes the logs
  // panel's place while it is open: both cannot fit, and the list is what the
  // help is about.
  const showHelpPanel = controls.showHelp && !controls.creatingContainer;
  const showLogsPanel = controls.showLogs && !showHelpPanel;
  const layout = {
    showDebug: controls.showDebugLogs,
    isFiltering: controls.view.isFiltering,
    isStale: connection.isStale,
    hasMessage: Boolean(controls.message),
    compact,
  };
  const helpRows = showHelpPanel
    ? helpPanelRows(
        terminalRows,
        controls.helpBindings.length,
        reservedRows(layout)
      )
    : 0;

  // The logs panel replaces the list, so the list's rows do not count it.
  const availableRows = Math.max(
    1,
    terminalRows -
      reservedRows({
        ...layout,
        hasDiagnosis: showDiagnosis,
        helpRows,
      })
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

  // Connection error with no cached data — show the connection screen. The
  // wizard is checked first: an open wizard stays in the shell.
  if (
    !controls.creatingContainer &&
    connection.status === 'error' &&
    containers.length === 0
  ) {
    return (
      <ConnectionNotice
        error={connection.error}
        nextRetryIn={connection.nextRetryIn}
        launcher={launcher}
      />
    );
  }

  let viewContent;
  if (controls.creatingContainer) {
    viewContent = controls.showHelp ? (
      <HelpPanel
        context={controls.helpContext}
        bindings={controls.helpBindings}
        maxRows={Math.max(HELP_CHROME_ROWS + 1, terminalRows - chromeRows(terminalRows))}
      />
    ) : (
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
    );
  } else if (controls.activeView === 'projects') {
    viewContent = <ProjectsView />;
  } else if (controls.activeView === 'images') {
    viewContent = <ImagesView />;
  } else {
    viewContent = (
      <ContainersView
        controls={controls}
        health={health}
        connection={connection}
        availableRows={availableRows}
        showDiagnosis={showDiagnosis}
        showHelpPanel={showHelpPanel}
        showLogsPanel={showLogsPanel}
        helpRows={helpRows}
        logLines={logLines}
      />
    );
  }

  return (
    <AppShell
      terminalRows={terminalRows}
      header={
        <>
          <Header
            visibleCount={controls.view.visible.length}
            totalCount={controls.view.totalCount}
            query={controls.view.query}
            sortMode={controls.view.sortMode}
            update={{ status: updater.status, latest: updater.latest }}
          />
          <Text> </Text>
        </>
      }
      nav={<ViewTabs views={controls.views} active={controls.activeView} />}
      content={viewContent}
      hud={controls.creatingContainer ? null : <KeyHUD bindings={controls.keymapBindings} />}
      footer={<Footer />}
    />
  );
}
