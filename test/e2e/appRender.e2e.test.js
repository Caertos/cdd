import React from 'react';
import App from '../../src/App.jsx';
import { renderApp } from './support/ink.js';
import {
  cleanupAll,
  createTestContainer,
  dockerAvailable,
  docker,
  removeTestContainer,
  TINY_IMAGE,
} from './support/docker.js';

const hasDocker = await dockerAvailable();
const describeE2E = hasDocker ? describe : describe.skip;

if (!hasDocker) {
  console.warn('Docker not available — skipping the E2E suite');
}

describeE2E('E2E — initial app render', () => {
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

  test('shows the header with the version and the container count', async () => {
    ui = renderApp(<App />);

    // STRINGS.containerFound: `${n} container${n === 1 ? '' : 's'} found`
    await ui.waitFor((f) => /\d+ containers? found/.test(f), {
      label: 'the header count',
    });

    expect(ui.frame()).toContain('CLI Docker Dashboard');
    expect(ui.frame()).toMatch(/v\d+\.\d+\.\d+|unknown/); // getAppVersion()
  });

  test('shows the newly created container with its name and RUNNING state', async () => {
    const { id, name } = await createTestContainer('render-running');
    try {
      ui = renderApp(<App />);
      // ContainerRow.truncate(s, 18) paints 17 chars + '…' when name exceeds 18.
      await ui.waitForText(name.slice(0, 17));
      expect(ui.frame()).toContain('RUNNING'); // STRINGS.stateRunning
    } finally {
      await removeTestContainer(id);
    }
  });

  test('a stopped container is rendered as EXITED', async () => {
    const { id } = await createTestContainer('render-exited', {
      image: TINY_IMAGE,
      create: { Cmd: ['true'], Tty: false },
    });
    try {
      ui = renderApp(<App />);
      await ui.waitForText('EXITED'); // STRINGS.stateExited
    } finally {
      await removeTestContainer(id);
    }
  });

  test('shows the published ports in the row', async () => {
    const { id } = await createTestContainer('render-ports', {
      create: {
        ExposedPorts: { '80/tcp': {} },
        HostConfig: { PortBindings: { '80/tcp': [{ HostPort: '18080' }] } },
      },
    });
    try {
      ui = renderApp(<App />);
      // containerList.getContainers() format: `${PublicPort}:${PrivatePort}`
      await ui.waitForText('18080:80');
    } finally {
      await removeTestContainer(id);
    }
  });

  test('with Docker OK and no containers shows the EmptyState', async () => {
    // Fragile precondition: requires ZERO containers on the machine.
    const all = await docker.listContainers({ all: true });
    if (all.length > 0) {
      console.warn('· skipped: the host has foreign containers');
      return;
    }
    ui = renderApp(<App />);
    await ui.waitForText('No containers yet.'); // STRINGS.emptyTitle
    expect(ui.frame()).toContain('Press [C] to create'); // STRINGS.emptyHint
  });
});
