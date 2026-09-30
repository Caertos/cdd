/**
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals';
import { renderHook } from '@testing-library/react';

const mockExit = jest.fn();
await jest.unstable_mockModule('ink', () => ({ useApp: () => ({ exit: mockExit }) }));

const { useExitHandler } = await import('../src/hooks/useExitHandler.js');
const { EXIT_DELAY } = await import('../src/helpers/constants.js');

describe('useExitHandler', () => {
  let clearSpy;

  beforeEach(() => {
    jest.useFakeTimers();
    mockExit.mockReset();
    clearSpy = jest.spyOn(console, 'clear').mockImplementation(() => {});
  });

  afterEach(() => {
    clearSpy.mockRestore();
    jest.useRealTimers();
  });

  test('ignores any key other than q', () => {
    const onBeforeExit = jest.fn();
    const { result } = renderHook(() => useExitHandler({ onBeforeExit }));
    expect(result.current.handleExitCommand('x')).toBe(false);
    jest.runAllTimers();
    expect(onBeforeExit).not.toHaveBeenCalled();
    expect(mockExit).not.toHaveBeenCalled();
  });

  test('q runs onBeforeExit at once and exits after EXIT_DELAY', () => {
    const onBeforeExit = jest.fn();
    const { result } = renderHook(() => useExitHandler({ onBeforeExit }));
    expect(result.current.handleExitCommand('q')).toBe(true);
    expect(onBeforeExit).toHaveBeenCalledTimes(1);
    expect(mockExit).not.toHaveBeenCalled();

    jest.advanceTimersByTime(EXIT_DELAY);
    expect(mockExit).toHaveBeenCalledTimes(1);
    expect(clearSpy).toHaveBeenCalled(); // non-TTY stdout under Jest
  });

  test('works without options and never calls process.exit under test', () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    const { result } = renderHook(() => useExitHandler());
    expect(result.current.handleExitCommand('q')).toBe(true);
    jest.runAllTimers();
    expect(mockExit).toHaveBeenCalledTimes(1);
    expect(exitSpy).not.toHaveBeenCalled();
    exitSpy.mockRestore();
  });
});
