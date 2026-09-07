/**
 * @typedef {Object} TextState
 * @property {string} value  - Current field content
 * @property {number} cursor - Cursor position (0..value.length)
 */

/**
 * @typedef {Object} EditResult
 * @property {TextState} state   - Resulting state (same object if no change)
 * @property {boolean}  handled  - true if the key was consumed by the editor
 */

const BREAK_CHARS = ' \t./\\,;:|(){}[]<>!@#$%^&*+=~`"\'-';

/**
 * Splits a string into code points (handles emojis via Array.from).
 * @param {string} s
 * @returns {string[]}
 */
function chars(s) {
  return Array.from(s);
}

/**
 * Returns the index of the start of the word before cursor.
 * A word boundary is any non-alphanumeric, non-underscore character.
 *
 * @param {string} value
 * @param {number} cursor
 * @returns {number}
 */
export function wordStartBefore(value, cursor) {
  const arr = chars(value);
  if (cursor <= 0) return 0;
  let i = cursor - 1;
  // Skip trailing non-word chars
  while (i > 0 && BREAK_CHARS.includes(arr[i])) i--;
  // Skip word chars
  while (i > 0 && !BREAK_CHARS.includes(arr[i - 1])) i--;
  return i;
}

/**
 * Returns the index of the start of the word after cursor.
 *
 * @param {string} value
 * @param {number} cursor
 * @returns {number}
 */
export function wordStartAfter(value, cursor) {
  const arr = chars(value);
  if (cursor >= arr.length) return arr.length;
  let i = cursor;
  // Skip current word chars
  while (i < arr.length && !BREAK_CHARS.includes(arr[i])) i++;
  // Skip non-word chars (whitespace, punctuation)
  while (i < arr.length && BREAK_CHARS.includes(arr[i])) i++;
  return i;
}

/**
 * Inserts text at the cursor position and leaves the cursor after the insertion.
 *
 * @param {TextState} state
 * @param {string} text
 * @returns {TextState}
 */
export function insertAt(state, text) {
  if (!text) return state;
  const arr = chars(state.value);
  const before = arr.slice(0, state.cursor);
  const after = arr.slice(state.cursor);
  const result = [...before, ...chars(text), ...after].join('');
  return { value: result, cursor: state.cursor + chars(text).length };
}

/**
 * Deletes the character before the cursor.
 *
 * @param {TextState} state
 * @returns {TextState}
 */
export function deleteBackward(state) {
  const arr = chars(state.value);
  if (state.cursor <= 0) return state;
  const before = arr.slice(0, state.cursor - 1);
  const after = arr.slice(state.cursor);
  return { value: before.concat(after).join(''), cursor: state.cursor - 1 };
}

/**
 * Deletes the character under the cursor.
 *
 * @param {TextState} state
 * @returns {TextState}
 */
export function deleteForward(state) {
  const arr = chars(state.value);
  if (state.cursor >= arr.length) return state;
  const before = arr.slice(0, state.cursor);
  const after = arr.slice(state.cursor + 1);
  return { value: before.concat(after).join(''), cursor: state.cursor };
}

/**
 * Applies a keypress to a text state.
 * Pure function: reads and writes nothing outside its arguments.
 *
 * @param {TextState} state
 * @param {string} input - Raw Ink input (1 char, a paste, or '')
 * @param {import('ink').Key} key - Ink special key object
 * @returns {EditResult}
 */
export function applyKeyToText(state, input, key) {
  // No key combinations from this function
  if (key.ctrl) {
    if (input === 'a') {
      // Ctrl+A → move to start
      return { state: { ...state, cursor: 0 }, handled: true };
    }
    if (input === 'e') {
      // Ctrl+E → move to end
      return {
        state: { ...state, cursor: chars(state.value).length },
        handled: true,
      };
    }
    if (input === 'w') {
      // Ctrl+W → delete word before cursor
      const newCursor = wordStartBefore(state.value, state.cursor);
      const arr = chars(state.value);
      const before = arr.slice(0, newCursor);
      const after = arr.slice(state.cursor);
      return {
        state: { value: before.concat(after).join(''), cursor: newCursor },
        handled: true,
      };
    }
    if (input === 'u') {
      // Ctrl+U → delete from start to cursor
      const arr = chars(state.value);
      const after = arr.slice(state.cursor);
      return {
        state: { value: after.join(''), cursor: 0 },
        handled: true,
      };
    }
    if (input === 'k') {
      // Ctrl+K → delete from cursor to end
      const arr = chars(state.value);
      const before = arr.slice(0, state.cursor);
      return {
        state: { value: before.join(''), cursor: state.cursor },
        handled: true,
      };
    }
    // Other ctrl combos: not handled
    return { state, handled: false };
  }

  if (key.meta) {
    return { state, handled: false };
  }

  if (key.leftArrow) {
    const newCursor = Math.max(0, state.cursor - 1);
    return { state: { ...state, cursor: newCursor }, handled: true };
  }

  if (key.rightArrow) {
    const len = chars(state.value).length;
    const newCursor = Math.min(len, state.cursor + 1);
    return { state: { ...state, cursor: newCursor }, handled: true };
  }

  if (key.home) {
    return { state: { ...state, cursor: 0 }, handled: true };
  }

  if (key.end) {
    return {
      state: { ...state, cursor: chars(state.value).length },
      handled: true,
    };
  }

  if (key.backspace) {
    const newState = deleteBackward(state);
    return { state: newState, handled: true };
  }

  if (key.delete) {
    const newState = deleteForward(state);
    return { state: newState, handled: true };
  }

  // Safety net: \x7f (DEL) is what most terminals send for Backspace.
  // Ink v6 maps it to key.delete, but if we receive the raw char directly
  // (e.g. from tests or non-Ink callers), handle it as backspace.
  if (input === '\x7f' || input === '\b') {
    const newState = deleteBackward(state);
    return { state: newState, handled: true };
  }

  // Regular text input (single char or paste).
  // Reject control characters that Ink delivers as \r, \n, \t — these are
  // navigation/action keys, not text to insert.
  if (input && input.length >= 1 && !/[\r\n\t]/.test(input)) {
    const newState = insertAt(state, input);
    return { state: newState, handled: true };
  }

  return { state, handled: false };
}

/**
 * Creates a TextState from a string, with cursor at the end.
 *
 * @param {string} value
 * @returns {TextState}
 */
export function textStateOf(value = '') {
  return { value, cursor: chars(value).length };
}
