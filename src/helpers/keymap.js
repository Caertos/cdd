/**
 * Central keymap module — single source of truth for all keybindings.
 * The HUD and help panel derive from this data, so they can never contradict it.
 *
 * @module keymap
 */

/**
 * Context identifiers. In each instant CDD is in exactly one context.
 * @typedef {'list'|'wizard'|'wizard-list'|'wizard-discard'|'wizard-review'|'logs'|'confirm'|'help'|'debug'} ContextId
 */

/**
 * @typedef {Object} Binding
 * @property {string} id            - Stable identifier, e.g. 'container.start'
 * @property {string[]} keys        - Keys that trigger it, e.g. ['i']
 * @property {string} label         - Short label for the HUD, e.g. 'Start'
 * @property {string} [help]        - Long description for the help panel
 * @property {number} [priority=50] - HUD order; higher = further left
 * @property {(state: any) => boolean} [when] - If false, key is inactive
 */

/** @type {Record<ContextId, Binding[]>} */
export const KEYMAP = {
  list: [
    {
      id: 'container.start',
      keys: ['i'],
      label: 'Start',
      help: 'Start the selected container',
      priority: 90,
      when: (s) => s.hasSelection,
    },
    {
      id: 'container.stop',
      keys: ['p'],
      label: 'Stop',
      help: 'Stop the selected container',
      priority: 85,
      when: (s) => s.hasSelection,
    },
    {
      id: 'container.restart',
      keys: ['r'],
      label: 'Restart',
      help: 'Restart the selected container',
      priority: 80,
      when: (s) => s.hasSelection,
    },
    {
      id: 'container.logs',
      keys: ['l'],
      label: 'Logs',
      help: 'Open the logs viewer',
      priority: 70,
      when: (s) => s.hasSelection,
    },
    {
      id: 'container.shell',
      keys: ['s'],
      label: 'Shell',
      help: 'Open an interactive shell',
      priority: 65,
      when: (s) => s.hasSelection,
    },
    {
      id: 'container.erase',
      keys: ['e'],
      label: 'Erase',
      help: 'Remove the selected container',
      priority: 60,
      when: (s) => s.hasSelection,
    },
    {
      id: 'container.fix',
      // keyNameOf() turns shift+f into 'shift+F', not 'F', so both spellings
      // are listed. Lowercase 'f' is deliberately left free for the filter
      // TASK-9 adds.
      keys: ['F', 'shift+F'],
      label: 'Fix',
      help: 'Recreate the container with the diagnosis applied',
      priority: 75,
      when: (s) => s.hasSelection && s.canFix,
    },
    {
      id: 'container.create',
      keys: ['c'],
      label: 'Create',
      help: 'Open the container creation wizard',
      priority: 50,
    },
    {
      id: 'nav.up',
      keys: ['up'],
      label: 'Previous',
      help: 'Move selection up',
      priority: 40,
    },
    {
      id: 'nav.down',
      keys: ['down'],
      label: 'Next',
      help: 'Move selection down',
      priority: 40,
    },
    {
      id: 'debug.toggle',
      keys: ['d'],
      label: 'Debug',
      help: 'Toggle debug log panel',
      priority: 30,
    },
    {
      id: 'app.search',
      keys: ['/'],
      label: 'Search',
      help: 'Search containers',
      priority: 25,
    },
    {
      id: 'app.quit',
      keys: ['q'],
      label: 'Exit',
      help: 'Quit CDD',
      priority: 60,
    },
    {
      id: 'app.help',
      keys: ['?'],
      label: 'Help',
      help: 'Show this help',
      priority: 5,
    },
    {
      // Asked once, right after the replacement exists. The failed container
      // may hold something nobody has looked at yet, so it is never deleted
      // without an answer (principle 1).
      id: 'cleanup.delete',
      keys: ['y'],
      label: 'Yes',
      help: 'Delete the container that failed',
      priority: 95,
      when: (s) => s.confirmCleanup,
    },
    {
      id: 'cleanup.keep',
      keys: ['n'],
      label: 'No',
      help: 'Keep the container that failed',
      priority: 94,
      when: (s) => s.confirmCleanup,
    },
  ],
  wizard: [
    {
      id: 'wizard.next',
      keys: ['enter'],
      label: 'Continue',
      help: 'Confirm and continue to next step',
      priority: 90,
    },
    {
      id: 'wizard.tab',
      keys: ['tab'],
      label: 'Suggest',
      help: 'Search Hub or insert env var',
      priority: 85,
      when: (s) => s.wizardStep === 0 || s.wizardStep === 3,
    },
    {
      id: 'wizard.list_up',
      keys: ['up'],
      label: 'Previous',
      help: 'Navigate suggestions up',
      priority: 80,
      when: (s) => s.wizardStep === 0 && s.hasActiveList,
    },
    {
      id: 'wizard.list_down',
      keys: ['down'],
      label: 'Next',
      help: 'Navigate suggestions down',
      priority: 80,
      when: (s) => s.wizardStep === 0 && s.hasActiveList,
    },
    {
      id: 'wizard.back',
      keys: ['escape'],
      label: 'Back',
      help: 'Go back one step (or cancel from first step)',
      priority: 70,
    },
    {
      id: 'secrets.generate',
      keys: ['ctrl+g'],
      label: '^G',
      help: 'Generate a strong password for secret field',
      priority: 65,
      when: (s) => s.wizardStep === 3 && s.isSecretField,
    },
    {
      id: 'secrets.reveal',
      keys: ['ctrl+r'],
      label: '^R',
      help: 'Toggle reveal/hide secret values',
      priority: 65,
      when: (s) => s.wizardStep === 3 && s.hasSecrets,
    },
    {
      id: 'app.help',
      keys: ['?'],
      label: 'Help',
      help: 'Show this help',
      priority: 5,
    },
  ],
  'wizard-list': [
    {
      id: 'list.select',
      keys: ['enter'],
      label: 'Select',
      help: 'Select the focused item',
      priority: 90,
    },
    {
      id: 'list.up',
      keys: ['up'],
      label: 'Previous',
      help: 'Move focus up',
      priority: 80,
    },
    {
      id: 'list.down',
      keys: ['down'],
      label: 'Next',
      help: 'Move focus down',
      priority: 80,
    },
    {
      id: 'wizard.back',
      keys: ['escape'],
      label: 'Back',
      help: 'Close the list',
      priority: 70,
    },
    {
      id: 'app.help',
      keys: ['?'],
      label: 'Help',
      help: 'Show this help',
      priority: 5,
    },
  ],
  'wizard-discard': [
    {
      id: 'confirm-discard.yes',
      keys: ['y', 'Y'],
      label: 'Discard',
      help: 'Discard and exit',
      priority: 90,
    },
    {
      id: 'confirm-discard.no',
      keys: ['n', 'N', 'escape'],
      label: 'Keep',
      help: 'Keep editing',
      priority: 80,
    },
  ],
  'wizard-review': [
    {
      id: 'wizard-review.create',
      keys: ['enter'],
      label: 'Create',
      help: 'Create the container',
      priority: 90,
    },
    {
      id: 'wizard-review.edit-1',
      keys: ['1'],
      label: 'Image',
      help: 'Edit image',
      priority: 80,
    },
    {
      id: 'wizard-review.edit-2',
      keys: ['2'],
      label: 'Name',
      help: 'Edit name',
      priority: 80,
    },
    {
      id: 'wizard-review.edit-3',
      keys: ['3'],
      label: 'Ports',
      help: 'Edit ports',
      priority: 80,
    },
    {
      id: 'wizard-review.edit-4',
      keys: ['4'],
      label: 'Env',
      help: 'Edit env vars',
      priority: 80,
    },
    {
      id: 'wizard-review.row-up',
      keys: ['up'],
      label: 'Previous',
      help: 'Navigate summary up',
      priority: 70,
    },
    {
      id: 'wizard-review.row-down',
      keys: ['down'],
      label: 'Next',
      help: 'Navigate summary down',
      priority: 70,
    },
    {
      id: 'wizard-review.back',
      keys: ['escape'],
      label: 'Back',
      help: 'Go back to env vars step',
      priority: 60,
    },
  ],
  logs: [
    {
      id: 'logs.up',
      keys: ['up'],
      label: 'Scroll up',
      help: 'Scroll up',
      priority: 90,
    },
    {
      id: 'logs.down',
      keys: ['down'],
      label: 'Scroll down',
      help: 'Scroll down',
      priority: 90,
    },
    {
      id: 'logs.pageup',
      keys: ['pageup'],
      label: 'Page up',
      help: 'Page up',
      priority: 80,
    },
    {
      id: 'logs.pagedown',
      keys: ['pagedown'],
      label: 'Page down',
      help: 'Page down',
      priority: 80,
    },
    {
      id: 'logs.follow',
      keys: ['f'],
      label: 'Follow',
      help: 'Toggle auto-follow',
      priority: 70,
    },
    {
      id: 'logs.close',
      keys: ['escape', 'q'],
      label: 'Close',
      help: 'Close the logs viewer',
      priority: 60,
    },
    {
      id: 'app.help',
      keys: ['?'],
      label: 'Help',
      help: 'Show this help',
      priority: 5,
    },
  ],
  confirm: [
    {
      id: 'confirm.yes',
      keys: ['y'],
      label: 'Yes',
      help: 'Confirm the action',
      priority: 90,
    },
    {
      id: 'confirm.no',
      keys: ['n', 'escape'],
      label: 'No',
      help: 'Cancel the action',
      priority: 80,
    },
  ],
  help: [
    {
      id: 'help.close',
      keys: ['escape', '?'],
      label: 'Close',
      help: 'Close this help panel',
      priority: 90,
    },
  ],
  debug: [
    {
      id: 'debug.close',
      keys: ['escape', 'd'],
      label: 'Close',
      help: 'Close debug panel',
      priority: 90,
    },
  ],
  'confirm-quit': [
    {
      id: 'confirm-quit.yes',
      keys: ['y', 'Y'],
      label: 'Quit',
      help: 'Quit CDD',
      priority: 90,
    },
    {
      id: 'confirm-quit.no',
      keys: ['n', 'N', 'escape'],
      label: 'Cancel',
      help: 'Cancel',
      priority: 80,
    },
  ],
  disconnected: [
    {
      id: 'connection.retry',
      keys: ['r'],
      label: 'Retry',
      help: 'Retry connection',
      priority: 90,
    },
    {
      id: 'connection.quit',
      keys: ['q'],
      label: 'Quit',
      help: 'Quit CDD',
      priority: 80,
    },
    {
      id: 'connection.launch',
      keys: ['s'],
      label: 'Launch',
      help: 'Start Docker for me',
      priority: 88,
      when: (s) => s.canLaunch && s.launchStatus === 'idle',
    },
    {
      id: 'connection.launch-confirm',
      keys: ['y', 'Y', 'enter'],
      label: 'Run',
      help: 'Confirm and run the command',
      priority: 95,
      when: (s) => s.launchStatus === 'confirming',
    },
    {
      id: 'connection.launch-cancel',
      keys: ['escape', 'n', 'N'],
      label: 'Cancel',
      help: 'Cancel',
      priority: 85,
      when: (s) => s.launchStatus === 'confirming',
    },
    {
      id: 'connection.launch-wait-cancel',
      keys: ['escape'],
      label: 'Stop',
      help: 'Stop waiting (Docker keeps starting)',
      priority: 95,
      when: (s) => s.launchStatus === 'waiting',
    },
    {
      id: 'connection.launch-keep-waiting',
      keys: ['enter', 'y', 'Y'],
      label: 'Wait',
      help: 'Keep waiting',
      priority: 95,
      when: (s) => s.launchStatus === 'timeout',
    },
    {
      id: 'connection.launch-timeout-cancel',
      keys: ['escape', 'n', 'N'],
      label: 'Give up',
      help: 'Give up waiting (Docker keeps starting)',
      priority: 85,
      when: (s) => s.launchStatus === 'timeout',
    },
    {
      id: 'connection.launch-failed-ack',
      keys: ['enter', 'escape'],
      label: 'Back',
      help: 'Back',
      priority: 90,
      when: (s) => s.launchStatus === 'failed',
    },
  ],
};

