/**
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals';
import { renderHook, act } from '@testing-library/react';

const mockGetStats = jest.fn();
await jest.unstable_mockModule(
  '../src/helpers/dockerService/serviceComponents/containerStats.js',
  () => ({ getStats: mockGetStats })
);

const { useSharedContainerStats } =
  await import('../src/hooks/useSharedContainerStats.js');
const { REFRESH_INTERVALS } = await import('../src/helpers/constants.js');

const container = (id, state = 'running') => ({ id, state });
const SAMPLE = {
  cpuPercent: '12.5',
  memPercent: '40.0',
  netIO: { rx: 1, tx: 2 },
};

const flush = () => act(async () => {});

describe('useSharedContainerStats', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockGetStats.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('polls each running container once and never polls a stopped one', async () => {
    mockGetStats.mockResolvedValue(SAMPLE);
    const { result } = renderHook(() =>
      useSharedContainerStats([
        container('a', 'running'),
        container('b', 'exited'),
      ])
    );

    await flush();
    expect(mockGetStats).toHaveBeenCalledTimes(1);
    expect(mockGetStats).toHaveBeenCalledWith('a');
    expect(result.current.stats.get('a')).toEqual(SAMPLE);
    expect(result.current.stats.has('b')).toBe(false);
  });

  test('polls again on every interval', async () => {
    mockGetStats.mockResolvedValue(SAMPLE);
    renderHook(() => useSharedContainerStats([container('a', 'running')]));

    await flush();
    expect(mockGetStats).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(REFRESH_INTERVALS.CONTAINER_STATS);
    });
    expect(mockGetStats).toHaveBeenCalledTimes(2);
  });

  test('polls every running container at most once per cycle', async () => {
    mockGetStats.mockResolvedValue(SAMPLE);
    renderHook(() =>
      useSharedContainerStats([container('a'), container('b'), container('c')])
    );

    await flush();
    expect(mockGetStats).toHaveBeenCalledTimes(3);

    await act(async () => {
      jest.advanceTimersByTime(REFRESH_INTERVALS.CONTAINER_STATS);
    });
    // A second cycle hits each of the three exactly once more.
    expect(mockGetStats).toHaveBeenCalledTimes(6);
  });

  test('an isolated failure lands in errors and leaves the other stats intact', async () => {
    mockGetStats.mockImplementation((id) =>
      id === 'bad' ? Promise.reject(new Error('gone')) : Promise.resolve(SAMPLE)
    );
    const { result } = renderHook(() =>
      useSharedContainerStats([container('ok'), container('bad')])
    );

    await flush();
    expect(result.current.errors.get('bad')).toBe('Error fetching stats');
    expect(result.current.errors.has('ok')).toBe(false);
    expect(result.current.stats.get('ok')).toEqual(SAMPLE);
    expect(result.current.stats.has('bad')).toBe(false);
  });

  test('changing the visible list re-subscribes and drops the container that left', async () => {
    mockGetStats.mockResolvedValue(SAMPLE);
    const bCalls = () =>
      mockGetStats.mock.calls.filter(([id]) => id === 'b').length;

    const { rerender } = renderHook(
      (props) => useSharedContainerStats(props.list),
      { initialProps: { list: [container('a'), container('b')] } }
    );

    await flush();
    expect(bCalls()).toBe(1);
    const before = bCalls();

    act(() => {
      rerender({ list: [container('a')] });
    });
    await flush();

    await act(async () => {
      jest.advanceTimersByTime(REFRESH_INTERVALS.CONTAINER_STATS * 3);
    });
    // 'b' left the visible window: it is never polled again.
    expect(bCalls()).toBe(before);
  });
});
