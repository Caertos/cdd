/**
 * @jest-environment jsdom
 */
import React, { useEffect } from 'react';
import { render, act } from '@testing-library/react';
import { jest } from '@jest/globals';

const mockGetMany = jest.fn();
await jest.unstable_mockModule(
  '../src/helpers/dockerService/serviceComponents/containerInspect.js',
  () => ({ getManyContainerDetails: mockGetMany })
);

const { useContainerHealth } = await import(
  '../src/hooks/useContainerHealth.js'
);

function HookTester({ containers, expose }) {
  const hook = useContainerHealth(containers);
  useEffect(() => {
    expose.current = hook;
  });
  return null;
}

const list = [
  { id: 'a', state: 'running', status: 'Up 5 minutes' },
  { id: 'b', state: 'exited', status: 'Exited (0) 1 hour ago' },
];

describe('useContainerHealth', () => {
  beforeEach(() => {
    mockGetMany.mockReset().mockResolvedValue(new Map());
  });

  test('inspects only the containers whose status changed', async () => {
    const expose = { current: null };
    const { rerender } = render(
      <HookTester containers={list} expose={expose} />
    );
    await act(async () => {});

    expect(mockGetMany).toHaveBeenCalledTimes(1);
    expect(mockGetMany.mock.calls[0][0]).toEqual(['a', 'b']);

    // Next poll: new array identity, same statuses → no inspect.
    mockGetMany.mockClear();
    rerender(
      <HookTester
        containers={list.map((c) => ({ ...c }))}
        expose={expose}
      />
    );
    await act(async () => {});
    expect(mockGetMany).not.toHaveBeenCalled();

    // Only 'a' moved → only 'a' is inspected.
    const changed = list.map((c) =>
      c.id === 'a' ? { ...c, status: 'Up 6 minutes' } : { ...c }
    );
    rerender(<HookTester containers={changed} expose={expose} />);
    await act(async () => {});
    expect(mockGetMany).toHaveBeenCalledTimes(1);
    expect(mockGetMany.mock.calls[0][0]).toEqual(['a']);
  });

  test('exposes a verdict for every container', async () => {
    const expose = { current: null };
    render(<HookTester containers={list} expose={expose} />);
    await act(async () => {});

    expect(expose.current.health.get('a').code).toBe('running');
    expect(expose.current.health.get('b').code).toBe('stopped');
  });

  test('uses inspect data when it arrives', async () => {
    mockGetMany.mockResolvedValue(
      new Map([
        [
          'a',
          {
            id: 'a',
            state: 'running',
            exitCode: null,
            startedAt: new Date().toISOString(),
            finishedAt: '0001-01-01T00:00:00Z',
            restarting: false,
            restartCount: 0,
            healthStatus: 'unhealthy',
            oomKilled: false,
            labels: {},
          },
        ],
      ])
    );

    const expose = { current: null };
    render(<HookTester containers={[list[0]]} expose={expose} />);
    await act(async () => {});

    expect(expose.current.health.get('a').code).toBe('unhealthy');
  });

  test('refresh(id) forces a fresh inspection', async () => {
    const expose = { current: null };
    render(<HookTester containers={list} expose={expose} />);
    await act(async () => {});
    mockGetMany.mockClear();

    await act(async () => {
      expose.current.refresh('a');
    });

    expect(mockGetMany).toHaveBeenCalledTimes(1);
    expect(mockGetMany.mock.calls[0][0]).toEqual(['a']);
  });

  test('dropping a container evicts its cached verdict', async () => {
    const expose = { current: null };
    const { rerender } = render(
      <HookTester containers={list} expose={expose} />
    );
    await act(async () => {});

    // 'b' disappears...
    rerender(<HookTester containers={[list[0]]} expose={expose} />);
    await act(async () => {});

    // ...and reappears with the same status ⇒ inspected again, not cached.
    mockGetMany.mockClear();
    rerender(<HookTester containers={list} expose={expose} />);
    await act(async () => {});
    expect(mockGetMany.mock.calls[0][0]).toContain('b');
  });
});
