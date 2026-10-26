/**
 * Shared helpers for the regression tests of the render boundary.
 *
 * The text these tests push through the panels comes from outside CDD: a
 * container name, a daemon error, a filter query. A terminal does not only
 * *show* what it is given, it *executes* part of it, so those surfaces have
 * to go through `sanitizeTerminalText` before they reach an Ink <Text>.
 *
 * A test that only checks the readable words would pass with or without the
 * sanitiser — the words are there either way. What tells the two apart is
 * the absence of the control bytes, so that is what these helpers check
 * first.
 */
import { C0_EXCEPT_TAB_AND_C1, controlCharsIn } from './controlChars.js';


/** ESC — the introducer of every escape sequence. */
export const ESC = '\u001b';
/** BEL — terminates an OSC and rings the bell in its own right. */
export const BEL = '\u0007';
/** DEL — not printable, never meaningful in a line of text. */
export const DEL = '\u007f';
/** The 8-bit heads: the same sequences with a shorter introducer. */
export const C1_CSI = '\u009b';
export const C1_OSC = '\u009d';
/** CSI, OSC and the string terminator (ESC backslash). */
export const CSI = `${ESC}[`;
export const OSC = `${ESC}]`;
export const ST = `${ESC}\\`;

/**
 * Text a real container name, image or daemon error can carry. None of it
 * is a control sequence, so none of it may be touched on the way to the
 * screen: the accents, the emoji and the markup characters stay.
 */
export const LEGIT = 'ñandú 🐳 café & <tag> 100%';

/**
 * Build a payload that carries every kind of control sequence CDD has to
 * neutralise: a colour (CSI), a hyperlink (OSC-8), the 8-bit heads, the
 * bell, DEL, a NUL and a carriage return.
 *
 * The marker opens the payload, so a test can tell which surface it is
 * looking at: it is the first word of the payload and the first word of the
 * sanitised result.
 *
 * @param {string} marker - The word that opens the payload
 * @returns {string}
 */
export function hostile(marker) {
  return (
    `${CSI}31m${marker}${CSI}0m ` +
    `${OSC}8;;https://evil.example/pwned${ST}link${OSC}8;;${ST} ` +
    `${C1_CSI}32mgreen ` +
    `${C1_OSC}0;title${BEL}` +
    `bell${BEL}done ` +
    `del${DEL}end ` +
    `nul\u0000zero ` +
    'cr\rreturn'
  );
}

/**
 * What `hostile(marker)` must look like once it has been through the
 * sanitiser: the marker, the words of the hyperlink and the tail, with
 * every sequence and every control byte gone.
 *
 * @param {string} marker
 * @returns {string}
 */
export function sanitised(marker) {
  return `${marker} link green belldone delend nulzero crreturn`;
}

/**
 * Assert that a rendered text carries no terminal control byte.
 *
 * The three heads the sequences are built from are checked one by one (ESC,
 * the 8-bit CSI and the 8-bit OSC) and then the whole C0 range that means
 * nothing inside a line of text, DEL and the C1 range. LF and TAB are the
 * only controls allowed to survive: they carry meaning in a line of text.
 *
 * @param {string} text - The text as it reached the DOM
 */
export function expectNoControlBytes(text) {
  expect(text).not.toContain(ESC);
  expect(text).not.toContain(C1_CSI);
  expect(text).not.toContain(C1_OSC);
  expect(controlCharsIn(text, C0_EXCEPT_TAB_AND_C1)).toEqual([]);
}

/**
 * Find the innermost rendered node whose text contains `needle`.
 *
 * The ink mock nests a <span> per <Text>, so the outermost match is the
 * panel and the innermost one is the text that was actually written.
 *
 * @param {HTMLElement} container - The root of a render
 * @param {string} needle - The text to look for
 * @returns {HTMLElement|null}
 */
export function nodeWithText(container, needle) {
  const matches = Array.from(container.querySelectorAll('span')).filter((el) =>
    el.textContent.includes(needle)
  );
  const innermost = matches.filter(
    (el) => !matches.some((other) => other !== el && el.contains(other))
  );
  return innermost[0] ?? null;
}
