/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import { useContainerSelection } from '../src/hooks/navigation/useContainerSelection.js';

describe('useContainerSelection', () => {
  test('down and up move the selection', () => {
    const { result } = renderHook(() => useContainerSelection(3));
    act(() => { result.current.handleNavigation('', { downArrow: true }); });
    expect(result.current.selected).toBe(1);
    act(() => { result.current.handleNavigation('', { upArrow: true }); });
    expect(result.current.selected).toBe(0);
  });

  test('wraps around at both ends', () => {
    const { result } = renderHook(() => useContainerSelection(3));
    act(() => { result.current.handleNavigation('', { upArrow: true }); });
    expect(result.current.selected).toBe(2);
    act(() => { result.current.handleNavigation('', { downArrow: true }); });
    expect(result.current.selected).toBe(0);
  });

  test('empty list consumes nothing and keeps the index', () => {
    const { result } = renderHook(() => useContainerSelection(0));
    let consumed;
    act(() => { consumed = result.current.handleNavigation('', { downArrow: true }); });
    expect(consumed).toBe(false);
    expect(result.current.selected).toBe(0);
  });

  test('other keys are not consumed', () => {
    const { result } = renderHook(() => useContainerSelection(3));
    expect(result.current.handleNavigation('x', {})).toBe(false);
    expect(result.current.selected).toBe(0);
  });
});
