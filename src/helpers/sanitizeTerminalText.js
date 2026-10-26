/**
 * Terminal sanitiser — the render boundary for text CDD does not control.
 *
 * A terminal is not a text viewer: it *executes* part of what it is given.
 * An ANSI escape changes the colours, an OSC-8 sequence turns a word into a
 * hyperlink, and `ESC [ 2 J ESC [ H` wipes the screen. CDD renders text it
 * never wrote — the output of an arbitrary container, the answer of a remote
 * registry, the words of a daemon error — and Ink writes that text to stdout
 * verbatim. A container that prints those bytes gets them rendered as
 * commands, so the panel can be made to lie: fake colours, a "clickable" word
 * pointing at a phishing site, a title change, or a screen wipe.
 *
 * This module removes the control sequences and leaves the words. It is pure
 * — no React, no Ink, no I/O — so it can be tested on its own and reused at
 * any render edge.
 *
 * What it removes: the ESC sequences (CSI, the string sequences OSC/DCS/SOS/
 * PM/APC, the charset designators and every other two-byte escape), the C1
 * controls (including the 8-bit CSI and OSC), BEL, the C0 controls that mean
 * nothing inside a line of text, CR — which would move the cursor back and
 * overwrite the start of the line — LF, which would break the line and let
 * the text that follows draw itself as another line of the panel, and DEL.
 *
 * What it keeps: every printable character, plus TAB, the one C0 control
 * that carries meaning in a single line of text (the alignment of a table, for
 * instance). Text with `&`, `<`, `>`,
 * accents or emoji comes out exactly as it went in, and so does anything CDD
 * writes on purpose: the colours of the TUI come from Ink props and from
 * chalk, never from the text this helper is given.
 *
 * The rule that makes it safe: the ESC byte itself never survives, so no
 * sequence can be reassembled by the terminal. What is left of a broken
 * sequence — the tail of a CSI whose head arrived in another chunk — stays
 * visible as the plain text it now is.
 */

/** ESC — the introducer of every escape sequence. */
const CHAR_ESC = 0x1b;
/** BEL — terminates an OSC, and is a bell in its own right. */
const CHAR_BEL = 0x07;
/** DEL — not printable and never meaningful in a log line. */
const CHAR_DEL = 0x7f;
/** The 8-bit CSI head (0x9B) and the 8-bit OSC head (0x9D). */
const C1_CSI = 0x9b;
const C1_OSC = 0x9d;
/** The C1 range: the 8-bit control characters. */
const C1_FIRST = 0x80;
const C1_LAST = 0x9f;
/** The C0 controls that still mean something inside a line of text. */
const KEPT_C0 = new Set(['\t']);
/** The latin-1 shadow of a UTF-8 encoded C1 byte (0xC2 0x9B → 0xC2 + 0x9B). */
const LATIN1_SHADOW = '\u00c2';

/**
 * Index just past the escape sequence that starts at `start`.
 *
 * @param {string} text
 * @param {number} start - Index of the ESC byte
 * @returns {number}
 */
function skipEscape(text, start) {
  const next = text.charCodeAt(start + 1);
  // A lone ESC at the very end: nothing follows it, so it is dropped alone.
  if (Number.isNaN(next)) return start + 1;

  if (next === 0x5b) return skipCsi(text, start + 2); // '[' — CSI

  if (
    next === 0x5d || // ']' — OSC
    next === 0x50 || // 'P' — DCS
    next === 0x58 || // 'X' — SOS
    next === 0x5e || // '^' — PM
    next === 0x5f // '_' — APC
  ) {
    return skipStringSequence(text, start + 2);
  }

  // ESC + one intermediate byte + one final byte: the charset designators
  // (`ESC ( B`), DECALN (`ESC # 8`) and their relatives.
  if (next >= 0x20 && next <= 0x2f) {
    const final = text.charCodeAt(start + 2);
    return final >= 0x30 && final <= 0x7e ? start + 3 : start + 2;
  }

  // Any other two-byte escape: RIS, DECSC, RI, NEL, IND, HTS…
  return start + 2;
}

/**
 * Index just past the CSI that starts at `start` (the byte after `ESC [`).
 *
 * @param {string} text
 * @param {number} start
 * @returns {number}
 */
function skipCsi(text, start) {
  for (let i = start; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    // A new escape aborts the sequence, exactly as a terminal reads it.
    if (code === CHAR_ESC) return i;
    // The final byte (0x40–0x7E) ends it.
    if (code >= 0x40 && code <= 0x7e) return i + 1;
  }
  // Unterminated: the terminal would still be waiting for the final byte, so
  // the rest of the text belongs to the sequence and goes with it.
  return text.length;
}

