/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render } from '@testing-library/react';
import { jest } from '@jest/globals';
import ContainerRow from '../src/components/ContainerRow.jsx';
import { STRINGS } from '../src/helpers/strings.js';

const renderRow = (props) => render(<ContainerRow {...props} />);

const base = {
  id: 'abc123',
  name: 'web',
  image: 'nginx:latest',
  state: 'exited',
  ports: [],
};

describe('ContainerRow', () => {
  test('truncates a long name to 18 chars (17 + ellipsis)', () => {
    const { getByText } = renderRow({
      container: { ...base, name: 'a'.repeat(30) },
    });
    expect(getByText('aaaaaaaaaaaaaaaaa…')).toBeTruthy();
  });

  test('truncates a long image to 18 chars', () => {
    const { getByText } = renderRow({
      container: { ...base, image: 'b'.repeat(30) },
    });
    expect(getByText('bbbbbbbbbbbbbbbbb…')).toBeTruthy();
  });

  test('running → RUNNING state text', () => {
    const { getByText } = renderRow({
      container: { ...base, state: 'running' },
    });
    expect(getByText(STRINGS.stateRunning)).toBeTruthy();
  });

  test('exited → EXITED state text', () => {
    const { getByText } = renderRow({
      container: { ...base, state: 'exited' },
    });
    expect(getByText(STRINGS.stateExited)).toBeTruthy();
  });

  test('paused → PAUSED state text', () => {
    const { getByText } = renderRow({
      container: { ...base, state: 'paused' },
    });
    expect(getByText(STRINGS.statePaused)).toBeTruthy();
  });

  test('unknown state renders uppercased', () => {
    const { getByText } = renderRow({
      container: { ...base, state: 'restarting' },
    });
    expect(getByText('RESTARTING')).toBeTruthy();
  });

  test('ports get the link prefix', () => {
    const { container } = renderRow({
      container: { ...base, ports: ['8080:80', '9090:80'] },
    });
    expect(container.textContent).toContain('🔗 8080:80');
    expect(container.textContent).toContain('🔗 9090:80');
  });

  test('stats error renders on the same line as the state text, in red', () => {
    const { container } = renderRow({
      container: { ...base, state: 'running' },
      stats: { cpuPercent: '1.5', memPercent: '2.5' },
      statsError: 'Error fetching stats',
    });

    // The error keeps its own red colour inside the state node, so it never
    // spills to a second line.
    const errorNode = Array.from(container.querySelectorAll('span')).find(
      (el) => el.textContent === ' Error fetching stats'
    );
    expect(errorNode).toBeTruthy();
    expect(errorNode.getAttribute('data-color')).toBe('red');

    const stateNode = errorNode.parentElement;
    expect(stateNode.textContent).toContain(STRINGS.stateRunning);
    expect(stateNode.textContent).toContain('Error fetching stats');
  });

  test('selected row shows the marker in green', () => {
    const { getByText } = renderRow({
      container: base,
      isSelected: true,
    });
    const marker = getByText('➤');
    expect(marker.getAttribute('data-color')).toBe('green');
  });

  test('unselected row shows blank space instead of the marker', () => {
    const { container, queryByText } = renderRow({
      container: base,
      isSelected: false,
    });
    expect(queryByText('➤')).toBeNull();
    // A single blank in the marker cell: two spaces overflow its one-column
    // content area and real Ink wraps them onto a second line.
    expect(container.textContent.startsWith(' ')).toBe(true);
  });

  test('isStale dims every text', () => {
    const { getByText } = renderRow({ container: base, isStale: true });
    expect(getByText('web').getAttribute('data-dim')).toBe('gray');
    expect(getByText(STRINGS.stateExited).getAttribute('data-dim')).toBe(
      'gray'
    );
  });

  test('without isStale nothing is dimmed', () => {
    const { getByText } = renderRow({ container: base, isStale: false });
    expect(getByText('web').getAttribute('data-dim')).toBeNull();
  });

  test('StatsBar only renders when the container is running', () => {
    const running = render(
      <ContainerRow
        container={{ ...base, state: 'running' }}
        stats={{ cpuPercent: '1.5', memPercent: '2.5' }}
      />
    );
    expect(running.container.textContent).toContain('CPU:');
    running.unmount();

    const stopped = render(<ContainerRow container={{ ...base, state: 'exited' }} />);
    expect(stopped.container.textContent).not.toContain('CPU:');
  });

  // §5.8 (D12) — fixed by TASK-7 (null-safe stateText).
  test('missing state renders without throwing', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { container } = renderRow({
        container: { ...base, state: undefined },
      });
      expect(container.textContent).toContain('web');
    } finally {
      spy.mockRestore();
    }
  });

  test('renders a health verdict headline with its level colour', () => {
    const { getByText } = renderRow({
      container: { ...base, state: 'exited' },
      verdict: {
        code: 'stopped',
        level: 'idle',
        headline: 'stopped',
        facts: {},
      },
    });
    const el = getByText('⚪ stopped');
    expect(el.getAttribute('data-color')).toBe('gray');
  });

  test('crash-loop verdict is shown in red', () => {
    const { getByText } = renderRow({
      container: { ...base, state: 'exited' },
      verdict: {
        code: 'crash-loop',
        level: 'fail',
        headline: 'died 2s',
        facts: {},
      },
    });
    const el = getByText('🔴 died 2s');
    expect(el.getAttribute('data-color')).toBe('red');
  });
});
