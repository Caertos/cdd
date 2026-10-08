/**
 * @jest-environment jsdom
 */
import { renderHook } from '@testing-library/react';
import {
  useTerminalHeight,
  DEFAULT_TERMINAL_ROWS,
} from '../src/hooks/useTerminalHeight.js';

describe('useTerminalHeight', () => {
  test('returns the injected row count when provided', () => {
    const { result } = renderHook(() => useTerminalHeight(42));
    expect(result.current).toBe(42);
  });

  test('falls back to DEFAULT_TERMINAL_ROWS without a measurable stdout', () => {
    const { result } = renderHook(() => useTerminalHeight());
    expect(result.current).toBe(DEFAULT_TERMINAL_ROWS);
  });
});
