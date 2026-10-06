/**
 * Display names for keymap key names. KEYMAP keeps the raw names because they
 * are matched against real key events; only what the user reads goes through
 * here.
 *
 * @module keyLabels
 */

const NAMES = {
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
  escape: 'Esc',
  enter: 'Enter',
  return: 'Enter',
  tab: 'Tab',
  backspace: 'Backspace',
  delete: 'Delete',
  space: 'Space',
  pageup: 'PgUp',
  pagedown: 'PgDn',
  ctrl: 'Ctrl',
  shift: 'Shift',
};

/**
 * @param {string} key - Raw keymap name, e.g. 'escape', 'ctrl+r', 'shift+F'
 * @returns {string} What to show the user; unknown names come back unchanged
 */
export function formatKeyName(key) {
  if (typeof key !== 'string') return key;
  if (key.length > 1 && key.includes('+')) {
    const parts = key.split('+');
    const last = parts.pop();
    const shown = parts.map((p) => NAMES[p] ?? p);
    shown.push(NAMES[last] ?? (last.length === 1 ? last.toUpperCase() : last));
    return shown.join('+');
  }
  return NAMES[key] ?? key;
}

/**
 * Formats a binding's keys for display. Ink reports shift+f as 'shift+F', so
 * a keymap lists both 'F' and 'shift+F' for one physical key; the shifted
 * spelling is dropped when the plain one is present.
 *
 * @param {string[]} keys
 * @returns {string[]}
 */
export function displayKeys(keys) {
  const shown = keys
    .filter((k) => !(k.startsWith('shift+') && keys.includes(k.slice(6))))
    .map(formatKeyName);
  return [...new Set(shown)];
}
