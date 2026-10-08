/**
 * Layout tests against REAL Ink (Yoga): the jsdom unit suite mocks `ink` and
 * cannot observe line breaks, only structure. These render with
 * `ink-testing-library` (100 columns) and assert on the frame's line count.
 *
 * No Docker: `useSharedContainerStats` is mocked so the same real components
 * can be rendered without touching a socket or starting an interval. Rows
 * receive their stats through props.
 */
import { jest } from '@jest/globals';
import React from 'react';
import { Box } from 'ink';
import { render } from 'ink-testing-library';
import { stripAnsi, renderApp } from './support/ink.js';
import { STRINGS } from '../../src/helpers/strings.js';

await jest.unstable_mockModule(
  '../../src/hooks/useSharedContainerStats.js',
  () => ({
    useSharedContainerStats: () => ({ stats: new Map(), errors: new Map() }),
  })
);

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

  test('at the app width, the name prefix and the ports share the row line', () => {
    // The window budget only works if a row still fits at the width App gives
    // it: 100 columns minus the enclosing border and padding. A cell that
    // shrinks too far re-truncates the name, and the ports get cut off.
    ui = render(
      <Box borderStyle="round" padding={1}>
        <ContainerRow
          container={{
            ...row('id-1', 'cdd-e2e-render-ports'),
            image: 'nginx:1.27-alpine',
            state: 'running',
            ports: ['18080:80'],
          }}
          stats={{ cpuPercent: '0', memPercent: '0' }}
          isSelected
        />
      </Box>
    );

    const rowLine = lines(ui.lastFrame()).find((l) => l.includes('18080:80'));
    expect(rowLine).toBeDefined();
    // The 17-char prefix the other e2e suites wait for, on the same line.
    expect(rowLine).toContain('cdd-e2e-render-po');
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
    ui = render(
      <ContainerRow container={row('id-1', 'web-1')} statsError="Error fetching stats" />
    );

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