/**
 * Determines the active context from application state.
 * Pure function. Evaluation order matters: most specific wins.
 *
 * @param {Object} state
 * @param {boolean} [state.confirmErase]
 * @param {boolean} [state.confirmDiscard]
 * @param {boolean} [state.showHelp]
 * @param {boolean} [state.showLogs]
 * @param {boolean} [state.creatingContainer]
 * @param {boolean} [state.hasActiveList]
 * @param {boolean} [state.showDebugLogs]
 * @param {boolean} [state.disconnected] - Docker unreachable with empty list
 * @param {boolean} [state.canLaunch] - A Docker launch method was detected
 * @param {string} [state.launchStatus] - Launcher state: 'idle'|'confirming'|'launching'|'waiting'|'ready'|'failed'|'timeout'
 * @returns {ContextId}
 */
export function getActiveContext(state) {
  if (state.confirmErase) return 'confirm';
  if (state.showHelp) return 'help';
  if (state.showLogs) return 'logs';
  if (state.creatingContainer && state.confirmDiscard) return 'wizard-discard';
  if (state.creatingContainer && state.wizardStep === 4) return 'wizard-review';
  if (state.creatingContainer && state.hasActiveList) return 'wizard-list';
  if (state.creatingContainer) return 'wizard';
  if (state.showDebugLogs) return 'debug';
  if (state.confirmQuit) return 'confirm-quit';
  if (state.disconnected) return 'disconnected';
  return 'list';
}

