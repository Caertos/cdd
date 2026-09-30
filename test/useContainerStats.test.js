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

const { useContainerStats } = await import('../src/hooks/useContainerStats.js');
const { REFRESH_INTERVALS } = await import('../src/helpers/constants.js');

const DEFAULT = { cpuPercent: 0, memPercent: 0, netIO: { rx: 0, tx: 0 } };
const SAMPLE = { cpuPercent: 12.5, memPercent: 40, netIO: { rx: 1, tx: 2 } };

describe('useContainerStats', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockGetStats.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('a stopped container never polls and shows defaults', () => {
    const { result } = renderHook(() => useContainerStats('cid', 'exited'));
    jest.advanceTimersByTime(REFRESH_INTERVALS.CONTAINER_STATS * 3);
    expect(mockGetStats).not.toHaveBeenCalled();
    expect(result.current).toEqual({ stats: DEFAULT, statsError: '' });
  });

  test('a running container fetches at once and then on every interval', async () => {
    mockGetStats.mockResolvedValue(SAMPLE);
    const { result } = renderHook(() => useContainerStats('cid', 'running'));
    await act(async () => {});
    expect(mockGetStats).toHaveBeenCalledWith('cid');
    expect(result.current.stats).toEqual(SAMPLE);

    await act(async () => { jest.advanceTimersByTime(REFRESH_INTERVALS.CONTAINER_STATS); });
    expect(mockGetStats).toHaveBeenCalledTimes(2);
  });

  test('a failed fetch resets stats and reports the error', async () => {
    mockGetStats.mockRejectedValue(new Error('gone'));
    const { result } = renderHook(() => useContainerStats('cid', 'running'));
    await act(async () => {});
    expect(result.current).toEqual({ stats: DEFAULT, statsError: 'Error fetching stats' });
  });

  test('unmount stops the polling interval', async () => {
    mockGetStats.mockResolvedValue(SAMPLE);
    const { unmount } = renderHook(() => useContainerStats('cid', 'running'));
    await act(async () => {});
    const calls = mockGetStats.mock.calls.length;
    unmount();
    // Timer count is not usable here: React's scheduler keeps its own timer.
    jest.advanceTimersByTime(REFRESH_INTERVALS.CONTAINER_STATS * 3);
    expect(mockGetStats).toHaveBeenCalledTimes(calls);
  });
});
