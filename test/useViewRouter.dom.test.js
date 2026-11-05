/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import { useViewRouter } from '../src/hooks/useViewRouter.js';

describe('useViewRouter', () => {
  test('starts on containers with the three views in order', () => {
    const { result } = renderHook(() => useViewRouter());

    expect(result.current.view).toBe('containers');
    expect(result.current.views.map((v) => v.id)).toEqual([
      'containers',
      'projects',
      'images',
    ]);
    expect(result.current.views.map((v) => v.shortcut)).toEqual([1, 2, 3]);
    expect(result.current.views.map((v) => v.enabled)).toEqual([
      true,
      false,
      false,
    ]);
    for (const v of result.current.views) {
      expect(typeof v.title).toBe('string');
      expect(v.title.length).toBeGreaterThan(0);
    }
  });

  test('nextView cycles through the views and wraps to the first', () => {
    const { result } = renderHook(() => useViewRouter());

    act(() => result.current.nextView());
    expect(result.current.view).toBe('projects');

    act(() => result.current.nextView());
    expect(result.current.view).toBe('images');

    act(() => result.current.nextView());
    expect(result.current.view).toBe('containers');
  });

  test('prevView cycles backwards and wraps to the last', () => {
    const { result } = renderHook(() => useViewRouter());

    act(() => result.current.prevView());
    expect(result.current.view).toBe('images');

    act(() => result.current.prevView());
    expect(result.current.view).toBe('projects');
  });

  test('disabled views are reachable', () => {
    const { result } = renderHook(() => useViewRouter());

    act(() => result.current.nextView());

    expect(result.current.view).toBe('projects');
    expect(result.current.views.find((v) => v.id === 'projects').enabled).toBe(
      false,
    );
  });

  test('setView jumps directly to a known view', () => {
    const { result } = renderHook(() => useViewRouter());

    act(() => result.current.setView('images'));

    expect(result.current.view).toBe('images');
  });

  test('setView ignores an unknown id', () => {
    const { result } = renderHook(() => useViewRouter());

    act(() => result.current.setView('images'));
    act(() => result.current.setView('nope'));

    expect(result.current.view).toBe('images');
  });
});
