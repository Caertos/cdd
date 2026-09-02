/**
 * Central keymap module — single source of truth for all keybindings.
 * The HUD and help panel derive from this data, so they can never contradict it.
 *
 * @module keymap
 */

/**
 * Context identifiers. In each instant CDD is in exactly one context.
 * @typedef {'list'|'wizard'|'wizard-list'|'logs'|'confirm'|'help'|'debug'} ContextId
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
    { id: 'container.start', keys: ['i'], label: 'Start', help: 'Start the selected container', priority: 90, when: (s) => s.hasSelection },
    { id: 'container.stop', keys: ['p'], label: 'Stop', help: 'Stop the selected container', priority: 85, when: (s) => s.hasSelection },
    { id: 'container.restart', keys: ['r'], label: 'Restart', help: 'Restart the selected container', priority: 80, when: (s) => s.hasSelection },
    { id: 'container.logs', keys: ['l'], label: 'Logs', help: 'Open the logs viewer', priority: 70, when: (s) => s.hasSelection },
    { id: 'container.shell', keys: ['s'], label: 'Shell', help: 'Open an interactive shell', priority: 65, when: (s) => s.hasSelection },
    { id: 'container.erase', keys: ['e'], label: 'Erase', help: 'Remove the selected container', priority: 60, when: (s) => s.hasSelection },
    { id: 'container.create', keys: ['c'], label: 'Create', help: 'Open the container creation wizard', priority: 50 },
    { id: 'nav.up', keys: ['up'], label: '↑', help: 'Move selection up', priority: 40 },
    { id: 'nav.down', keys: ['down'], label: '↓', help: 'Move selection down', priority: 40 },
    { id: 'debug.toggle', keys: ['d'], label: 'Debug', help: 'Toggle debug log panel', priority: 30 },
    { id: 'app.search', keys: ['/'], label: '/', help: 'Search containers', priority: 25 },
    { id: 'app.quit', keys: ['q'], label: 'Quit', help: 'Exit CDD', priority: 10 },
    { id: 'app.help', keys: ['?'], label: '?', help: 'Show this help', priority: 5 },
  ],
  wizard: [
    { id: 'wizard.next', keys: ['enter'], label: 'Enter', help: 'Confirm and continue to next step', priority: 90 },
    { id: 'wizard.tab', keys: ['tab'], label: 'Tab', help: 'Search Hub or insert env var', priority: 85, when: (s) => s.wizardStep === 0 || s.wizardStep === 3 },
    { id: 'wizard.list_up', keys: ['up'], label: '↑', help: 'Navigate suggestions up', priority: 80, when: (s) => s.wizardStep === 0 && s.hasActiveList },
    { id: 'wizard.list_down', keys: ['down'], label: '↓', help: 'Navigate suggestions down', priority: 80, when: (s) => s.wizardStep === 0 && s.hasActiveList },
    { id: 'wizard.cancel', keys: ['escape'], label: 'Esc', help: 'Cancel creation and return to list', priority: 70 },
    { id: 'app.help', keys: ['?'], label: '?', help: 'Show this help', priority: 5 },
  ],
  'wizard-list': [
    { id: 'list.select', keys: ['enter'], label: 'Enter', help: 'Select the focused item', priority: 90 },
    { id: 'list.up', keys: ['up'], label: '↑', help: 'Move focus up', priority: 80 },
    { id: 'list.down', keys: ['down'], label: '↓', help: 'Move focus down', priority: 80 },
    { id: 'wizard.cancel', keys: ['escape'], label: 'Esc', help: 'Close the list', priority: 70 },
    { id: 'app.help', keys: ['?'], label: '?', help: 'Show this help', priority: 5 },
  ],
  logs: [
    { id: 'logs.up', keys: ['up'], label: '↑', help: 'Scroll up', priority: 90 },
    { id: 'logs.down', keys: ['down'], label: '↓', help: 'Scroll down', priority: 90 },
    { id: 'logs.pageup', keys: ['pageup'], label: 'PgUp', help: 'Page up', priority: 80 },
    { id: 'logs.pagedown', keys: ['pagedown'], label: 'PgDn', help: 'Page down', priority: 80 },
    { id: 'logs.follow', keys: ['f'], label: 'f', help: 'Toggle auto-follow', priority: 70 },
    { id: 'logs.close', keys: ['escape', 'q'], label: 'Esc', help: 'Close the logs viewer', priority: 60 },
    { id: 'app.help', keys: ['?'], label: '?', help: 'Show this help', priority: 5 },
  ],
  confirm: [
    { id: 'confirm.yes', keys: ['y'], label: 'y', help: 'Confirm the action', priority: 90 },
    { id: 'confirm.no', keys: ['n', 'escape'], label: 'n', help: 'Cancel the action', priority: 80 },
  ],
  help: [
    { id: 'help.close', keys: ['escape', '?'], label: 'Esc', help: 'Close this help panel', priority: 90 },
  ],
  debug: [
    { id: 'debug.close', keys: ['escape', 'd'], label: 'Esc', help: 'Close debug panel', priority: 90 },
  ],
};

/**
 * Determines the active context from application state.
 * Pure function. Evaluation order matters: most specific wins.
 *
 * @param {Object} state
 * @param {boolean} [state.confirmErase]
 * @param {boolean} [state.showHelp]
 * @param {boolean} [state.showLogs]
 * @param {boolean} [state.creatingContainer]
 * @param {boolean} [state.hasActiveList]
 * @param {boolean} [state.showDebugLogs]
 * @returns {ContextId}
 */
export function getActiveContext(state) {
  if (state.confirmErase) return 'confirm';
  if (state.showHelp) return 'help';
  if (state.showLogs) return 'logs';
  if (state.creatingContainer && state.hasActiveList) return 'wizard-list';
  if (state.creatingContainer) return 'wizard';
  if (state.showDebugLogs) return 'debug';
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
