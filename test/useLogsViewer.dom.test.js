/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import { useLogsViewer } from '../src/hooks/creation/useLogsViewer.js';

const HEIGHT = 5;
const lines = (n, prefix = 'line') =>
  Array.from({ length: n }, (_, i) => `${prefix}-${i}`);

/** A viewer with `n` lines loaded and a window of HEIGHT lines. */
function setup(n = 20, initial) {
  const hook = renderHook(() => useLogsViewer());
  act(() => {
    hook.result.current.openLogs();
    hook.result.current.setViewHeight(HEIGHT);
    hook.result.current.appendLogs(initial ?? lines(n));
  });
  return hook;
}

describe('useLogsViewer — scroll and follow', () => {
  test('starts following at the bottom', () => {
    const { result } = setup();
    expect(result.current.following).toBe(true);
    expect(result.current.scrollOffset).toBe(0);
    expect(result.current.pendingCount).toBe(0);
  });

  test('scrolling up pauses following', () => {
    const { result } = setup();
    act(() => result.current.scrollLogs(1));
    expect(result.current.following).toBe(false);
    expect(result.current.scrollOffset).toBe(1);
  });

  test('the offset never leaves 0..(lines - window)', () => {
    const { result } = setup(20);
    act(() => result.current.scrollLogs(500));
    expect(result.current.scrollOffset).toBe(15);
    act(() => result.current.scrollLogs(-500));
    expect(result.current.scrollOffset).toBe(0);
  });

  test('reaching the newest line by scrolling down follows again', () => {
    const { result } = setup();
    act(() => result.current.scrollLogs(2));
    act(() => result.current.scrollLogs(-2));
    expect(result.current.following).toBe(true);
  });

  test('Home goes to the first line and pauses', () => {
    const { result } = setup(20);
    act(() => result.current.scrollToTop());
    expect(result.current.scrollOffset).toBe(15);
    expect(result.current.following).toBe(false);
  });

  test('End goes back to the bottom, follows, and clears the counter', () => {
    const { result } = setup();
    act(() => result.current.scrollLogs(3));
    act(() => result.current.appendLogs(lines(4, 'new')));
    expect(result.current.pendingCount).toBe(4);
    act(() => result.current.scrollToBottom());
    expect(result.current.scrollOffset).toBe(0);
    expect(result.current.following).toBe(true);
    expect(result.current.pendingCount).toBe(0);
  });

  test('while paused the view does not move and new lines are counted', () => {
    const { result } = setup(20);
    act(() => result.current.scrollLogs(2));
    act(() => result.current.appendLogs(lines(3, 'new')));
    expect(result.current.scrollOffset).toBe(5);
    expect(result.current.pendingCount).toBe(3);
  });

  test('while following, new lines are not "pending"', () => {
    const { result } = setup();
    act(() => result.current.appendLogs(lines(3, 'new')));
    expect(result.current.pendingCount).toBe(0);
    expect(result.current.scrollOffset).toBe(0);
  });

  test('F pauses, and F again resumes at the bottom', () => {
    const { result } = setup();
    act(() => result.current.toggleFollow());
    expect(result.current.following).toBe(false);
    act(() => result.current.appendLogs(['x']));
    expect(result.current.pendingCount).toBe(1);
    act(() => result.current.toggleFollow());
    expect(result.current.following).toBe(true);
    expect(result.current.pendingCount).toBe(0);
  });

  test('closing the viewer resets the whole view', () => {
    const { result } = setup();
    act(() => result.current.scrollLogs(3));
    act(() => result.current.closeLogs());
    expect(result.current.following).toBe(true);
    expect(result.current.scrollOffset).toBe(0);
  });
});
