import React from 'react';
import { useInput } from 'ink';
import { useContainerActions } from './creation/useContainerActions.js';
import { useContainerCreation } from './creation/useContainerCreation.js';
import { useLogsViewer } from './creation/useLogsViewer.js';
import { useContainerSelection } from './navigation/useContainerSelection.js';
import { useDebugLogs } from './debug/useDebugLogs.js';
import { useEraseConfirmation } from './useEraseConfirmation.js';
import { useConfirmation } from './useConfirmation.js';
import { useExitHandler } from './useExitHandler.js';
import { useShellMode } from './useShellMode.js';
import { getLogsStream } from '../helpers/dockerService/serviceComponents/containerLogs.js';
import {
  getContainerDetails,
  getImageEnv,
} from '../helpers/dockerService/serviceComponents/containerInspect.js';
import { createContainer as svcCreateContainer } from '../helpers/dockerService/serviceComponents/containerActions.js';
import { buildContainerOptions } from '../helpers/containerOptionsBuilder.js';
import {
  containerToCreationValues,
  applyFix,
} from '../helpers/diagnostics/prefill.js';
import { hostPortsOf } from '../helpers/portUtils.js';
import { withContext } from '../helpers/errorMessage.js';
import { DB_IMAGES } from '../helpers/constants.js';
import { STRINGS } from '../helpers/strings.js';
import { useDiagnostics } from './useDiagnostics.js';
import {
  getActiveContext,
  getBindings,
  resolveKey,
} from '../helpers/keymap.js';

// No-op launcher stub so tests and callers without a real launcher keep
// working: `canLaunch: false` hides the S key and every transition is inert.
const NOOP_LAUNCHER = {
  canLaunch: false,
  status: 'idle',
  start: () => {},
  confirm: () => {},
  cancelWait: () => {},
  keepWaiting: () => {},
  reset: () => {},
};

// Principal hook to manage user inputs and control the app state
/** The fix creates the replacement stopped; say how to start it. */
function startHint(replacement) {
  return replacement
    ? ` ${replacement} is stopped — select it and press [i] to start it.`
    : '';
}

/**
 * Main hook that wires user input, creation, actions and logs viewing.
 * It coordinates the modular hooks and exposes a compact API consumed by the App.
 *
 * @param {Array<Object>} containers - Current list of Docker containers
 * @param {Object} [overrides] - Test hooks and optional connection state
 * @param {Object} [overrides.connection] - Docker connection state from useContainers
 * @param {Map<string, import('../helpers/health.js').HealthVerdict>} [overrides.health]
 *   - Health verdicts by container id. Lived here rather than in App so the
 *   diagnosis and the F key read the same one instead of each owning a hook.
 * @param {Map<string, import('../helpers/dockerService/serviceComponents/containerInspect.js').ContainerDetails>} [overrides.details]
 *   - The inspect data useContainerHealth already fetched, for the rules that
 *   need Config.Env.
 * @returns {Object} controls - API for the App component
 */
