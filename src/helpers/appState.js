/**
 * Shared references to the Ink runtime, bridged from the React tree to
 * plain (non-hook) helpers. `inkApp` is set once in index.js after
 * render(<App />); `suspendTerminal` is registered by App itself because it
 * is only reachable via useApp() inside the tree.
 *
 * @module appState
 */

/** @type {import('ink').RenderReturnType | null} */
let inkApp = null;

/**
 * Store the Ink render return value.
 * @param {import('ink').RenderReturnType} app
 */
export function setInkApp(app) {
  inkApp = app;
}

/**
 * Get the Ink render return value.
 * @returns {import('ink').RenderReturnType | null}
 */
export function getInkApp() {
  return inkApp;
}

/**
 * Ink's `useApp().suspendTerminal` — hands the real terminal to a child
 * process (raw mode off, alternate screen exited) and restores it on resume.
 * @type {((callback?: () => Promise<void>) => Promise<{resume: () => Promise<void>}> | undefined) | null}
 */
let suspendTerminalFn = null;

/**
 * Register the suspendTerminal function from inside the React tree.
 * @param {Function | null} fn
 */
export function setSuspendTerminal(fn) {
  suspendTerminalFn = fn;
}

/**
 * Get the suspendTerminal function, if the app is mounted.
 * @returns {Function | null}
 */
export function getSuspendTerminal() {
  return suspendTerminalFn;
}
