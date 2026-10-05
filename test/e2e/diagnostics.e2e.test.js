import React from 'react';
import App from '../../src/App.jsx';
import { renderApp, KEY } from './support/ink.js';
import {
  cleanupAll,
  createExitedContainer,
  createTestContainer,
  docker,
  dockerAvailable,
  removeTestContainer,
  TINY_IMAGE,
} from './support/docker.js';

const hasDocker = await dockerAvailable();
const describeE2E = hasDocker ? describe : describe.skip;

if (!hasDocker) {
  console.warn('Docker not available — skipping the E2E suite');
}

/**
 * Renders the app with `target` selected.
 *
 * Navigating is a harness concern, not part of the feature: the panel
 * appears on its own for whichever failing container is selected. Detection
 * by eye is unreliable here because ContainerRow truncates long names with an
 * ellipsis, so the index is read from the same list the app uses.
 */
async function renderWithSelection(ui, target) {
  await ui.waitForText(target.name.slice(0, 17));
  const list = await docker.listContainers({ all: true });
  const index = list.findIndex((c) =>
    (c.Names || []).some((n) => n.replace(/^\//, '') === target.name)
  );
  if (index === -1) throw new Error(`Container ${target.name} not listed`);
  for (let i = 0; i < index; i++) {
    await ui.press(KEY.down);
  }
}

describeE2E('E2E — diagnosis panel', () => {
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

  test('a container that died is explained, with no key pressed afterwards', async () => {
    const { id, name } = await createExitedContainer('diag-dead');
    try {
      ui = renderApp(<App />);
      await renderWithSelection(ui, { name });

      // No diagnosis is requested: selecting a failing container is enough.
      await ui.waitForText('Diagnosis:', { label: 'the diagnosis panel' });

      const frame = ui.frame();
      expect(frame).toContain(name.slice(0, 17));
      // STRINGS.diagnostics.notRecognized — a container that printed nothing
      // must not be given a made-up cause.
      expect(frame).toMatch(/don't recognise it|wrote nothing to its log/);
    } finally {
      await removeTestContainer(id);
    }
  });

  test('the panel offers the full log, which is the L key', async () => {
    const { id, name } = await createExitedContainer('diag-hint');
    try {
      ui = renderApp(<App />);
      await renderWithSelection(ui, { name });
      await ui.waitForText('Diagnosis:', { label: 'the diagnosis panel' });

      // STRINGS.diagnostics.viewFullLog — L already opens the logs viewer.
      expect(ui.frame()).toContain('[L] Full log');
    } finally {
      await removeTestContainer(id);
    }
  });

  test('a log line is shown as evidence next to the cause', async () => {
    const { id, name } = await createExitedContainer('diag-output', {
      withOutput: true,
    });
    try {
      ui = renderApp(<App />);
      await renderWithSelection(ui, { name });
      await ui.waitForText('Diagnosis:', { label: 'the diagnosis panel' });

      // STRINGS.diagnostics.lastLines — the thing the user would have gone
      // and opened the viewer to see.
      expect(ui.frame()).toContain('Last lines:');
      expect(ui.frame()).toContain('boom: something went wrong');
    } finally {
      await removeTestContainer(id);
    }
  });

  test('a running container shows no panel at all', async () => {
    const { id, name } = await createTestContainer('diag-healthy', {
      image: TINY_IMAGE,
      create: { Cmd: ['sh', '-c', 'sleep 60'] },
    });
    try {
      ui = renderApp(<App />);
      await renderWithSelection(ui, { name });
      await ui.waitForText('RUNNING'); // STRINGS.health.running

      // Give the panel a chance to appear if it were ever going to.
      await ui
        .waitForTextGone('Diagnosis:', {
          timeout: 2000,
          label: 'no panel for a healthy container',
        })
        .catch(() => {
          throw new Error('Panel appeared for a healthy container');
        });
    } finally {
      await removeTestContainer(id);
    }
  });
});
