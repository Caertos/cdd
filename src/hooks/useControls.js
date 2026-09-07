import React from 'react';
import { useInput } from 'ink';
import { useContainerActions } from './creation/useContainerActions';
import { useContainerCreation } from './creation/useContainerCreation';
import { useLogsViewer } from './creation/useLogsViewer';
import { useContainerSelection } from './navigation/useContainerSelection';
import { useDebugLogs } from './debug/useDebugLogs';
import { useEraseConfirmation } from './useEraseConfirmation';
import { useConfirmation } from './useConfirmation';
import { useExitHandler } from './useExitHandler';
import { useShellMode } from './useShellMode';
import { getLogsStream } from '../helpers/dockerService/serviceComponents/containerLogs.js';
import { createContainer as svcCreateContainer } from '../helpers/dockerService/serviceComponents/containerActions.js';
import { buildContainerOptions } from '../helpers/containerOptionsBuilder.js';
import { DB_IMAGES } from '../helpers/constants.js';
import {
  getActiveContext,
  getBindings,
  resolveKey,
} from '../helpers/keymap.js';

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
  const [showHelp, setShowHelp] = React.useState(false);

  // — Modular hooks —
  const actions = useContainerActions({ containers });
  const shellMode = useShellMode();

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
        actions.setTimedMessage(
          `Error creating container: ${err.message}`,
          'red'
        );
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
  const triggerHubSearch =
    overrides.triggerHubSearch ?? creation.triggerHubSearch;
  const isSearchingHub = overrides.isSearchingHub ?? creation.isSearchingHub;
  const insertNextSuggestedEnv =
    overrides.insertNextSuggestedEnv !== undefined
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

  // Discard confirmation for wizard Esc on step 0 with data
  const backHintShownRef = React.useRef(false);
  const discardConfirmation = useConfirmation({
    onConfirm: () => {
      creation.cancelCreation();
      setCreatingContainer(false);
    },
    onCancel: () => {
      // Return to wizard — message will be recalculated on next render
    },
  });

  // Quit confirmation
  const quitConfirmation = useConfirmation({
    onConfirm: () => exitHandler.handleExitCommand('q'),
    onCancel: () => {
      actions.setMessage('');
      actions.setMessageColor('');
    },
  });

  /** Show the "Esc now goes back" hint once per wizard session. */
  function showBackHintOnce() {
    if (!backHintShownRef.current) {
      backHintShownRef.current = true;
      creation.setMessage('Esc now goes back one step — to cancel, press Esc from the first step');
      creation.setMessageColor('cyan');
    }
  }

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

  const exitHandler = useExitHandler({
    onBeforeExit: () => {
      actions.setMessage('Exiting...');
      actions.setMessageColor('yellow');
      logsViewer.closeLogs();
      debugLogs.setShowDebugLogs(false);
    },
  });

  // Derive UI state for the keymap context
  const uiState = React.useMemo(
    () => ({
      confirmErase: eraseConfirmation.confirmErase,
      confirmDiscard: discardConfirmation.active,
      confirmQuit: quitConfirmation.active,
      showHelp,
      showLogs: logsViewer.showLogs,
      creatingContainer,
      hasActiveList:
        creation.suggestions.length > 0 ||
        (creation.hubResults ?? []).length > 0,
      showDebugLogs: debugLogs.showDebugLogs,
      hasSelection: selection.selected >= 0 && containers.length > 0,
      wizardStep: creation.step,
    }),
    [
      eraseConfirmation.confirmErase,
      discardConfirmation.active,
      quitConfirmation.active,
      showHelp,
      logsViewer.showLogs,
      creatingContainer,
      creation.suggestions,
      creation.hubResults,
      creation.step,
      debugLogs.showDebugLogs,
      selection.selected,
      containers.length,
    ]
  );

  const context = getActiveContext(uiState);
  const keymapBindings = getBindings(context, uiState);

  // Action handlers for the keymap
  const handlers = React.useMemo(
    () => ({
      // List context
      'container.start': () => {
        const container = containers[selection.selected];
        if (!container) return;
        actions.handleAction({
          actionFn: async (id) => await actions.startContainer(id),
          actionLabel: 'Starting',
          selected: selection.selected,
          stateCheck: (c) =>
            (c.state === 'running' || c.status === 'running') &&
            'Container is already running.',
        });
      },
      'container.stop': () => {
        const container = containers[selection.selected];
        if (!container) return;
        actions.handleAction({
          actionFn: async (id) => await actions.stopContainer(id),
          actionLabel: 'Stopping',
          selected: selection.selected,
          stateCheck: (c) =>
            (c.state === 'exited' ||
              c.status === 'exited' ||
              c.state === 'stopped' ||
              c.status === 'stopped') &&
            'Container is already stopped.',
        });
      },
      'container.restart': () => {
        const container = containers[selection.selected];
        if (!container) return;
        actions.handleAction({
          actionFn: async (id) => await actions.restartContainer(id),
          actionLabel: 'Restarting',
          selected: selection.selected,
        });
      },
      'container.logs': () => {
        const container = containers[selection.selected];
        if (!container) return;
        logsViewer.openLogs();
        startLogsStream(container.id);
      },
      'container.shell': () => {
        const container = containers[selection.selected];
        if (!container) return;
        shellMode.openShell(container);
      },
      'container.erase': () => {
        const container = containers[selection.selected];
        if (!container) return;
        eraseConfirmation.startErase();
        actions.setMessage(
          'Are you sure you want to erase this container? (y/n)'
        );
        actions.setMessageColor('yellow');
      },
      'container.create': () => {
        backHintShownRef.current = false;
        creation.resetCreation();
        setCreatingContainer(true);
      },
      'nav.up': () => selection.handleNavigation('', { upArrow: true }),
      'nav.down': () => selection.handleNavigation('', { downArrow: true }),
      'debug.toggle': () => debugLogs.setShowDebugLogs((prev) => !prev),
      'app.search': () => {}, // Placeholder — search not yet implemented
      'app.quit': () => {
        quitConfirmation.start();
        actions.setMessage('Are you sure you want to quit? [y] Yes  [n] No');
        actions.setMessageColor('yellow');
      },
      'app.help': () => setShowHelp((prev) => !prev),

      // Wizard context
      'wizard.next': () => {
        if (creation.step === 0 && creation.selectedSuggestionIndex >= 0) {
          creation.applyFocusedSuggestion();
        } else {
          creation.nextStep();
        }
      },
      'wizard.tab': () => {
        if (creation.step === 0) {
          // Trigger Hub search if not already searching and image name is not empty
          if (!isSearchingHub && (creation.imageName || '').trim() !== '') {
            triggerHubSearch();
          }
        } else if (creation.step === 3) {
          // Insert next suggested env var
          insertNextSuggestedEnv?.();
        }
      },
      'wizard.list_up': () => creation.moveSuggestionSelection(-1),
      'wizard.list_down': () => creation.moveSuggestionSelection(1),
      'wizard.back': () => {
        // Esc chain: suggestions → Hub search → prev step → discard confirm → exit
        if (creation.isSearchingHub) {
          creation.cancelHubSearch();
          return;
        }
        if (creation.suggestions.length > 0 || (creation.hubResults ?? []).length > 0) {
          creation.closeSuggestions();
          return;
        }
        if (creation.step > 0) {
          creation.prevStep();
          showBackHintOnce();
          return;
        }
        if (!creation.hasAnyInput()) {
          creation.cancelCreation();
          setCreatingContainer(false);
          return;
        }
        discardConfirmation.start();
        creation.setMessage('Discard this container? All progress will be lost. [y] Yes  [n] No');
        creation.setMessageColor('yellow');
      },

      // Wizard-list context
      'list.select': () => creation.applyFocusedSuggestion(),
      'list.up': () => creation.moveSuggestionSelection(-1),
      'list.down': () => creation.moveSuggestionSelection(1),

      // Logs context
      'logs.close': () => logsViewer.closeLogs(),

      // Confirm context
      'confirm.yes': () => eraseConfirmation.processEraseConfirmation('y', {}),
      'confirm.no': () => eraseConfirmation.processEraseConfirmation('n', {}),

      // Wizard-discard context
      'confirm-discard.yes': () => discardConfirmation.processKey('y', {}),
      'confirm-discard.no': () => discardConfirmation.processKey('n', {}),

      // Confirm-quit context
      'confirm-quit.yes': () => quitConfirmation.processKey('y'),
      'confirm-quit.no': () => quitConfirmation.processKey('n'),

      // Help context
      'help.close': () => setShowHelp(false),

      // Debug context
      'debug.close': () => debugLogs.setShowDebugLogs(false),
    }),
    [
      containers,
      selection.selected,
      actions,
      logsViewer,
      startLogsStream,
      shellMode,
      eraseConfirmation,
      discardConfirmation,
      quitConfirmation,
      creation,
      debugLogs,
      exitHandler,
    ]
  );

  // Single keyboard entry point — declarative keymap dispatch
  useInput((input, key) => {
    const ctx = getActiveContext(uiState);

    // Ink v6 maps \x7f (Backspace on most terminals) to key.delete instead
    // of key.backspace. Normalize so text editing always receives backspace.
    const normalizedKey =
      key.delete && !key.backspace
        ? { ...key, delete: false, backspace: true }
        : key;

    // Text fields have priority in wizard contexts
    const WIZARD_CONTEXTS = ['wizard', 'wizard-list'];
    if (WIZARD_CONTEXTS.includes(ctx) && creation.handleFieldKey(input, normalizedKey)) {
      return;
    }

    const binding = resolveKey(ctx, input, key, uiState);
    if (binding && handlers[binding.id]) {
      handlers[binding.id]();
      return;
    }

    // Fallback for logs scrolling (handled by logsViewer)
    if (ctx === 'logs' && !binding) {
      if (key.upArrow) {
        logsViewer.scrollUp?.();
        return;
      }
      if (key.downArrow) {
        logsViewer.scrollDown?.();
        return;
      }
    }
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
    confirmDiscard: discardConfirmation.active,
    confirmQuit: quitConfirmation.active,
    showDebugLogs: debugLogs.showDebugLogs,
    debugLogs: debugLogs.debugLogs,
    showHelp,
    context,
    keymapBindings,
  };
}
