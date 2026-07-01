/**
 * Shared reference to the Ink render instance.
 * Set once in index.js after render(<App />) and read by useShellMode
 * to unmount/remount the UI around interactive shell sessions.
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
