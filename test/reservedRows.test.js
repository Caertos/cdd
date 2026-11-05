/**
 * @jest-environment node
 */
import {
  reservedRows,
  BASE_CHROME_ROWS,
  DIAGNOSTIC_PANEL_ROWS,
  DEBUG_PANEL_ROWS,
  LOG_PANEL_ROWS,
  LOG_VIEW_LINES,
  logViewLines,
  helpPanelRows,
  HELP_CHROME_ROWS,
} from '../src/helpers/reservedRows.js';
// The contract adds these exports. A named import of a missing export fails
// the whole file at link time; through the namespace each missing symbol is
// just undefined, so every test fails on its own assertion or TypeError.
import * as reservedRowsModule from '../src/helpers/reservedRows.js';

const { chromeRows, COMPACT_ROWS, COMPACT_SAVED_ROWS } = reservedRowsModule;

describe('reservedRows', () => {
  test('returns the base chrome with no optional blocks', () => {
    expect(reservedRows()).toBe(BASE_CHROME_ROWS);
    expect(reservedRows({})).toBe(BASE_CHROME_ROWS);
  });

  test('tolerates an undefined options object', () => {
    expect(reservedRows(undefined)).toBe(BASE_CHROME_ROWS);
  });

  test('adds one row for the stale warning', () => {
    expect(reservedRows({ isStale: true })).toBe(BASE_CHROME_ROWS + 1);
  });

  test('adds two rows for the filter field', () => {
    expect(reservedRows({ isFiltering: true })).toBe(BASE_CHROME_ROWS + 2);
  });

  test('adds one row for the message feedback', () => {
    expect(reservedRows({ hasMessage: true })).toBe(BASE_CHROME_ROWS + 1);
  });

  test('adds the diagnostic panel height', () => {
    expect(reservedRows({ hasDiagnosis: true })).toBe(
      BASE_CHROME_ROWS + DIAGNOSTIC_PANEL_ROWS
    );
  });

  test('adds the debug panel height', () => {
    expect(reservedRows({ showDebug: true })).toBe(
      BASE_CHROME_ROWS + DEBUG_PANEL_ROWS
    );
  });

  test('adds the logs panel height', () => {
    expect(reservedRows({ showLogs: true })).toBe(
      BASE_CHROME_ROWS + LOG_PANEL_ROWS
    );
  });

  test('reserves a row for the view tabs', () => {
    expect(BASE_CHROME_ROWS).toBeGreaterThanOrEqual(13);
  });

  test('drops the compact savings', () => {
    expect(reservedRows({ compact: true })).toBe(
      BASE_CHROME_ROWS - COMPACT_SAVED_ROWS
    );
  });

  test('sums every option when several are present', () => {
    expect(
      reservedRows({
        isStale: true,
        isFiltering: true,
        hasMessage: true,
        hasDiagnosis: true,
        showDebug: true,
      })
    ).toBe(
      BASE_CHROME_ROWS + 1 + 2 + 1 + DIAGNOSTIC_PANEL_ROWS + DEBUG_PANEL_ROWS
    );
  });
});

describe('logViewLines', () => {
  test('uses every row the content has left, with no cap', () => {
    expect(logViewLines(60)).toBe(60 - BASE_CHROME_ROWS - 4);
  });

  test('matches the chrome on a 24-row terminal', () => {
    expect(logViewLines(24)).toBe(24 - BASE_CHROME_ROWS - 4);
  });

  test('stays usable on a 15-row terminal', () => {
    expect(logViewLines(15)).toBe(
      15 - (BASE_CHROME_ROWS - COMPACT_SAVED_ROWS) - 4
    );
    expect(logViewLines(15)).toBeGreaterThanOrEqual(1);
  });

  test('never goes below one line', () => {
    expect(logViewLines(5)).toBe(1);
  });

  test('falls back to the full panel without a measurable height', () => {
    expect(logViewLines(undefined)).toBe(LOG_VIEW_LINES);
  });

  test('reservedRows follows the lines it is given', () => {
    expect(reservedRows({ showLogs: true, logLines: 5 })).toBe(
      BASE_CHROME_ROWS + 4 + 5
    );
  });
});

describe('chromeRows', () => {
  test('drops the compact savings below COMPACT_ROWS', () => {
    expect(chromeRows(COMPACT_ROWS - 1)).toBe(
      BASE_CHROME_ROWS - COMPACT_SAVED_ROWS
    );
  });

  test('keeps the base chrome at COMPACT_ROWS', () => {
    expect(chromeRows(COMPACT_ROWS)).toBe(BASE_CHROME_ROWS);
  });

  test('keeps the base chrome without a measurable height', () => {
    expect(chromeRows(undefined)).toBe(BASE_CHROME_ROWS);
  });
});

describe('helpPanelRows', () => {
  test('one row per key plus the panel chrome when there is room', () => {
    expect(helpPanelRows(60, 14, BASE_CHROME_ROWS)).toBe(HELP_CHROME_ROWS + 14);
  });

  test('gives rows back to the list on a short terminal', () => {
    const rows = helpPanelRows(30, 14, BASE_CHROME_ROWS);
    expect(rows).toBeLessThan(HELP_CHROME_ROWS + 14);
    // The frame still ends under the terminal: base + help + a few list rows.
    expect(BASE_CHROME_ROWS + rows).toBeLessThan(30);
  });

  test('never collapses below a usable panel', () => {
    expect(helpPanelRows(10, 14, BASE_CHROME_ROWS)).toBeGreaterThanOrEqual(7);
  });

  test('without a measurable height it asks for every key', () => {
    expect(helpPanelRows(undefined, 9, 0)).toBe(HELP_CHROME_ROWS + 9);
  });

  test('reservedRows adds the help height', () => {
    expect(reservedRows({ helpRows: 12 })).toBe(BASE_CHROME_ROWS + 12);
  });
});
