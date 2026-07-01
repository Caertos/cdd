import React from 'react';
import { render } from 'ink';
import {
  execInteractive,
  detectShell,
} from '../helpers/dockerService/serviceComponents/containerExec.js';
import { getInkApp, setInkApp } from '../helpers/appState.js';
import App from '../App.jsx';
import { logger } from '../helpers/logger.js';

/**
 * Open an interactive shell inside a Docker container.
 * Unmounts Ink, spawns `docker exec -it`, and re-renders the app on exit.
 *
 * @param {Object} container - Container object from Docker
 * @returns {Promise<void>}
 */
async function openShell(container) {
  if (!container) {
    return;
  }

  const isRunning =
    container.state === 'running' || container.status === 'running';
  if (!isRunning) {
    logger.warn(
      'Cannot open shell: container %s is not running',
      container.name
    );
    return;
  }

  const containerId = container.id;
  const containerName = container.name || containerId.slice(0, 12);

  // Unmount Ink to release the terminal
  const inkApp = getInkApp();
  if (inkApp && typeof inkApp.unmount === 'function') {
    inkApp.unmount();
  }

  // Clear the screen for a clean shell experience
  if (process.stdout && process.stdout.isTTY) {
    process.stdout.write('\u001Bc');
  }

  try {
    const shell = await detectShell(containerId);

    process.stdout.write(
      `\x1b[36m[shell]\x1b[0m Opening ${shell} in ${containerName} (${containerId.slice(0, 12)})...\r\n`
    );
    process.stdout.write(
      '\x1b[33mType "exit" or press Ctrl+D to return to CDD.\x1b[0m\r\n\r\n'
    );

    await execInteractive(containerId, { shell });
  } catch (err) {
    process.stdout.write(`\x1b[31m[shell] Error: ${err.message}\x1b[0m\r\n`);
    logger.error('Shell mode error', err);
  }

  // Small delay to let output settle
  await new Promise((r) => setTimeout(r, 100));

  // Re-render the app
  console.clear();
  const newApp = render(<App />);
  setInkApp(newApp);
}

/**
 * Hook that provides the shell mode API.
 * In practice, the heavy lifting (unmount/spawn/remount) is handled by
 * `openShell` outside the React tree. This hook just exposes a stable
 * reference for useControls.
 *
 * @returns {{ openShell: Function }}
 */
export function useShellMode() {
  return { openShell };
}
