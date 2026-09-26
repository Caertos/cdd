/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render } from '@testing-library/react';
import { jest } from '@jest/globals';
import { STRINGS } from '../src/helpers/strings.js';

afterEach(() => jest.resetModules());

// ContainerRow polls docker through useContainerStats when state is running;
// stub the hook so no unit test ever touches a real socket (§10).
async function loadRow(stats = { cpuPercent: '1.5', memPercent: '2.5' }) {
  await jest.unstable_mockModule('../src/hooks/useContainerStats.js', () => ({
    useContainerStats: () => ({ stats, statsError: '' }),
  }));
  const { default: ContainerRow } = await import(
    '../src/components/ContainerRow.jsx'
  );
  return ContainerRow;
}

async function renderRow(props, stats) {
  const Row = await loadRow(stats);
  return render(<Row {...props} />);
}

const base = {
  id: 'abc123',
  name: 'web',
  image: 'nginx:latest',
  state: 'exited',
  ports: [],
};

describe('ContainerRow', () => {
  test('truncates a long name to 18 chars (17 + ellipsis)', async () => {
    const { getByText } = await renderRow({
      container: { ...base, name: 'a'.repeat(30) },
    });
    expect(getByText('aaaaaaaaaaaaaaaaa…')).toBeTruthy();
  });

  test('truncates a long image to 18 chars', async () => {
    const { getByText } = await renderRow({
      container: { ...base, image: 'b'.repeat(30) },
    });
    expect(getByText('bbbbbbbbbbbbbbbbb…')).toBeTruthy();
  });

  test('running → RUNNING state text', async () => {
    const { getByText } = await renderRow({ container: { ...base, state: 'running' } });
    expect(getByText(STRINGS.stateRunning)).toBeTruthy();
  });

  test('exited → EXITED state text', async () => {
    const { getByText } = await renderRow({ container: { ...base, state: 'exited' } });
    expect(getByText(STRINGS.stateExited)).toBeTruthy();
  });

  test('paused → PAUSED state text', async () => {
    const { getByText } = await renderRow({ container: { ...base, state: 'paused' } });
    expect(getByText(STRINGS.statePaused)).toBeTruthy();
  });

  test('unknown state renders uppercased', async () => {
    const { getByText } = await renderRow({
      container: { ...base, state: 'restarting' },
    });
    expect(getByText('RESTARTING')).toBeTruthy();
  });

  test('ports get the link prefix', async () => {
    const { container } = await renderRow({
      container: { ...base, ports: ['8080:80', '9090:80'] },
    });
    expect(container.textContent).toContain('🔗 8080:80');
    expect(container.textContent).toContain('🔗 9090:80');
  });

  test('selected row shows the marker in green', async () => {
    const { getByText } = await renderRow({ container: base, isSelected: true });
    const marker = getByText('➤');
    expect(marker.getAttribute('data-color')).toBe('green');
  });

  test('unselected row shows blank space instead of the marker', async () => {
    const { container, queryByText } = await renderRow({
      container: base,
      isSelected: false,
    });
    expect(queryByText('➤')).toBeNull();
    expect(container.textContent).toContain('  ');
  });

  test('isStale dims every text', async () => {
    const { getByText } = await renderRow({ container: base, isStale: true });
    expect(getByText('web').getAttribute('data-dim')).toBe('gray');
    expect(getByText(STRINGS.stateExited).getAttribute('data-dim')).toBe('gray');
  });

  test('without isStale nothing is dimmed', async () => {
    const { getByText } = await renderRow({ container: base, isStale: false });
    expect(getByText('web').getAttribute('data-dim')).toBeNull();
  });

  test('StatsBar only renders when the container is running', async () => {
    const Row = await loadRow();
    const running = render(<Row container={{ ...base, state: 'running' }} />);
    expect(running.container.textContent).toContain('CPU:');
    running.unmount();

    const stopped = render(<Row container={{ ...base, state: 'exited' }} />);
    expect(stopped.container.textContent).not.toContain('CPU:');
  });
});