/**
 * Index just past the string sequence (OSC, DCS, SOS, PM, APC) that starts
 * at `start` (the byte after the introducer).
 *
 * @param {string} text
 * @param {number} start
 * @returns {number}
 */
function skipStringSequence(text, start) {
  for (let i = start; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    // BEL terminates an OSC.
    if (code === CHAR_BEL) return i + 1;
    if (code === CHAR_ESC) {
      // ST is `ESC \`: the other way an OSC ends.
      if (text.charCodeAt(i + 1) === 0x5c) return i + 2;
      // Any other escape starts a new sequence, so the string ends here.
      return i;
    }
  }
  // Unterminated: the rest of the text belongs to the sequence.
  return text.length;
}

/**
 * Remove the latin-1 shadow a UTF-8 encoded C1 byte leaves behind.
 *
 * @param {string} out - Text collected so far
 * @returns {string}
 */
function dropLatin1Shadow(out) {
  return out.endsWith(LATIN1_SHADOW) ? out.slice(0, -1) : out;
}

/**
 * The scanning core. Walks the text once and keeps everything that is not a
 * control sequence.
 *
 * @param {string} text
 * @returns {string}
 */
function sanitizeString(text) {
  let out = '';
  let i = 0;

  while (i < text.length) {
    const code = text.charCodeAt(i);

    if (code === CHAR_ESC) {
      i = skipEscape(text, i);
    } else if (code >= C1_FIRST && code <= C1_LAST) {
      // The control is going away; its latin-1 shadow goes with it.
      out = dropLatin1Shadow(out);
      i = skipC1(text, i, code);
    } else if (isDroppedControl(text, i, code)) {
      i += 1;
    } else {
      out += text[i];
      i += 1;
    }
  }

  return out;
}

/**
 * Position after a C1 control and the sequence it introduces.
 *
 * @param {string} text
 * @param {number} i - Position of the C1 control
 * @param {number} code - Code of the C1 control
 * @returns {number}
 */
function skipC1(text, i, code) {
  if (code === C1_CSI) return skipCsi(text, i + 1);
  if (code === C1_OSC) return skipStringSequence(text, i + 1);
  return i + 1;
}

/**
 * Whether a single character is a control that is removed on its own.
 *
 * @param {string} text
 * @param {number} i
 * @param {number} code
 * @returns {boolean}
 */
function isDroppedControl(text, i, code) {
  return (
    code === CHAR_BEL ||
    code === CHAR_DEL ||
    (code < 0x20 && !KEPT_C0.has(text[i]))
  );
}

/**
 * Map a position in the raw text to the position it takes in the text the
 * field shows.
 *
 * The cursor counts characters of the raw value, but the field displays the
 * sanitised one, so without this the cursor would sit on a different
 * character whenever a control sequence was removed. The display position is
 * how much of the text before the cursor survives the sanitiser.
 *
 * Both sides are counted in code points, like the editor that moves the
 * cursor: a character outside the basic plane (an emoji) is one character,
 * not two.
 *
 * A cursor that falls inside a half-written sequence lands at the end of the
 * visible text before it, which is the closest honest answer: the rest of
 * the sequence is not on the screen.
 *
 * @param {string} raw - The value as it is held in the state
 * @param {number} cursor - Position in the raw value
 * @returns {number} Position in the displayed value
 */
export function sanitizedCursorIndex(raw, cursor) {
  if (typeof cursor !== 'number' || cursor < 0) return cursor;
  const prefix = Array.from(String(raw ?? ''))
    .slice(0, cursor)
    .join('');
  return Array.from(sanitizeTerminalText(prefix)).length;
}

/**
 * Remove the terminal control sequences from a piece of untrusted text.
 *
 * Meant for the render boundary: call it on anything that comes from a
 * container, a registry or a daemon before it reaches an Ink `<Text>`.
 *
 * The result is idempotent — sanitising an already sanitised string changes
 * nothing — because no control byte survives the first pass.
 *
 * Non-string input never throws. `null` and `undefined` are returned
 * unchanged, so a `??` fallback keeps working: a missing name stays missing
 * instead of becoming an empty string that would swallow the fallback. Numbers,
 * booleans and bigints become their text form (a port or a count is not a
 * control sequence). Anything else — an object, an array, a function — is not
 * text at all and becomes the empty string: "[object Object]" in the middle of
 * a panel is a bug, not information.
 *
 * @param {unknown} value - Text to sanitise
 * @returns {string|null|undefined} The text without control sequences
 */
export function sanitizeTerminalText(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return sanitizeString(value);
  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return sanitizeString(String(value));
  }
  return '';
}
