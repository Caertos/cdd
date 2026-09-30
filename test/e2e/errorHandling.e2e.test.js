import React from 'react';
import App from '../../src/App.jsx';
import { renderApp, KEY } from './support/ink.js';
import {
  PREFIX,
  cleanupAll,
  createTestContainer,
  dockerAvailable,
  removeTestContainer,
} from './support/docker.js';

const hasDocker = await dockerAvailable();
const describeE2E = hasDocker ? describe : describe.skip;

if (!hasDocker) {
  console.warn('Docker not available — skipping the E2E suite');
}

describeE2E('E2E — error handling', () => {
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

  test('nonexistent image: shows the error and the app does not crash', async () => {
    ui = renderApp(<App />);
    await ui.waitFor((f) => /containers? found/.test(f));

    await ui.press('c');
    await ui.waitForText('Name of the image to create');
    await ui.type('cdd-no-existe-xyz:latest');
    await ui.press(KEY.enter);
    await ui.waitForText('Name of the container');
    await ui.press(KEY.enter); // empty name (optional)
    await ui.press(KEY.enter); // empty ports
    await ui.press(KEY.enter); // empty env
    await ui.waitForText('Review and confirm');
    await ui.press(KEY.enter);

    // useControls.onCreate -> `Error creating container: ${err.message}`
    // createContainer wraps the pull failure in 'Could not pull image: ...'
    await ui.waitForText('Error creating container', { timeout: 60000 });
    // The app returns to the list, it does not crash
    await ui.waitFor((f) => /containers? found/.test(f));
  }, 90000);

  test('duplicate name: Docker rejects the creation', async () => {
    const name = `${PREFIX}dup`;
    const existing = await createTestContainer('dup');
    try {
      ui = renderApp(<App />);
      await ui.waitForText(name.slice(0, 17));

      await ui.press('c');
      await ui.waitForText('Name of the image to create');
      await ui.type('nginx');
      await ui.press(KEY.escape);
      await ui.press(KEY.enter);
      await ui.waitForText('Name of the container');
      await ui.type(name);
      await ui.press(KEY.enter);
      await ui.press(KEY.enter);
      await ui.press(KEY.enter);
      await ui.waitForText('Review and confirm');
      // buildCreationWarnings should already warn about the name in use
      await ui.press(KEY.enter);

      await ui.waitForText('Error creating container');
      expect(ui.frame()).toMatch(/already in use/i);
    } finally {
      await removeTestContainer(existing.id);
    }
  });
});
