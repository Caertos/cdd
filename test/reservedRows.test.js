/**
 * @jest-environment node
 */
import {
  reservedRows,
  BASE_CHROME_ROWS,
  DIAGNOSTIC_PANEL_ROWS,
  DEBUG_PANEL_ROWS,
} from '../src/helpers/reservedRows.js';

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
