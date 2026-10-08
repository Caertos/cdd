/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render } from '@testing-library/react';
import { jest } from '@jest/globals';
import { STRINGS } from '../src/helpers/strings.js';

const mockUseSharedContainerStats = jest.fn();
await jest.unstable_mockModule(
  '../src/hooks/useSharedContainerStats.js',
  () => ({ useSharedContainerStats: mockUseSharedContainerStats })
);

const { default: ContainerList } =
  await import('../src/components/ContainerList.jsx');

const row = (id, name, state = 'exited') => ({
  id,
  name,
  image: 'nginx:latest',
  state,
  ports: [],
});

const manyRows = (count) =>
  Array.from({ length: count }, (_, i) => row(`id-${i + 1}`, `web-${i + 1}`));

describe('ContainerList', () => {
  beforeEach(() => {
    // No Docker and no interval: the shared poller is mocked out.
    mockUseSharedContainerStats.mockReset();
    mockUseSharedContainerStats.mockReturnValue({
      stats: new Map(),
      errors: new Map(),
    });
  });

  test('marks the row at the selected index with the marker', () => {
    const { container } = render(
      <ContainerList
        containers={[row('id-1', 'web-1'), row('id-2', 'web-2')]}
        selected={1}
      />
    );

    const markers = [...container.querySelectorAll('span')].filter(
      (s) => s.textContent === '➤'
    );
    expect(markers).toHaveLength(1);

    // The marker lives in the same row box as the selected container name.
    const selectedRow = markers[0].closest('div').parentElement;
    expect(selectedRow.textContent).toContain('web-2');
    expect(selectedRow.textContent).not.toContain('web-1');
  });

  test('renders one row per container (keyed by container.id)', () => {
    // React keys are not observable in the DOM; unique ids must simply render
    // every row without warnings or omissions.
    const { container } = render(
      <ContainerList
        containers={[row('id-1', 'web-1'), row('id-2', 'web-2')]}
        selected={0}
      />
    );
    expect(container.textContent).toContain('web-1');
    expect(container.textContent).toContain('web-2');
  });

  test('empty list renders nothing', () => {
    const { container } = render(<ContainerList containers={[]} />);
    expect(container.textContent).toBe('');
  });

  test('isStale is propagated to every row', () => {
    const { getByText } = render(
      <ContainerList containers={[row('id-1', 'web-1')]} selected={0} isStale />
    );
    expect(getByText('web-1').getAttribute('data-dim')).toBe('gray');
  });

  test('windows the list and reports the rows hidden below', () => {
    const { getByText, queryByText } = render(
      <ContainerList containers={manyRows(5)} selected={0} availableRows={3} />
    );

    expect(getByText('web-1')).toBeTruthy();
    expect(getByText('web-3')).toBeTruthy();
    expect(queryByText('web-4')).toBeNull();
    expect(queryByText('web-5')).toBeNull();
    expect(getByText(STRINGS.listWindow.moreBelow(2))).toBeTruthy();
    expect(queryByText(STRINGS.listWindow.moreAbove(1))).toBeNull();
  });

  test('scrolls the window and reports the rows hidden above', () => {
    const { getByText, queryByText } = render(
      <ContainerList containers={manyRows(5)} selected={4} availableRows={3} />
    );

    // Selection recentres: window covers web-3..web-5, two rows hidden above.
    expect(getByText(STRINGS.listWindow.moreAbove(2))).toBeTruthy();
    expect(queryByText(STRINGS.listWindow.moreBelow(1))).toBeNull();
    expect(queryByText('web-1')).toBeNull();
    expect(getByText('web-5')).toBeTruthy();
  });

  test('keeps the selected row marked when it falls inside the window', () => {
    const { container } = render(
      <ContainerList containers={manyRows(5)} selected={4} availableRows={3} />
    );

    const markers = [...container.querySelectorAll('span')].filter(
      (s) => s.textContent === '➤'
    );
    expect(markers).toHaveLength(1);
    const selectedRow = markers[0].closest('div').parentElement;
    expect(selectedRow.textContent).toContain('web-5');
  });

  test('polls only the visible slice, never the hidden rows', () => {
    render(
      <ContainerList containers={manyRows(4)} selected={0} availableRows={2} />
    );

    const [windowed] = mockUseSharedContainerStats.mock.calls.at(-1);
    const ids = windowed.map((c) => c.id);
    expect(ids).toEqual(['id-1', 'id-2']);
    expect(ids).not.toContain('id-3');
    expect(ids).not.toContain('id-4');
  });

  test('a running row reads its stats from the shared Map', () => {
    mockUseSharedContainerStats.mockReturnValue({
      stats: new Map([['id-1', { cpuPercent: '5.0', memPercent: '6.0' }]]),
      errors: new Map(),
    });

    const { container } = render(
      <ContainerList
        containers={[{ ...row('id-1', 'web-1'), state: 'running' }]}
        selected={0}
      />
    );

    expect(container.textContent).toContain('CPU:');
    expect(container.textContent).toContain('5');
  });
});