/**
 * Returns active bindings for a context, filtered by `when` and sorted by priority.
 *
 * @param {ContextId} context
 * @param {Object} state
 * @returns {Binding[]}
 */
export function getBindings(context, state) {
  const bindings = KEYMAP[context] ?? [];
  return bindings
    .filter((b) => !b.when || b.when(state))
    .sort((a, b) => (b.priority ?? 50) - (a.priority ?? 50));
}

/**
 * Resolves a keypress against the context's bindings.
 *
 * @param {ContextId} context
 * @param {string} input
 * @import {Key} from 'ink'
 * @param {Key} key
 * @param {Object} state
 * @returns {Binding|null}
 */
export function resolveKey(context, input, key, state) {
  const name = keyNameOf(input, key);
  const bindings = getBindings(context, state);
  return bindings.find((b) => b.keys.includes(name)) ?? null;
}

/**
 * Normalizes Ink (input, key) to a stable key name.
 * @param {string} input
 * @import {Key} from 'ink'
 * @param {Key} key
 * @returns {string}
 */
export function keyNameOf(input, key) {
  if (key.upArrow) return 'up';
  if (key.downArrow) return 'down';
  if (key.leftArrow) return 'left';
  if (key.rightArrow) return 'right';
  if (key.pageUp) return 'pageup';
  if (key.pageDown) return 'pagedown';
  if (key.tab) return 'tab';
  if (key.escape) return 'escape';
  if (key.return) return 'enter';
  if (key.delete) return 'backspace';
  if (key.backspace) return 'backspace';
  if (key.ctrl && input) return `ctrl+${input.toLowerCase()}`;
  if (key.shift && input) return `shift+${input}`;
  if (input === '\r' || input === '\n') return 'enter';
  return input;
}
