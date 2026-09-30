import React from 'react';
import App from '../../src/App.jsx';
import { renderApp, KEY } from './support/ink.js';
import {
  PREFIX,
  cleanupAll,
  dockerAvailable,
  findByName,
  publishedPorts,
  removeImageIfPresent,
  TINY_IMAGE,
} from './support/docker.js';
import { freePort } from './support/ports.js';

const hasDocker = await dockerAvailable();
const describeE2E = hasDocker ? describe : describe.skip;

if (!hasDocker) {
  console.warn('Docker not available — skipping the E2E suite');
}

describeE2E('E2E — container creation wizard', () => {
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

  test('full wizard: image → name → ports → env → review → create', async () => {
    const name = `${PREFIX}web`;
    const hostPort = await freePort();

    ui = renderApp(<App />);
    await ui.waitFor((f) => /containers? found/.test(f));

    // ── Enter the wizard ──
    await ui.press('c');
    await ui.waitForText('Name of the image to create');

    // ── Step 0: image ──
    await ui.type('nginx');
    // Typing opens the suggestion list; with it open the context is 'wizard-list'
    // and Enter SELECTS instead of advancing. Close it with Esc.
    await ui.waitForText('nginx');
    await ui.press(KEY.escape);
    await ui.press(KEY.enter);

    // resolveImageTag('nginx') -> 'nginx:1.27-alpine' (IMAGE_PROFILES.nginx.defaultTag)
    await ui.waitForText('Name of the container');

    // ── Step 1: name ──
    await ui.type(name);
    await ui.press(KEY.enter);
    await ui.waitForText('Ports (optional');

    // ── Step 2: ports ──
    await ui.type(`${hostPort}:80`);
    await ui.press(KEY.enter);
    await ui.waitForText('Environment variables (optional');

    // ── Step 3: empty env ──
    await ui.press(KEY.enter);

    // ── Step 4: review ──
    await ui.waitForText('Review and confirm');
    expect(ui.frame()).toContain('nginx:1.27-alpine');
    expect(ui.frame()).toContain(name.slice(0, 17));
    expect(ui.frame()).toContain(String(hostPort));

    // ── Confirm ──
    await ui.press(KEY.enter);
    await ui.waitForText('Created container'); // useControls.onCreate

    // ── Verification against real Docker ──
    const found = await findByName(name);
    expect(found).not.toBeNull();
    const ports = await publishedPorts(found.Id);
    expect(ports['80/tcp']).toBe(String(hostPort));
  });

  test('non-local image: it is pulled and the container is still created', async () => {
    const name = `${PREFIX}pulled`;
    await removeImageIfPresent(TINY_IMAGE);

    ui = renderApp(<App />);
    await ui.waitFor((f) => /containers? found/.test(f));

    await ui.press('c');
    await ui.waitForText('Name of the image to create');
    await ui.type(TINY_IMAGE); // 'busybox:1.36' has a tag, no suggestions open
    await ui.press(KEY.enter);

    await ui.waitForText('Name of the container');
    await ui.type(name);
    await ui.press(KEY.enter); // -> ports
    await ui.press(KEY.enter); // -> env
    await ui.press(KEY.enter); // -> review
    await ui.waitForText('Review and confirm');
    await ui.press(KEY.enter); // -> create (triggers the pull)

    await ui.waitForText('Created container', { timeout: 90000 });
    expect(await findByName(name)).not.toBeNull();
  }, 120000);

  test('Esc on an intermediate step goes back, not cancel', async () => {
    ui = renderApp(<App />);
    await ui.waitFor((f) => /containers? found/.test(f));

    await ui.press('c');
    await ui.type('nginx');
    await ui.press(KEY.escape); // close suggestions
    await ui.press(KEY.enter); // -> step 1
    await ui.waitForText('Name of the container');

    await ui.press(KEY.escape); // back to step 0
    await ui.waitForText('Name of the image to create');
    // Hint shown once per wizard session (showBackHintOnce)
    expect(ui.frame()).toContain('Esc now goes back one step');
  });

  test('Esc on step 0 with data asks for discard confirmation', async () => {
    ui = renderApp(<App />);
    await ui.waitFor((f) => /containers? found/.test(f));

    await ui.press('c');
    await ui.type('nginx');
    await ui.press(KEY.escape); // close suggestions
    await ui.press(KEY.escape); // step 0 WITH data -> confirmation
    await ui.waitForText('Discard this container?'); // STRINGS.wizard.discardTitle

    await ui.press('y'); // confirm-discard.yes
    await ui.waitFor((f) => /containers? found/.test(f));
    expect(ui.frame()).not.toContain('Discard this container?');
  });

  test('from the review, [3] goes back to edit ports and Enter returns to the review', async () => {
    const name = `${PREFIX}edit`;
    const hostPort = await freePort();

    ui = renderApp(<App />);
    await ui.waitFor((f) => /containers? found/.test(f));

    await ui.press('c');
    await ui.type('nginx');
    await ui.press(KEY.escape);
    await ui.press(KEY.enter);
    await ui.waitForText('Name of the container');
    await ui.type(name);
    await ui.press(KEY.enter);
    await ui.press(KEY.enter); // empty ports
    await ui.press(KEY.enter); // empty env
    await ui.waitForText('Review and confirm');

    await ui.press('3'); // wizard-review.edit-3 -> step 2
    await ui.waitForText('Ports (optional');
    await ui.type(`${hostPort}:80`);
    await ui.press(KEY.enter); // returnToReview -> back to the review

    await ui.waitForText('Review and confirm');
    expect(ui.frame()).toContain(String(hostPort));
  });

  test('env with a secret: the review masks it and Ctrl+R reveals it', async () => {
    const name = `${PREFIX}secret`;

    ui = renderApp(<App />);
    await ui.waitFor((f) => /containers? found/.test(f));

    await ui.press('c');
    await ui.type('postgres');
    await ui.press(KEY.escape);
    await ui.press(KEY.enter); // -> postgres:17-alpine
    await ui.waitForText('Name of the container');
    await ui.type(name);
    await ui.press(KEY.enter);
    await ui.press(KEY.enter); // empty ports
    await ui.waitForText('Environment variables');
    await ui.type('POSTGRES_PASSWORD=SuperSecreto123');

    await ui.press(KEY.ctrlR); // secrets.reveal (step 3 + hasSecrets)
    await ui.waitForText('SuperSecreto123');
    await ui.press(KEY.ctrlR);
    await ui.waitForTextGone('SuperSecreto123');
  });
});
