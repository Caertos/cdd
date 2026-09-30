/**
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals';
import { renderHook, act } from '@testing-library/react';
import { useDebugLogs } from '../src/hooks/debug/useDebugLogs.js';
import { logger } from '../src/helpers/logger.js';

describe('useDebugLogs', () => {
  test('starts hidden and empty', () => {
    const { result } = renderHook(() => useDebugLogs());
    expect(result.current.showDebugLogs).toBe(false);
    expect(result.current.debugLogs).toEqual([]);
  });

  test('collects logger entries with their args formatted', () => {
    const { result } = renderHook(() => useDebugLogs());
    act(() => { logger.warn('pull %s', 'nginx', 3, true, { a: 1 }); });
    const [line] = result.current.debugLogs;
    expect(line).toContain('[WARN] pull %s');
    expect(line).toMatch(/nginx 3 true \{"a":1\}$/);
  });

  test('unserializable args do not break the panel', () => {
    const { result } = renderHook(() => useDebugLogs());
    const circular = {};
    circular.self = circular;
    act(() => { logger.warn('loop', circular); });
    expect(result.current.debugLogs[0]).toMatch(/\[unserializable\]$/);
  });

  test('keeps only the last 200 lines', () => {
    const { result } = renderHook(() => useDebugLogs());
    act(() => {
      for (let i = 0; i < 205; i += 1) logger.warn(`line ${i}`);
    });
    expect(result.current.debugLogs).toHaveLength(200);
    expect(result.current.debugLogs[0]).toContain('line 5');
  });

  test('unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => useDebugLogs());
    unmount();
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    logger.warn('after unmount');
    // With no listeners left the logger falls back to the console.
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('after unmount'));
    spy.mockRestore();
  });
});
