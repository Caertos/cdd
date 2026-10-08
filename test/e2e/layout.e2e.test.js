/**
 * Layout tests against REAL Ink (Yoga): the jsdom unit suite mocks `ink` and
 * cannot observe line breaks, only structure. These render with
 * `ink-testing-library` (100 columns) and assert on the frame's line count.
 *
 * No Docker: `useContainerStats` is mocked with a mutable error string so the
 * same real components can be rendered in every state.
 */
import { jest } from '@jest/globals';
import React from 'react';
import { Box } from 'ink';
import { render } from 'ink-testing-library';
import { stripAnsi, renderApp } from './support/ink.js';
import { STRINGS } from '../../src/helpers/strings.js';

let statsError = '';

await jest.unstable_mockModule('../../src/hooks/useContainerStats.js', () => ({
  useContainerStats: () => ({
    stats: { cpuPercent: '0', memPercent: '0' },
    statsError,
  }),
}));

const { default: ContainerRow } =
  await import('../../src/components/ContainerRow.jsx');
const { default: ContainerSection } =
  await import('../../src/components/ContainerSection.jsx');

const lines = (frame) => stripAnsi(frame).replace(/\n+$/, '').split('\n');

const row = (id, name, state = 'exited') => ({
  id,
  name,
  image: 'nginx:latest',
  state,
  ports: [],
});

const manyRows = (count) =>
  Array.from({ length: count }, (_, i) => row(`id-${i + 1}`, `web-${i + 1}`));

describe('layout (real Ink)', () => {
  let ui;

  afterEach(() => {
    if (ui) ui.unmount();
    ui = undefined;
    statsError = '';
  });

  test('a row with long name and image stays on a single line', () => {
    ui = render(
      <ContainerRow
        container={{ ...row('id-1', 'a'.repeat(30)), image: 'b'.repeat(30) }}
      />
    );

    const frameLines = lines(ui.lastFrame());
    expect(frameLines).toHaveLength(1);
    expect(frameLines[0]).toContain('…');
  });

  test('two stacked rows render exactly two lines, with no blank line', () => {
    ui = render(
      <Box flexDirection="column">
        <ContainerRow container={row('id-1', 'web-1')} />
        <ContainerRow container={row('id-2', 'web-2')} />
      </Box>
    );

    const frameLines = lines(ui.lastFrame());
    expect(frameLines).toHaveLength(2);
    expect(frameLines[0]).toContain('web-1');
    expect(frameLines[1]).toContain('web-2');
  });

  test('a stats error keeps the row on one line', () => {
    statsError = 'Error fetching stats';
    ui = render(<ContainerRow container={row('id-1', 'web-1')} />);

    const frameLines = lines(ui.lastFrame());
    expect(frameLines).toHaveLength(1);
    // Same line as the state; the state column truncates the rest with `…`.
    expect(frameLines[0]).toContain('EXITED');
    expect(frameLines[0]).toContain('…');
  });

  test('ContainerSection windows the list and reports rows hidden below', () => {
    ui = render(
      <ContainerSection
        containers={manyRows(6)}
        selected={0}
        availableRows={3}
        connectionStatus="ok"
      />
    );

    const frame = stripAnsi(ui.lastFrame());
    expect(frame).toContain('web-1');
    expect(frame).toContain('web-3');
    expect(frame).not.toContain('web-4');
    expect(frame).not.toContain('web-6');
    expect(frame).toContain(STRINGS.listWindow.moreBelow(3));
  });

  test('ContainerSection scrolled reports rows hidden above', async () => {
    ui = renderApp(
      <ContainerSection
        containers={manyRows(6)}
        selected={5}
        availableRows={3}
        connectionStatus="ok"
      />
    );

    // The window recentres in an effect, one frame after the first render.
    await ui.waitForText(STRINGS.listWindow.moreAbove(3));

    const frame = ui.frame();
    expect(frame).toContain(STRINGS.listWindow.moreAbove(3));
    expect(frame).toContain('web-6');
    expect(frame).not.toContain('web-1');
  });
});
