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
import { selectContainer } from './support/selection.js';

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
      await selectContainer(ui, name);
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
      await selectContainer(ui, name);
      await ui.press('l');
      await ui.waitForText('No logs...');
    } finally {
      await removeTestContainer(id);
    }
  });

  test('a stopped container is read whole: Home reaches the first line and says it is the start', async () => {
    // More lines than a live container's 2000-line tail, so only a whole read
    // can show line 1.
    const { id, name, container } = await createTestContainer('logs-whole', {
      image: TINY_IMAGE,
      create: {
        Cmd: ['sh', '-c', 'i=1; while [ $i -le 3000 ]; do echo WHOLE_LINE_$i; i=$((i+1)); done'],
      },
    });
    try {
      await container.wait();
      ui = renderApp(<App />);
      await selectContainer(ui, name);
      await ui.press('l');
      await ui.waitForText('WHOLE_LINE_3000');
      await ui.press(KEY.home);
      await ui.waitForText('start of log');
      // `_1` must not be satisfied by `_1000`, `_1001`…
      expect(ui.frame()).toMatch(/WHOLE_LINE_1(?!\d)/);
    } finally {
      await removeTestContainer(id);
    }
  });

  test('a running container offers earlier lines and Ctrl+U reaches the start', async () => {
    const { id, name } = await createTestContainer('logs-earlier', {
      image: TINY_IMAGE,
      create: {
        Cmd: ['sh', '-c', 'i=1; while [ $i -le 3000 ]; do echo EARLY_LINE_$i; i=$((i+1)); done; sleep 300'],
      },
    });
    try {
      ui = renderApp(<App />);
      await selectContainer(ui, name);
      await ui.press('l');
      await ui.waitForText('EARLY_LINE_3000');
      await ui.press(KEY.home);
      await ui.waitForText('[Ctrl+U] load earlier lines');

      await ui.press(KEY.ctrlU);
      // The reading position is kept: the window stays on line 1001 while the
      // older lines load above it. Going back to the top shows them.
      await ui.waitForText('EARLY_LINE_1001');
      for (let tries = 0; tries < 20 && !ui.frame().includes('start of log'); tries++) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        await ui.press(KEY.home);
      }
      await ui.waitForText('start of log');
      expect(ui.frame()).toMatch(/EARLY_LINE_1(?!\d)/);
    } finally {
      await removeTestContainer(id);
    }
  });
});

