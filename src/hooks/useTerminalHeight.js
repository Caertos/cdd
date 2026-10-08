import { useEffect, useState } from 'react';
import { useStdout } from 'ink';

/**
 * Rows assumed when the terminal height cannot be read (e.g. a non-TTY run).
 */
export const DEFAULT_TERMINAL_ROWS = 24;

const readRows = (stdout) =>
  stdout && Number.isFinite(stdout.rows) ? stdout.rows : DEFAULT_TERMINAL_ROWS;

/**
 * Track the terminal height, in rows.
 *
 * An explicit `injectedRows` number wins (useful for tests and callers that
 * already know the budget) and skips every subscription. Otherwise the height
 * comes from `useStdout().stdout.rows`, refreshed on `resize` / `SIGWINCH`, and
 * falls back to {@link DEFAULT_TERMINAL_ROWS} when the value is unavailable.
 *
 * @param {number} [injectedRows] - Optional fixed row count
 * @returns {number} Terminal height in rows
 */
export function useTerminalHeight(injectedRows) {
  const { stdout } = useStdout();
  const hasInjected = typeof injectedRows === 'number';
  const [rows, setRows] = useState(() =>
    hasInjected ? injectedRows : readRows(stdout)
  );

  useEffect(() => {
    if (hasInjected) return undefined;

    const update = () => setRows(readRows(stdout));
    update();

    const cleanups = [];
    if (stdout && typeof stdout.on === 'function') {
      stdout.on('resize', update);
      cleanups.push(() => {
        if (typeof stdout.off === 'function') {
          stdout.off('resize', update);
        } else if (typeof stdout.removeListener === 'function') {
          stdout.removeListener('resize', update);
        }
      });
    }
    if (process && typeof process.on === 'function') {
      process.on('SIGWINCH', update);
      cleanups.push(() => process.removeListener('SIGWINCH', update));
    }

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [hasInjected, injectedRows, stdout]);

  return hasInjected ? injectedRows : rows;
}
