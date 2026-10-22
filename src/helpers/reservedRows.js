/**
 * Vertical space budget for the dashboard's fixed and variable chrome.
 *
 * Ink does not expose measured element heights, so every number here is a
 * deliberate over-estimate: reserving too many rows only trims the container
 * list a little early, while reserving too few would let the list push the
 * footer off-screen. This helper stays pure so `App` can subtract it from the
 * terminal height without duplicating the arithmetic.
 */

// Border(2) + padding(2) + Header(3: version, summary, sort) + blank line(1) +
// KeyHUD(1) + Footer(1) + the list's "N more" row(1), plus one row of slack:
// Ink repaints the whole terminal, stacking a copy of the frame in the
// scrollback, as soon as a frame is as tall as the terminal. Staying strictly
// under it is what keeps the redraw in place.
export const BASE_CHROME_ROWS = 12;

// Tallest the DiagnosticPanel gets when shown: margin(1) + border(2) + title,
// blank, what, blank, cause(2), blank, last lines + 5 tail lines, blank and
// the key line = 18, plus two rows for a cause that wraps.
export const DIAGNOSTIC_PANEL_ROWS = 20;

// Border(2) + marginTop(1) + padding(2) + title(1) + up to 15 log lines.
export const DEBUG_PANEL_ROWS = 21;

// Fewest list rows worth sharing the screen with the DiagnosticPanel.
export const MIN_LIST_ROWS_WITH_DIAGNOSIS = 4;

// Log lines the viewer shows at once.
export const LOG_VIEW_LINES = 10;

// Border(2) + title(1) + the visible log lines + the hint/search row(1).
export const LOG_PANEL_ROWS = 4 + LOG_VIEW_LINES;

// Fewest log lines worth a panel, and list rows kept next to it.
const MIN_LOG_LINES = 3;
const MIN_LIST_ROWS_WITH_LOGS = 2;

/**
 * Log lines the panel can show without making the frame as tall as the
 * terminal. The usual LOG_VIEW_LINES, fewer on a short terminal.
 *
 * @param {number} terminalRows - Terminal height
 * @returns {number} Between MIN_LOG_LINES and LOG_VIEW_LINES
 */
export function logViewLines(terminalRows) {
  if (!Number.isFinite(terminalRows)) return LOG_VIEW_LINES;
  const room =
    terminalRows - BASE_CHROME_ROWS - 4 - MIN_LIST_ROWS_WITH_LOGS;
  return Math.min(LOG_VIEW_LINES, Math.max(MIN_LOG_LINES, room));
}

// Border(2) + title(1) + hint(1) + blank(1): the help panel without its keys.
export const HELP_CHROME_ROWS = 5;

// Fewest rows the help panel is worth drawing in, and list rows kept next to it.
const MIN_HELP_ROWS = 7;
const MIN_LIST_ROWS_WITH_HELP = 3;

/**
 * Height of the help panel: one row per key, fewer when the terminal cannot
 * spare them. The list shrinks to make room, and a frame as tall as the
 * terminal would make Ink stack a copy of it per redraw.
 *
 * @param {number} terminalRows - Terminal height
 * @param {number} bindingCount - Keys the panel would list
 * @param {number} otherRows - Rows the rest of the layout reserves
 * @returns {number}
 */
export function helpPanelRows(terminalRows, bindingCount, otherRows) {
  const wanted = HELP_CHROME_ROWS + bindingCount;
  if (!Number.isFinite(terminalRows)) return wanted;
  const room = terminalRows - otherRows - MIN_LIST_ROWS_WITH_HELP;
  return Math.max(MIN_HELP_ROWS, Math.min(wanted, room));
}

/**
 * Rows the layout consumes outside the container list.
 *
 * @param {Object} [options]
 * @param {boolean} [options.hasDiagnosis=false] - DiagnosticPanel is visible
 * @param {boolean} [options.showDebug=false] - Debug panel is visible
 * @param {boolean} [options.isFiltering=false] - Filter field is visible
 * @param {boolean} [options.isStale=false] - Stale-connection warning is visible
 * @param {boolean} [options.hasMessage=false] - Message feedback line is visible
 * @param {boolean} [options.showLogs=false] - Logs panel is visible
 * @param {number} [options.logLines] - Log lines the panel shows
 * @param {number} [options.helpRows] - Height of the help panel, 0 when closed
 * @returns {number} Reserved rows
 */
export function reservedRows({
  hasDiagnosis = false,
  showDebug = false,
  isFiltering = false,
  isStale = false,
  hasMessage = false,
  showLogs = false,
  logLines = LOG_VIEW_LINES,
  helpRows = 0,
} = {}) {
  return (
    BASE_CHROME_ROWS +
    (isStale ? 1 : 0) +
    (isFiltering ? 2 : 0) +
    (hasMessage ? 1 : 0) +
    (hasDiagnosis ? DIAGNOSTIC_PANEL_ROWS : 0) +
    (showDebug ? DEBUG_PANEL_ROWS : 0) +
    (showLogs ? 4 + logLines : 0) +
    helpRows
  );
}
