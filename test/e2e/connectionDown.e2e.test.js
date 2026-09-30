import React from 'react';
import { renderApp } from './support/ink.js';

// dockerService.js instantiates `new Docker()` at import time, so DOCKER_HOST
// must be set BEFORE App is imported. A nonexistent socket makes dockerode fail
// with ENOENT -> classifyDockerError -> 'not-running'.
//
// Save the original value and restore it in afterAll: the override would
// otherwise leak into the other E2E suites (process.env is shared).
const originalDockerHost = process.env.DOCKER_HOST;
process.env.DOCKER_HOST = 'unix:///tmp/cdd-e2e-no-docker.sock';

const { default: App } = await import('../../src/App.jsx');

describe('E2E — Docker unreachable', () => {
  let ui = null;
  afterEach(() => {
    ui?.unmount();
    ui = null;
  });
  afterAll(() => {
    if (originalDockerHost === undefined) {
      delete process.env.DOCKER_HOST;
    } else {
      process.env.DOCKER_HOST = originalDockerHost;
    }
  });

  test('shows the ConnectionNotice with the platform hints', async () => {
    ui = renderApp(<App />);
    await ui.waitForText("Can't reach Docker"); // STRINGS.connection.notRunning.title
    expect(ui.frame()).toContain(
      "The Docker service doesn't seem to be running"
    );
    expect(ui.frame()).toContain('[R] retry now');
    expect(ui.frame()).toContain('[Q] quit');
  });

  // Do NOT press Q: `q` unmounts the App. Under Jest it no longer calls
  // process.exit(0), but it still ruins the render.
});
