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
// KeyHUD(1) + Footer(1).
export const BASE_CHROME_ROWS = 10;

// Tallest the DiagnosticPanel gets when shown.
export const DIAGNOSTIC_PANEL_ROWS = 12;

// Border(2) + marginTop(1) + padding(2) + title(1) + up to 15 log lines.
export const DEBUG_PANEL_ROWS = 21;

/**
 * Rows the layout consumes outside the container list.
 *
 * @param {Object} [options]
 * @param {boolean} [options.hasDiagnosis=false] - DiagnosticPanel is visible
 * @param {boolean} [options.showDebug=false] - Debug panel is visible
 * @param {boolean} [options.isFiltering=false] - Filter field is visible
 * @param {boolean} [options.isStale=false] - Stale-connection warning is visible
 * @param {boolean} [options.hasMessage=false] - Message feedback line is visible
 * @returns {number} Reserved rows
 */
export function reservedRows({
  hasDiagnosis = false,
  showDebug = false,
  isFiltering = false,
  isStale = false,
  hasMessage = false,
} = {}) {
  return (
    BASE_CHROME_ROWS +
    (isStale ? 1 : 0) +
    (isFiltering ? 2 : 0) +
    (hasMessage ? 1 : 0) +
    (hasDiagnosis ? DIAGNOSTIC_PANEL_ROWS : 0) +
    (showDebug ? DEBUG_PANEL_ROWS : 0)
  );
}
