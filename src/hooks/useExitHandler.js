import { useCallback } from 'react';
import { useApp } from 'ink';
import { EXIT_DELAY } from '../helpers/constants.js';

/**
 * Hook that encapsulates the application exit sequence triggered by pressing `q`.
 *
 * Responsibilities:
 * - Detect the `q` keypress
 * - Invoke an optional `onBeforeExit` callback for resource cleanup (e.g. closing logs)
 * - Clear the terminal after a short delay
 * - Call Ink's `exit()` and, outside of test environments, `process.exit(0)`
 *
 * @param {Object} [options]
 * @param {Function} [options.onBeforeExit] - Optional callback invoked synchronously
 *   before the exit delay starts. Use it to close logs, reset UI state, etc.
 * @returns {{ handleExitCommand: Function }}
 */
export function useExitHandler({ onBeforeExit } = {}) {
  const { exit } = useApp();

  /**
   * Handle the quit command.
   *
   * Mirrors the exact logic of `handleExitCommand` in `useControls.js`:
   * 1. Guard: return false if input is not 'q'
   * 2. Call onBeforeExit (replaces inline logsViewer.closeLogs + setShowDebugLogs(false))
   * 3. After EXIT_DELAY: clear terminal, call exit(), then process.exit(0) outside tests
   *
   * @param {string} input - Raw character input from Ink's useInput
   * @returns {boolean} True when the input was consumed, false otherwise
   */
  const handleExitCommand = useCallback((input) => {
    if (input !== 'q') {
      return false;
    }

    if (typeof onBeforeExit === 'function') {
      onBeforeExit();
    }

    const clearTerminal = () => {
      try {
        if (process.stdout && process.stdout.isTTY) {
          process.stdout.write('\u001Bc');
        } else {
          console.clear();
        }
      } catch (err) {
        // Ignore clear errors to avoid blocking exit.
      }
    };

    setTimeout(() => {
      clearTerminal();
      exit();
      if (process.env.NODE_ENV !== 'test') {
        setTimeout(() => process.exit(0), 50);
      }
    }, EXIT_DELAY);

    return true;
  }, [exit, onBeforeExit]);

  return { handleExitCommand };
}
