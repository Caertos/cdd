import React from 'react';
import { useInput } from 'ink';
import { useContainerActions } from './creation/useContainerActions';
import { useContainerCreation } from './creation/useContainerCreation';
import { useLogsViewer } from './creation/useLogsViewer';
import { useContainerSelection } from './navigation/useContainerSelection';
import { useDebugLogs } from './debug/useDebugLogs';
import { useEraseConfirmation } from './useEraseConfirmation';
import { useExitHandler } from './useExitHandler';
import { useContainerCommandRouter } from './useContainerCommandRouter';
import { getLogsStream } from '../helpers/dockerService/serviceComponents/containerLogs.js';
import { createContainer as svcCreateContainer } from '../helpers/dockerService/serviceComponents/containerActions.js';
import { buildContainerOptions } from '../helpers/containerOptionsBuilder.js';
import { DB_IMAGES } from '../helpers/constants.js';

// Principal hook to manage user inputs and control the app state
/**
 * Main hook that wires user input, creation, actions and logs viewing.
 * It coordinates the modular hooks and exposes a compact API consumed by the App.
 *
 * @param {Array<Object>} containers - Current list of Docker containers
 * @returns {Object} controls - API for the App component
 */
export function useControls(containers = [], overrides = {}) {
  const [creatingContainer, setCreatingContainer] = React.useState(false);

  // — Modular hooks —
  const actions = useContainerActions({ containers });

  const creation = useContainerCreation({
    onCreate: async ({ imageName, containerName, portInput, envInput }) => {
      const options = buildContainerOptions({
        imageName,
        containerName,
        portInput,
        envInput,
      });
      actions.setTimedMessage(`Creating container ${imageName}...`, 'yellow');
      try {
        const { id, ports } = await svcCreateContainer(imageName, options);
        let portMsg = '';
        if (ports && ports.length) {
          portMsg =
            ' | Ports: ' +
            ports
              .map((p) => `${p.hostPort}→${p.containerPort}/${p.protocol}`)
              .join(', ');
        }
        actions.setTimedMessage(`Created container ${id}${portMsg}`, 'green');
      } catch (err) {
        actions.setTimedMessage(`Error creating container: ${err.message}`, 'red');
      } finally {
        setCreatingContainer(false);
      }
    },
    onCancel: () => setCreatingContainer(false),
    dbImages: DB_IMAGES,
  });

  const logsViewer = useLogsViewer();
  const selection = useContainerSelection(containers.length);
  const debugLogs = useDebugLogs();

  // Allow overrides for testability (e.g. injecting a mock triggerHubSearch)
  const triggerHubSearch = overrides.triggerHubSearch ?? creation.triggerHubSearch;
  const isSearchingHub = overrides.isSearchingHub ?? creation.isSearchingHub;
  const insertNextSuggestedEnv = overrides.insertNextSuggestedEnv !== undefined
    ? overrides.insertNextSuggestedEnv
    : creation.insertNextSuggestedEnv;

  const eraseConfirmation = useEraseConfirmation({
    onConfirm: () => {
      actions.handleAction({
        actionFn: async (id) => await actions.removeContainer(id),
        actionLabel: 'Erasing',
        selected: selection.selected,
      });
      actions.setMessageColor('yellow');
    },
    onCancel: () => {
      actions.setMessage('');
      actions.setMessageColor('');
    },
  });

  /**
   * Pipe container logs into the viewer while applying a hard limit.
   * @param {string} containerId - Container identifier used by Docker.
   */
  const startLogsStream = React.useCallback(
    (containerId) => {
      getLogsStream(
        containerId,
        (data) =>
          logsViewer.setLogs((prev) => {
            const newLogs = [...prev, ...data.split('\n').filter(Boolean)];
            return newLogs.slice(-1000);
          }),
        () => {},
        (err) =>
          logsViewer.setLogs((prev) => [...prev, `Error: ${err.message}`])
      );
    },
    [logsViewer]
  );

  const commandRouter = useContainerCommandRouter({
    actions,
    containers,
    selected: selection.selected,
    creation,
    logsViewer,
    startLogsStream,
    onStartErase: () => {
      eraseConfirmation.startErase();
      actions.setMessage(
        'Are you sure you want to erase this container? (y/n)'
      );
      actions.setMessageColor('yellow');
    },
    onToggleDebug: () => debugLogs.setShowDebugLogs((prev) => !prev),
    onStartCreate: () => setCreatingContainer(true),
  });

  const exitHandler = useExitHandler({
    onBeforeExit: () => {
      actions.setMessage('Exiting...');
      actions.setMessageColor('yellow');
      logsViewer.closeLogs();
      debugLogs.setShowDebugLogs(false);
    },
  });

  /**
   * Route keystrokes to the container creation wizard.
   */
  const processCreationInput = React.useCallback(
    (input, key) => {
      const step = creation.step;

      const removeLastChar = (setter) =>
        setter((value) => (value || '').slice(0, -1));
      const appendChar = (setter, current, ch) => setter((current || '') + ch);

      if (key.escape) {
        creation.cancelCreation();
        setCreatingContainer(false);
        return;
      }

      if (input === '\r' || input === '\n') {
        // If on step 0 with a focused suggestion, apply it instead of advancing
        if (step === 0 && creation.selectedSuggestionIndex >= 0) {
          creation.applyFocusedSuggestion();
          return;
        }
        creation.nextStep();
        return;
      }

      // Tab on step 0: trigger Docker Hub search (with guards)
      if (key.tab) {
        if (step === 0) {
          if (!isSearchingHub && (creation.imageName || '').trim() !== '') {
            triggerHubSearch();
          }
        } else if (step === 3) {
          insertNextSuggestedEnv?.();
        }
        return;
      }

      // Arrow keys on step 0: navigate suggestion list
      if (step === 0 && creation.suggestions.length > 0) {
        if (key.upArrow) {
          creation.moveSuggestionSelection(-1);
          return;
        }
        if (key.downArrow) {
          creation.moveSuggestionSelection(1);
          return;
        }
      }

      if (key.backspace || key.delete) {
        if (step === 0) {
          const newValue = (creation.imageName || '').slice(0, -1);
          creation.updateImageInput(newValue);
        }
        if (step === 1) removeLastChar(creation.setContainerName);
        if (step === 2) removeLastChar(creation.setPortInput);
        if (step === 3) removeLastChar(creation.setEnvInput);
        return;
      }

      if (input && input.length === 1 && !key.ctrl && !key.meta) {
        if (step === 0) {
          creation.updateImageInput((creation.imageName || '') + input);
        }
        if (step === 1)
          appendChar(creation.setContainerName, creation.containerName, input);
        if (step === 2)
          appendChar(creation.setPortInput, creation.portInput, input);
        if (step === 3)
          appendChar(creation.setEnvInput, creation.envInput, input);
      }
    },
    [creation, setCreatingContainer, triggerHubSearch, isSearchingHub, insertNextSuggestedEnv]
  );

  // Single keyboard entry point
  useInput((input, key) => {
    if (eraseConfirmation.confirmErase) {
      eraseConfirmation.processEraseConfirmation(input, key);
      return;
    }

    if (logsViewer.showLogs) {
      if (input === 'q' || key.escape) {
        logsViewer.closeLogs();
      }
      return;
    }

    if (creatingContainer) {
      processCreationInput(input, key);
      return;
    }

    if (debugLogs.showDebugLogs && key.escape) {
      debugLogs.setShowDebugLogs(false);
      return;
    }

    commandRouter.handleDockerCommands(input);
    exitHandler.handleExitCommand(input);
    selection.handleNavigation(input, key);
  });

  return {
    selected: selection.selected,
    setSelected: selection.setSelected,
    message: creatingContainer ? creation.message : actions.message,
    messageColor: creatingContainer
      ? creation.messageColor
      : actions.messageColor,
    showLogs: logsViewer.showLogs,
    logs: logsViewer.logs,
    exitLogs: logsViewer.closeLogs,
    creatingContainer,
    creationStep: creation.step,
    imageNameInput: creation.imageName,
    containerNameInput: creation.containerName,
    portInput: creation.portInput,
    envInput: creation.envInput,
    creation,
    actions,
    logsViewer,
    confirmErase: eraseConfirmation.confirmErase,
    showDebugLogs: debugLogs.showDebugLogs,
    debugLogs: debugLogs.debugLogs,
  };
}
