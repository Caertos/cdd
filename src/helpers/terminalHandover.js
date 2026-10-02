import { getSuspendTerminal } from './appState.js';

/**
 * Run a function while handing the real terminal over to it.
 *
 * Uses Ink's `suspendTerminal` (registered by App via useApp) which
 * synchronously disables raw mode, restores the cursor and exits the
 * alternate screen before `fn` runs, then forces a full redraw on resume.
 * This is required for child processes that need a cooked terminal —
 * e.g. `sudo` prompting for a password on Linux system Docker installs.
 *
 * Falls back to running `fn` directly when no Ink tree is mounted
 * (tests, non-interactive contexts): there is no UI to release.
 *
 * The terminal is always restored even if `fn` throws, so the UI is
 * never left suspended. The error propagates to the caller afterwards.
 *
 * @template T
 * @param {() => Promise<T>} fn - Function to run while the terminal is handed over
 * @returns {Promise<T>} The value returned by `fn`
 */
export async function withTerminalHandover(fn) {
  const suspendTerminal = getSuspendTerminal();
  if (!suspendTerminal) {
    return fn();
  }

  const suspension = await suspendTerminal();
  try {
    return await fn();
  } finally {
    await suspension.resume();
  }
}
