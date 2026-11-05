import React from 'react';
import { Box, Text } from 'ink';
import PropTypes from 'prop-types';
import ContainerSection from '../components/ContainerSection.jsx';
import MessageFeedback from '../components/MessageFeedback.jsx';
import { PromptField } from '../components/PromptField.jsx';
import LogViewer from '../components/LogViewer.jsx';
import { DiagnosticPanel } from '../components/DiagnosticPanel.jsx';
import { HelpPanel } from '../components/HelpPanel.jsx';
import { STRINGS } from '../helpers/strings.js';
import {
  sanitizeTerminalText,
  sanitizedCursorIndex,
} from '../helpers/sanitizeTerminalText.js';

/**
 * Pairs each log line with a key built from its content plus how many times
 * the same line appeared before it, so duplicates stay unique and stable.
 *
 * @param {string[]} lines
 * @returns {Array<{line: string, key: string}>}
 */
function keyedLines(lines) {
  const seen = new Map();
  return lines.map((line) => {
    const count = seen.get(line) ?? 0;
    seen.set(line, count + 1);
    return { line, key: `${line}#${count}` };
  });
}

/** Filter prompt shown under the header while the user is filtering. */
function FilterBar({ view }) {
  if (!view.isFiltering) return null;
  return (
    <Box paddingLeft={1}>
      <PromptField
        label={STRINGS.filter.label}
        value={sanitizeTerminalText(view.query)}
        cursor={sanitizedCursorIndex(view.query, view.cursor)}
      />
    </Box>
  );
}

FilterBar.propTypes = {
  view: PropTypes.shape({
    isFiltering: PropTypes.bool,
    query: PropTypes.string,
    cursor: PropTypes.number,
  }).isRequired,
};

/**
 * Live debug log panel: the last 15 lines, or a placeholder when empty.
 *
 * @param {Object} props
 * @param {string[]} props.logs
 */
function DebugPanel({ logs }) {
  return (
    <Box
      marginTop={1}
      flexDirection="column"
      borderStyle="round"
      borderColor="gray"
      padding={1}
    >
      <Text color="cyan">{STRINGS.debugTitle}</Text>
      {logs.length === 0 ? (
        <Text dimColor>{STRINGS.debugEmpty}</Text>
      ) : (
        keyedLines(logs.slice(-15)).map(({ line, key }) => (
          <Text key={key} color="gray">
            {sanitizeTerminalText(line)}
          </Text>
        ))
      )}
    </Box>
  );
}

DebugPanel.propTypes = {
  logs: PropTypes.arrayOf(PropTypes.string).isRequired,
};

/**
 * The containers view: the list with its filter, the optional diagnosis and
 * help panels, the message line and the debug panel. While the logs panel is
 * open it takes the whole content area: the logs replace the list, so only the
 * log viewer and the message line render. The layout decisions (which panels
 * show, how many rows are left) come from the App.
 *
 * @param {Object} props
 * @param {Object} props.controls - Output of useControls
 * @param {Map} props.health - Health verdicts keyed by container id
 * @param {Object} props.connection - Output of useContainers().connection
 * @param {number} props.availableRows - Rows left for the container list
 * @param {boolean} props.showDiagnosis - Whether the diagnosis panel is shown
 * @param {boolean} props.showHelpPanel - Whether the help panel is shown
 * @param {boolean} props.showLogsPanel - Whether the logs panel is shown
 * @param {number} props.helpRows - Height of the help panel
 * @param {number} props.logLines - Log lines the logs panel shows
 * @returns {JSX.Element}
 */
export function ContainersView({
  controls,
  health,
  connection,
  availableRows,
  showDiagnosis,
  showHelpPanel,
  showLogsPanel,
  helpRows,
  logLines,
}) {
  // The highlight and this object come from the same id-anchored selection, so
  // the panel can never describe a different container than the one marked.
  // Already null when nothing is selected, hence no fallback here.
  const selectedContainer = controls.selectedContainer;

  const messageLine = (
    <MessageFeedback
      message={controls.message}
      color={controls.messageColor}
    />
  );

  if (showLogsPanel) {
    return (
      <>
        <LogViewer
          logs={controls.logs}
          headNotice={controls.logsHead}
          highVolume={controls.logsHighVolume}
          onExit={controls.exitLogs}
          container={controls.selectedContainer}
          height={logLines}
          scrollOffset={controls.logsScrollOffset}
          following={controls.logsFollowing}
          pending={controls.logsPending}
          search={controls.logsSearch}
        />
        {messageLine}
      </>
    );
  }

  return (
    <>
      {connection.isStale && (
        <Text color="yellow">
          {'⚠ '}
          {STRINGS.connection.staleWarning}
        </Text>
      )}
      <FilterBar view={controls.view} />
      <ContainerSection
        containers={controls.view.visible}
        // Still a position: ContainerList highlights with `i === selected`,
        // so this prop cannot become the id until those components change.
        // Derived from the same selection as the rest of the panel, not a
        // second source of truth.
        selected={controls.selected}
        health={health}
        connectionStatus={connection.status}
        isStale={connection.isStale}
        query={controls.view.query}
        totalCount={controls.view.totalCount}
        availableRows={availableRows}
        onCreate={() => controls.startCreation()}
      />
      {/* The panel takes room only when a container is failing and we have
            something to say about it — a deliberate stop gets nothing. */}
      {showDiagnosis && (
        <DiagnosticPanel
          diagnosis={controls.diagnosis}
          containerName={selectedContainer?.name ?? ''}
          isLoading={controls.isDiagnosing}
          fixLabel={controls.diagnosis?.fix?.label ?? null}
        />
      )}
      {showHelpPanel && (
        <HelpPanel
          context={controls.helpContext}
          bindings={controls.helpBindings}
          maxRows={helpRows}
        />
      )}
      {messageLine}
      {controls.showDebugLogs && <DebugPanel logs={controls.debugLogs} />}
    </>
  );
}

ContainersView.propTypes = {
  controls: PropTypes.object.isRequired,
  health: PropTypes.instanceOf(Map),
  connection: PropTypes.object.isRequired,
  availableRows: PropTypes.number,
  showDiagnosis: PropTypes.bool,
  showHelpPanel: PropTypes.bool,
  showLogsPanel: PropTypes.bool,
  helpRows: PropTypes.number,
  logLines: PropTypes.number,
};
