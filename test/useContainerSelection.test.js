/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import { useContainerSelection } from '../src/hooks/navigation/useContainerSelection.js';

// A fresh list on every render, like Docker replacing it wholesale.
const list = () => [
  { id: 'a', name: 'alpha' },
  { id: 'b', name: 'bravo' },
  { id: 'c', name: 'charlie' },
];

describe('useContainerSelection', () => {
  test('down and up move the selection', () => {
    const { result } = renderHook(() => useContainerSelection(list()));
    act(() => {
      result.current.move(1);
    });
    expect(result.current.selectedIndex).toBe(1);
    expect(result.current.selectedId).toBe('b');
    act(() => {
      result.current.move(-1);
    });
    expect(result.current.selectedIndex).toBe(0);
    expect(result.current.selectedId).toBe('a');
  });

  test('wraps around at both ends', () => {
    const { result } = renderHook(() => useContainerSelection(list()));
    act(() => {
      result.current.move(-1);
    });
    expect(result.current.selectedIndex).toBe(2);
    expect(result.current.selectedId).toBe('c');
    act(() => {
      result.current.move(1);
    });
    expect(result.current.selectedIndex).toBe(0);
    expect(result.current.selectedId).toBe('a');
  });

  test('an empty list consumes nothing and has no selection', () => {
    const { result } = renderHook(() => useContainerSelection([]));
    act(() => {
      result.current.move(1);
    });
    expect(result.current.selectedIndex).toBe(-1);
    expect(result.current.selectedId).toBeNull();
    expect(result.current.selectedContainer).toBeNull();
  });

  test('only an explicit selectId moves the selection', () => {
    const { result } = renderHook(() => useContainerSelection(list()));
    act(() => {
      result.current.selectId('c');
    });
    expect(result.current.selectedIndex).toBe(2);
    expect(result.current.selectedId).toBe('c');
    // An id that is not in the list changes nothing at all. Clearing the
    // anchor would drop the selection back to the top, and storing the
    // dangling id would let it derive to the vacated slot: either way the
    // highlight lands on a container nobody picked.
    act(() => {
      result.current.selectId('z');
    });
    expect(result.current.selectedId).toBe('c');
    expect(result.current.selectedIndex).toBe(2);
  });
});
