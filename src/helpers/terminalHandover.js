import React from 'react';
import { render } from 'ink';
import { getInkApp, setInkApp } from './appState.js';
import App from '../App.jsx';

/**
 * Run a function while handing the real terminal over to it: unmount Ink,
 * execute `fn`, then re-render the app on exit.
 *
 * Extracted from useShellMode so that other flows that need the raw terminal
 * (e.g. `sudo` prompting for a password when starting Docker) can reuse the
 * same unmount/handover/remount mechanism instead of duplicating it.
 *
 * The app is remounted even if `fn` throws, so the UI is never left
 * unmounted. The error propagates to the caller after remounting.
 *
 * @template T
 * @param {() => Promise<T>} fn - Function to run while the terminal is handed over
 * @returns {Promise<T>} The value returned by `fn`
 */
export async function withTerminalHandover(fn) {
  // Unmount Ink to release the terminal
  const inkApp = getInkApp();
  if (inkApp && typeof inkApp.unmount === 'function') {
    inkApp.unmount();
  }

  // Clear the screen for a clean handover experience
  if (process.stdout && process.stdout.isTTY) {
    process.stdout.write('\u001Bc');
  }

  try {
    return await fn();
  } finally {
    // Small delay to let output settle
    await new Promise((r) => setTimeout(r, 100));

    // Re-render the app
    console.clear();
    const newApp = render(<App />);
    setInkApp(newApp);
  }
}
