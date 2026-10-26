// Code point ranges the terminal-safety tests forbid in rendered text. They are
// checked by code point, not with a regex literal, so the source holds no raw
// control characters.
export const C0_EXCEPT_TAB_AND_DEL = [
  [0x00, 0x08],
  [0x0a, 0x1f],
  [0x7f, 0x7f],
];
export const C0_BEFORE_TAB = [[0x00, 0x08]];
export const C0_AND_C1 = [
  [0x00, 0x1f],
  [0x7f, 0x9f],
];
export const C0_EXCEPT_TAB_AND_C1 = [
  [0x00, 0x08],
  [0x0a, 0x1f],
  [0x7f, 0x9f],
];

/**
 * Returns the characters of `text` that fall in any of the `[low, high]` code
 * point ranges, so a failing `expect(...).toEqual([])` shows which ones leaked.
 */
export function controlCharsIn(text, ranges) {
  return [...String(text)].filter((ch) => {
    const code = ch.codePointAt(0);
    return ranges.some(([low, high]) => code >= low && code <= high);
  });
}