export function useControls(containers = [], overrides = {}) {
  const connection = overrides.connection ?? null;
  const launcher = overrides.launcher ?? NOOP_LAUNCHER;
  const health = overrides.health ?? new Map();
  // Inspect data that useContainerHealth already fetched. Kept because the
  // profile-based diagnostic rules need Config.Env, and re-inspecting here
  // would double the Docker calls for no new information.
  const details = overrides.details ?? new Map();
  const [creatingContainer, setCreatingContainer] = React.useState(false);
  const [showHelp, setShowHelp] = React.useState(false);
  // The failed container a recreation supersedes, pending a yes/no.
  const [pendingCleanup, setPendingCleanup] = React.useState(null);
  // Set by the F key, consumed by onCreate: the fix may rename the new
  // container to keep this one.
  const supersededRef = React.useRef(null);
  // True while a fix is being prepared, so a second F cannot interleave.
  const fixInFlightRef = React.useRef(false);
  const lastCreationRef = React.useRef(null);

  // — Modular hooks —
  // No props left to pass: the hook stopped reading `containers` when the
  // callers below it moved to the container object. The empty object stays —
  // useContainerActions destructures its argument without a default, so calling
  // it bare throws.
  const actions = useContainerActions({});
  const shellMode = useShellMode();

  const creation = useContainerCreation({
    onCreate: async ({ imageName, containerName, portInput, envInput }) => {
      const options = buildContainerOptions({
        imageName,
        containerName,
        portInput,
        envInput,
      });
      lastCreationRef.current = {
        imageName,
        containerName,
        portInput,
        envInput,
        options,
      };
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
        const superseded = supersededRef.current;
        supersededRef.current = null;
        if (superseded) {
          // Never deleted without an answer: that container may hold something
          // the user has not looked at yet.
          setPendingCleanup({
            ...superseded,
            replacement: containerName || id,
          });
          // Persistent, not timed: the question must stay until it is answered
          // or something else disarms it.
          actions.setPersistentMessage(
            `Created ${containerName || id}. Delete ${superseded.name}, the container that failed? [y] Yes  [n] No`
          );
        } else {
          actions.setTimedMessage(`Created container ${id}${portMsg}`, 'green');
        }
      } catch (err) {
        // Nothing was created, so there is no replacement to ask about. Left
        // armed, a later plain creation would end up offering to delete a
        // container it had nothing to do with.
        supersededRef.current = null;
        setPendingCleanup(null);
        actions.setTimedMessage(
          withContext('Error creating container', err.message),
          'red'
        );
      } finally {
        setCreatingContainer(false);
      }
    },
    onCancel: () => {
      supersededRef.current = null;
      setCreatingContainer(false);
    },
    dbImages: DB_IMAGES,
  });

  const logsViewer = useLogsViewer();
  const selection = useContainerSelection(containers);
  const debugLogs = useDebugLogs();

  const selectedContainer = selection.selectedContainer;
  const selectedVerdict = selectedContainer
    ? (health.get(selectedContainer.id) ?? null)
    : null;
  // One diagnosis for the panel and for the F key, so the log is read once.
  const diagnostics = useDiagnostics(
    selectedContainer,
    selectedVerdict,
    selectedContainer ? (details.get(selectedContainer.id) ?? null) : null
  );
  const canFix = Boolean(diagnostics.diagnosis?.fix);

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
        actionVerb: 'erase',
        container: selection.selectedContainer,
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

  // Is the message line currently owned by something that must survive?
  // The wizard writes its own message while it is open, and each of the three
  // yes/no questions owns the line until it is answered.
  const questionOnScreen =
    creatingContainer ||
    eraseConfirmation.confirmErase ||
    quitConfirmation.active ||
    discardConfirmation.active ||
    pendingCleanup !== null;

  // The selection pulse is true for exactly one commit (see
  // useContainerSelection), so the only place that can observe it is an effect
  // running during that commit. This one is declared after the selection hook,
  // so React runs it in that same commit.
  const pendingLostSelectionRef = React.useRef(false);

  /**
   * Turn the lost-selection pulse into something the user can read.
   *
   * What it does when the message line is busy: it waits. An erase question, a
   * cleanup question, a quit question and the wizard all own that line, and
   * principle 1 says a question is never overwritten — a warning that erases
   * "Are you sure you want to erase this container? (y/n)" would leave the
   * user pressing `y` at a question they can no longer read. Ordinary feedback
   * ("Stopping container...", a success line) is not guarded: it expires on its
   * own, and a transient note is a cheap thing to replace. The pulse is a
   * pulse, so it cannot simply be dropped when a question is up: the flag is
   * latched in a ref and released the moment the line is free again.
   *
   * Yellow, not red: red in this app means an operation failed, and nothing
   * failed here. The notice is that the thing under the highlight is not the
   * thing that was picked.
   */
  React.useEffect(() => {
    if (selection.lostSelection) {
      pendingLostSelectionRef.current = true;
    }
    if (!pendingLostSelectionRef.current || questionOnScreen) {
      return;
    }
    pendingLostSelectionRef.current = false;
    actions.setTimedMessage(STRINGS.selection.lostTarget, 'yellow', 4000);
  }, [selection.lostSelection, questionOnScreen, actions]);

  /** Show the "Esc now goes back" hint once per wizard session. */
  function showBackHintOnce() {
    if (!backHintShownRef.current) {
      backHintShownRef.current = true;
      creation.setMessage(
        'Esc now goes back one step — to cancel, press Esc from the first step'
      );
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
      hasSelection: Boolean(selection.selectedContainer),
      wizardStep: creation.step,
      isSecretField: creation.isCurrentFieldSecret(),
      hasSecrets: creation.hasSecretsInEnv(),
      disconnected: connection?.status === 'error' && containers.length === 0,
      canLaunch: launcher.canLaunch,
      launchStatus: launcher.status,
      canFix,
      confirmCleanup: pendingCleanup !== null,
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
      creation.envInput,
      debugLogs.showDebugLogs,
      selection.selectedContainer,
      containers.length,
      connection?.status,
      launcher.canLaunch,
      launcher.status,
      canFix,
      pendingCleanup,
    ]
  );

  const context = getActiveContext(uiState);
  // Not memoised on purpose. getBindings() filters and sorts at most a dozen
  // bindings, and uiState is a fresh object every render, so a dependency that
  // tracked it would rebuild the array anyway — the memo would only look like
  // an optimisation. An earlier version of this file claimed otherwise.
  const keymapBindings = getBindings(context, uiState);

  // The help panel describes the screen it was opened from, not itself. Without
  // this, pressing ? listed exactly one key — its own close — and every real
  // binding became undiscoverable (H1).
  const helpContext = getActiveContext({ ...uiState, showHelp: false });
  const helpBindings = showHelp
    ? [
        ...getBindings(helpContext, uiState),
        {
          id: 'help.close',
          keys: ['escape', '?'],
          label: 'Esc',
          help: 'Close this help panel',
          priority: 90,
        },
      ]
    : [];

  // Action handlers for the keymap
  const handlers = React.useMemo(
    () => ({
      // List context
      'container.start': () => {
        const container = selection.selectedContainer;
        if (!container) return;
        actions.handleAction({
          actionFn: async (id) => await actions.startContainer(id),
          actionLabel: 'Starting',
          actionVerb: 'start',
          container: selection.selectedContainer,
          stateCheck: (c) =>
            (c.state === 'running' || c.status === 'running') &&
            'Container is already running.',
        });
      },
      'container.stop': () => {
        const container = selection.selectedContainer;
        if (!container) return;
        actions.handleAction({
          actionFn: async (id) => await actions.stopContainer(id),
          actionLabel: 'Stopping',
          actionVerb: 'stop',
          container: selection.selectedContainer,
          // D24: a container that was created and never ran is already
          // stopped, and Docker answers `stop` on it with a raw engine error.
          // Only `state` carries that: the list mapper copies Docker's
          // `State: 'created'` (lower-case) into `state` while `status` gets
          // the display string `Created`, so the `status` alternatives below
          // are tolerance for shapes that only carry `status` and cannot
          // match this one.
          stateCheck: (c) =>
            (c.state === 'exited' ||
              c.status === 'exited' ||
              c.state === 'stopped' ||
              c.status === 'stopped' ||
              c.state === 'created') &&
            'Container is already stopped.',
        });
      },
      'container.restart': () => {
        const container = selection.selectedContainer;
        if (!container) return;
        actions.handleAction({
          actionFn: async (id) => await actions.restartContainer(id),
          actionLabel: 'Restarting',
          actionVerb: 'restart',
          container: selection.selectedContainer,
        });
      },
      'container.logs': () => {
        const container = selection.selectedContainer;
        if (!container) return;
        logsViewer.openLogs();
        startLogsStream(container.id);
      },
      'container.shell': () => {
        const container = selection.selectedContainer;
        if (!container) return;
        shellMode.openShell(container);
      },
      'container.erase': () => {
        const container = selection.selectedContainer;
        if (!container) return;
        eraseConfirmation.startErase();
        actions.setMessage(
          'Are you sure you want to erase this container? (y/n)'
        );
        actions.setMessageColor('yellow');
      },
      // TASK-8: recreate the failed container with the diagnosis applied.
      // The fix is never applied directly — the wizard opens on the review
      // step with the touched rows marked, so the user confirms the diff.
      'container.fix': async () => {
        // Two F presses in quick succession would interleave two reads of the
        // same container and open the wizard twice.
        if (fixInFlightRef.current) return;
        const container = selection.selectedContainer;
        const fix = diagnostics.diagnosis?.fix;
        if (!container || !fix) return;
        fixInFlightRef.current = true;

        // One try around the whole body: a throw anywhere between arming the
        // lock and releasing it would otherwise leave F dead for the rest of
        // the session, with nothing on screen to explain why. An explanation
        // feature that silently disables its own key is worse than one that
        // says it failed.
        try {
          actions.setTimedMessage(
            `Reading ${container.name}'s configuration...`,
            'cyan'
          );

          const details = await getContainerDetails(container.id).catch(
            () => null
          );
          if (!details) {
            // Refusing here, because carrying on means building a container
            // with no environment at all: a postgres without
            // POSTGRES_PASSWORD would die the same way it just did, and the
            // review would say "Env (none)" as if that were the plan. The
            // wizard is one key away and it never pretends to know what the
            // user needs.
            actions.setTimedMessage(
              `Couldn't read ${container.name}'s configuration — press C to create one from scratch`,
              'red'
            );
            return;
          }

          // The image's own env is what tells us which variables are the
          // user's. getImageEnv answers null rather than throwing, but a
          // rejection here would still strand the lock without this catch.
          const imageEnv = await getImageEnv(container.image);

          const base = containerToCreationValues(
            container,
            { env: details.env, cmd: details.cmd },
            imageEnv
          );
          const takenNames = new Set(containers.map((c) => c.name));
          const usedHostPorts = new Set(containers.flatMap(hostPortsOf));
          const { values, changedFields } = applyFix(base, fix, {
            takenNames,
            usedHostPorts,
          });

          supersededRef.current = { id: container.id, name: container.name };
          backHintShownRef.current = false;
          setCreatingContainer(true);
          await creation.prefillCreation(values, changedFields);
        } catch (err) {
          actions.setTimedMessage(
            withContext(
              `Couldn't prepare the fix for ${container.name}`,
              err.message
            ),
            'red'
          );
        } finally {
          fixInFlightRef.current = false;
        }
      },
      'container.create': () => {
        supersededRef.current = null;
        backHintShownRef.current = false;
        creation.resetCreation();
        setCreatingContainer(true);
      },
      'cleanup.delete': async () => {
        const target = pendingCleanup;
        setPendingCleanup(null);
        if (!target) return;
        actions.setTimedMessage('Removing the failed container...', 'yellow');
        try {
          await actions.removeContainer(target.id);
          actions.setTimedMessage(
            `Removed ${target.name}, the container that failed.${startHint(target.replacement)}`,
            'green'
          );
        } catch (err) {
          actions.setTimedMessage(
            withContext(`Could not remove ${target.name}`, err.message),
            'red'
          );
        }
      },
      'cleanup.keep': () => {
        setPendingCleanup(null);
        actions.setTimedMessage(
          `${pendingCleanup?.name ?? 'The failed container'} kept.${startHint(pendingCleanup?.replacement)}`,
          'gray'
        );
      },
      'nav.up': () => selection.move(-1),
      'nav.down': () => selection.move(1),
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
        if (
          creation.suggestions.length > 0 ||
          (creation.hubResults ?? []).length > 0
        ) {
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
        creation.setMessage('');
      },

      // Wizard-list context
      'list.select': () => creation.applyFocusedSuggestion(),
      'list.up': () => creation.moveSuggestionSelection(-1),
      'list.down': () => creation.moveSuggestionSelection(1),

      // Wizard-review context
      'wizard-review.create': () => creation.nextStep(),
      'wizard-review.edit-1': () => creation.editFromReview(0),
      'wizard-review.edit-2': () => creation.editFromReview(1),
      'wizard-review.edit-3': () => creation.editFromReview(2),
      'wizard-review.edit-4': () => creation.editFromReview(3),
      'wizard-review.row-up': () => creation.moveReviewRow(-1),
      'wizard-review.row-down': () => creation.moveReviewRow(1),
      'wizard-review.back': () => creation.prevStep(),

      // Secrets context
      'secrets.generate': () => creation.generateSecretForField(),
      'secrets.reveal': () => creation.toggleRevealSecrets(),

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

      // Disconnected context
      'connection.retry': () => connection?.retry?.(),
      // Connection screen has no visible message bar — quit directly
      // instead of opening an invisible confirmation.
      'connection.quit': () => exitHandler.handleExitCommand('q'),
      'connection.launch': () => launcher.start(),
      'connection.launch-confirm': () => launcher.confirm(),
      'connection.launch-cancel': () => launcher.reset(),
      'connection.launch-wait-cancel': () => launcher.cancelWait(),
      'connection.launch-keep-waiting': () => launcher.keepWaiting(),
      'connection.launch-timeout-cancel': () => {
        launcher.cancelWait();
        launcher.reset();
      },
      'connection.launch-failed-ack': () => launcher.reset(),
    }),
    [
      containers,
      selection.selectedContainer,
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
      connection,
      launcher,
      diagnostics,
      pendingCleanup,
    ]
  );

  /**
   * The one way a binding takes effect.
   *
   * The cleanup question only stays armed while it is on screen: any other key
   * overwrites the message, and an invisible `y` that deletes a container is
   * what principle 1 rules out. Living here rather than in useInput means the
   * rule cannot be bypassed by reaching a handler another way.
   *
   * @param {string} bindingId
   */
  const dispatch = React.useCallback(
    (bindingId) => {
      if (pendingCleanup && !bindingId.startsWith('cleanup.')) {
        setPendingCleanup(null);
        // The question is gone; leaving its text behind would invite the very
        // y it no longer answers.
        if (actions.message.includes('[y] Yes')) {
          actions.setMessage('');
        }
      }
      const handler = handlers[bindingId];
      if (handler) handler();
    },
    // `actions` is a fresh object every render (useContainerActions returns a
    // new literal), so this callback is recreated too. That is harmless — the
    // message read happens at dispatch time — but it is why no stable-identity
    // claim can be made about any dependency here.
    [pendingCleanup, handlers, actions]
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
    if (
      WIZARD_CONTEXTS.includes(ctx) &&
      creation.handleFieldKey(input, normalizedKey)
    ) {
      return;
    }

    const binding = resolveKey(ctx, input, key, uiState);
    if (binding) {
      dispatch(binding.id);
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
    startCreation: () => {
      supersededRef.current = null;
      backHintShownRef.current = false;
      creation.resetCreation();
      setCreatingContainer(true);
    },
    // One diagnosis, shared with the panel: the log is read once.
    diagnosis: diagnostics.diagnosis,
    isDiagnosing: diagnostics.isLoading,
    pendingCleanup,
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
    // Title source for the help panel: the context underneath it.
    helpContext,
    helpBindings,
    // Exposed so the keymap can be exercised end to end in tests without
    // simulating a terminal.
    handlers,
    dispatch,
  };
}
