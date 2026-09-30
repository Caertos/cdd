import React from 'react';
import App from '../../src/App.jsx';
import { renderApp, KEY } from './support/ink.js';
import {
  cleanupAll,
  createTestContainer,
  dockerAvailable,
  removeTestContainer,
  TINY_IMAGE,
} from './support/docker.js';

const hasDocker = await dockerAvailable();
const describeE2E = hasDocker ? describe : describe.skip;

if (!hasDocker) {
  console.warn('Docker not available — skipping the E2E suite');
}

describeE2E('E2E — log viewer', () => {
  let ui = null;

  beforeAll(async () => {
    await cleanupAll();
  });
  afterEach(() => {
    ui?.unmount();
    ui = null;
  });
  afterAll(async () => {
    await cleanupAll();
  });

  test('l opens the viewer with the container lines and Esc closes it', async () => {
    const { id, name } = await createTestContainer('logs', {
      image: TINY_IMAGE,
      create: {
        Cmd: ['sh', '-c', 'while true; do echo CDD_LOG_LINE; sleep 1; done'],
      },
    });
    try {
      ui = renderApp(<App />);
      await ui.waitForText(name.slice(0, 17));
      await ui.press('l');
      // LogViewer: `${container.name} logs, press ESC to exit`
      await ui.waitForText('logs, press ESC to exit');
      await ui.waitForText('CDD_LOG_LINE');

      await ui.press(KEY.escape);
      await ui.waitForTextGone('logs, press ESC to exit');
    } finally {
      await removeTestContainer(id);
    }
  });

  test('a container with no output shows "No logs..."', async () => {
    const { id, name } = await createTestContainer('logs-empty', {
      image: TINY_IMAGE,
      create: { Cmd: ['sleep', '120'] },
    });
    try {
      ui = renderApp(<App />);
      await ui.waitForText(name.slice(0, 17));
      await ui.press('l');
      await ui.waitForText('No logs...');
    } finally {
      await removeTestContainer(id);
    }
  });
});
