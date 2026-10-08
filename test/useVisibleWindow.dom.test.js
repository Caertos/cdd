/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import { useVisibleWindow } from '../src/hooks/useVisibleWindow.js';

const renderWindow = (initialProps) =>
  renderHook((props) => useVisibleWindow(props), { initialProps });

describe('useVisibleWindow', () => {
  test('shows every row and hides nothing when the budget covers the list', () => {
    const { result } = renderWindow({
      total: 3,
      selectedIndex: 1,
      availableRows: 10,
    });

    expect(result.current.visibleCount).toBe(3);
    expect(result.current.offset).toBe(0);
    expect(result.current.hiddenAbove).toBe(0);
    expect(result.current.hiddenBelow).toBe(0);
  });

  test('keeps offset 0 at the top and reports the rows hidden below', () => {
    const { result } = renderWindow({
      total: 10,
      selectedIndex: 0,
      availableRows: 4,
    });

    expect(result.current.visibleCount).toBe(4);
    expect(result.current.offset).toBe(0);
    expect(result.current.hiddenAbove).toBe(0);
    expect(result.current.hiddenBelow).toBe(6);
  });

  test('scrolls down when the selection falls outside the window', () => {
    const { result, rerender } = renderWindow({
      total: 10,
      selectedIndex: 0,
      availableRows: 4,
    });
    expect(result.current.offset).toBe(0);

    act(() => {
      rerender({ total: 10, selectedIndex: 5, availableRows: 4 });
    });

    // Recentred: 5 - floor(4 / 2) = 3.
    expect(result.current.offset).toBe(3);
    expect(result.current.hiddenAbove).toBe(3);
    expect(result.current.hiddenBelow).toBe(3);
  });

  test('does not move while the selection stays inside the window', () => {
    const { result, rerender } = renderWindow({
      total: 10,
      selectedIndex: 5,
      availableRows: 4,
    });
    expect(result.current.offset).toBe(3);

    act(() => {
      rerender({ total: 10, selectedIndex: 4, availableRows: 4 });
    });

    expect(result.current.offset).toBe(3);
  });

  test('ignores an invalid selection index', () => {
    const { result, rerender } = renderWindow({
      total: 10,
      selectedIndex: 0,
      availableRows: 4,
    });

    act(() => {
      rerender({ total: 10, selectedIndex: -1, availableRows: 4 });
    });

    expect(result.current.offset).toBe(0);
  });

  test('re-clamps the offset when the list shrinks', () => {
    const { result, rerender } = renderWindow({
      total: 10,
      selectedIndex: 9,
      availableRows: 4,
    });
    expect(result.current.offset).toBe(6);

    act(() => {
      rerender({ total: 5, selectedIndex: 4, availableRows: 4 });
    });

    // maxOffset = 5 - 4 = 1.
    expect(result.current.offset).toBe(1);
    expect(result.current.hiddenBelow).toBe(0);
  });
});
