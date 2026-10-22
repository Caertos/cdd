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

// The panel only appears with 12 chrome rows + 20 panel rows + 4 list rows to
// spare, i.e. on a terminal of at least 36. ink-testing-library reports no
// height, so without this the app falls back to 24 and hides the panel.
const TALL_ROWS = 40;

if (!hasDocker) {
  console.warn('Docker not available — skipping the E2E suite');
}

/**
 * Renders the app with `target` selected.
 *
 * Navigating is a harness concern, not part of the feature: the panel
 * appears on its own for whichever failing container is selected. Detection
 * by eye is unreliable here because ContainerRow truncates long names with an
 * ellipsis, so the marker is matched against the same 17-char prefix the row
 * shows.
 */
async function renderWithSelection(ui, target) {
  const prefix = target.name.slice(0, 17);
  await ui.waitForText(prefix);
  // The app sorts the list (problems first) while docker.listContainers does
  // not, and this daemon may hold other containers: counting indexes would
  // land on the wrong row. Arrow down until the marker sits on the target.
  const marked = () =>
    ui
      .frame()
      .split('\n')
      .some((line) => line.includes('➤') && line.includes(prefix));
  const list = await docker.listContainers({ all: true });
  for (let i = 0; i <= list.length && !marked(); i++) {
    await ui.press(KEY.down);
  }
  if (!marked()) throw new Error(`Selection never reached ${target.name}`);
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
      ui = renderApp(<App rows={TALL_ROWS} />);
      await renderWithSelection(ui, { name });

      // No diagnosis is requested: selecting a failing container is enough.
      await ui.waitForText('Diagnosis:', { label: 'the diagnosis panel' });
      // The log read is async and inspect lands separately, so the panel can
      // still be loading when the title first appears.
      await ui
        .waitForTextGone('Reading the log...', {
          timeout: 10000,
          label: 'the log read to finish',
        })
        .catch(() => {
          throw new Error('Panel never finished loading its log');
        });

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
      ui = renderApp(<App rows={TALL_ROWS} />);
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
      ui = renderApp(<App rows={TALL_ROWS} />);
      await renderWithSelection(ui, { name });
      await ui.waitForText('Diagnosis:', { label: 'the diagnosis panel' });
      // The log read is async, exactly as in the first case above: the panel
      // can still be loading when the title appears, so wait for it to land
      // before reading the evidence off the frame.
      await ui
        .waitForTextGone('Reading the log...', {
          timeout: 10000,
          label: 'the log read to finish',
        })
        .catch(() => {
          throw new Error('Panel never finished loading its log');
        });

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
      ui = renderApp(<App rows={TALL_ROWS} />);
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

describeE2E('E2E — recreate with the fix', () => {
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

  /**
   * A container that fails because POSTGRES_PASSWORD is missing: exactly the
   * case TASK-8 §1 promises to explain. The log line is what the catalog
   * recognises, so the fix is the missing variable.
   */
  async function createUnconfiguredPostgres(suffix) {
    return createExitedContainer(suffix, {
      image: 'postgres:17-alpine',
      cmd: [
        'sh',
        '-c',
        'echo "Error: Database is uninitialized and superuser password is not specified." >&2; exit 1',
      ],
    });
  }

  test('the panel offers F and the review shows what CDD changed', async () => {
    const { id, name } = await createUnconfiguredPostgres('fix-review');
    try {
      ui = renderApp(<App rows={TALL_ROWS} />);
      await renderWithSelection(ui, { name });

      // The panel names the cause and advertises the key.
      await ui.waitForText('Likely cause:', { label: 'the diagnosis panel' });
      await ui.waitForText('[F]', { label: 'the fix key' });

      await ui.press('F');

      // Straight to the review, with the changed row marked.
      await ui.waitForText('Review and confirm', { label: 'the review step' });
      await ui.waitForText('changed by CDD', { label: 'the changed marker' });
      expect(ui.frame()).toContain('POSTGRES_PASSWORD');

      // And it went to name-2: the old container still owns the name.
      expect(ui.frame()).toContain(`${name}-2`);
    } finally {
      await removeTestContainer(id);
    }
  });

  test('creating from the fix asks about the container that failed', async () => {
    const { id, name } = await createUnconfiguredPostgres('fix-create');
    try {
      ui = renderApp(<App rows={TALL_ROWS} />);
      await renderWithSelection(ui, { name });
      await ui.waitForText('[F]', { label: 'the fix key' });

      await ui.press('F');
      await ui.waitForText('Review and confirm', { label: 'the review step' });

      await ui.press(KEY.enter); // create

      // Asked, not done. The failed container may hold something unread.
      await ui.waitForText('Delete', { label: 'the cleanup question' });
      expect(ui.frame()).toContain(name);

      // Answering "no" leaves it in place.
      await ui.press('n');
      await ui.waitForText('kept', { label: 'the kept confirmation' });

      const stillThere = await docker
        .getContainer(id)
        .inspect()
        .then(() => true)
        .catch(() => false);
      expect(stillThere).toBe(true);
    } finally {
      await removeTestContainer(id);
    }
  });
});
