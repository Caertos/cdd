import React from 'react';
import App from '../../src/App.jsx';
import { renderApp } from './support/ink.js';
import { cleanupAll, dockerAvailable } from './support/docker.js';

const hasDocker = await dockerAvailable();
const describeE2E = hasDocker ? describe : describe.skip;

if (!hasDocker) {
  console.warn('Docker not available — skipping the E2E suite');
}

describeE2E('E2E — help and debug panel', () => {
  let ui = null;

  beforeAll(async () => {
    await cleanupAll();
  });
  afterEach(() => {
    ui?.unmount();
    ui = null;
  });

  test('? opens the help panel and ? closes it', async () => {
    ui = renderApp(<App />);
    await ui.waitFor((f) => /containers? found/.test(f));

    await ui.press('?');
    await ui.waitForText('Press ? or Esc to close');
    expect(ui.frame()).toContain('Help —');

    await ui.press('?');
    await ui.waitForTextGone('Press ? or Esc to close');
  });

  test('d opens the debug panel and d closes it', async () => {
    ui = renderApp(<App />);
    await ui.waitFor((f) => /containers? found/.test(f));

    await ui.press('d');
    await ui.waitForText('Debug log — press D or ESC to close');
    await ui.press('d');
    await ui.waitForTextGone('Debug log — press D or ESC to close');
  });
});
