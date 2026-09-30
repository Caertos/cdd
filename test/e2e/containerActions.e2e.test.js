import React from 'react';
import App from '../../src/App.jsx';
import { renderApp, KEY } from './support/ink.js';
import {
  cleanupAll,
  createTestContainer,
  dockerAvailable,
  docker,
  inspectSafe,
  removeTestContainer,
  waitForGone,
  waitForState,
} from './support/docker.js';

const hasDocker = await dockerAvailable();
const describeE2E = hasDocker ? describe : describe.skip;

if (!hasDocker) {
  console.warn('Docker not available — skipping the E2E suite');
}

describeE2E('E2E — container actions', () => {
  let ui = null;
  let target = null;

  beforeAll(async () => {
    await cleanupAll();
  });

  beforeEach(async () => {
    target = await createTestContainer(`act-${Date.now()}`);
  });

  afterEach(async () => {
    ui?.unmount();
    ui = null;
    if (target) await removeTestContainer(target.id);
    target = null;
  });

  afterAll(async () => {
    await cleanupAll();
  });

  /**
   * Renders the app and leaves the test container selected.
   *
   * Visual detection is unreliable: ContainerRow truncates the name with an
   * ellipsis that can push the name onto a different line than the '➤' marker
   * when the row wraps. Instead, find the container's index in the same list
   * order the app uses (docker.listContainers) and navigate down to it.
   */
  async function renderWithSelection() {
    ui = renderApp(<App />);
    await ui.waitForText(target.name.slice(0, 17));

    const list = await docker.listContainers({ all: true });
    const index = list.findIndex((c) =>
      (c.Names || []).some((n) => n.replace(/^\//, '') === target.name)
    );
    if (index === -1) throw new Error(`Container ${target.name} not listed`);

    // Selection starts at 0; move down to the test container's row.
    for (let i = 0; i < index; i++) {
      await ui.press(KEY.down);
    }
    return ui;
  }

  test('p stops the container', async () => {
    await renderWithSelection();
    await ui.press('p');
    await ui.waitForText('Stopping container successful.');
    await waitForState(target.id, 'exited');
  });

  test('i starts a stopped container', async () => {
    await docker.getContainer(target.id).stop();
    await waitForState(target.id, 'exited');

    await renderWithSelection();
    await ui.press('i');
    await ui.waitForText('Starting container successful.');
    await waitForState(target.id, 'running');
  });

  test('i on an already-running container warns without calling Docker', async () => {
    await renderWithSelection();
    await ui.press('i');
    // stateCheck in useControls['container.start']
    await ui.waitForText('Container is already running.');
  });

  test('r restarts the container (StartedAt changes)', async () => {
    const before = (await inspectSafe(target.id)).State.StartedAt;
    await renderWithSelection();
    await ui.press('r');
    await ui.waitForText('Restarting container successful.');
    const after = (await inspectSafe(target.id)).State.StartedAt;
    expect(after).not.toBe(before);
  });

  test('e asks for confirmation and with y removes the container', async () => {
    await renderWithSelection();
    await ui.press('e');
    await ui.waitForText('Are you sure you want to erase this container?');
    await ui.press('y');
    await ui.waitForText('Erasing container successful.');
    await waitForGone(target.id);
    target = null; // no longer needs cleanup
  });

  test('e + n cancels: the container still exists', async () => {
    await renderWithSelection();
    await ui.press('e');
    await ui.waitForText('Are you sure you want to erase this container?');
    await ui.press('n');
    await ui.waitForTextGone('Are you sure you want to erase');
    expect(await inspectSafe(target.id)).not.toBeNull();
  });
});
