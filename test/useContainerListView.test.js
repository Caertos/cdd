/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import { useContainerListView } from '../src/hooks/useContainerListView.js';

const web = { id: 'a', name: 'web', image: 'nginx', state: 'running' };
const pg = { id: 'b', name: 'postgres', image: 'postgres:17', state: 'exited' };
const node = { id: 'c', name: 'node-app', image: 'node:20', state: 'exited' };

// Each input is applied in its own act: handleFilterKey reads the text from its
// closure, so two keystrokes in one commit would both see the old text.
function type(result, input, key = {}) {
  act(() => {
    result.current.handleFilterKey(input, key);
  });
}

function typeText(result, text) {
  for (const ch of text) type(result, ch);
}

describe('useContainerListView', () => {
  test('starts unfiltered, showing every row', () => {
    const { result } = renderHook(() => useContainerListView([web, pg, node]));
    expect(result.current.isFiltering).toBe(false);
    expect(result.current.query).toBe('');
    expect(result.current.totalCount).toBe(3);
    expect(result.current.visible).toHaveLength(3);
  });

  test('openFilter turns the field on', () => {
    const { result } = renderHook(() => useContainerListView([web, pg]));
    act(() => result.current.openFilter());
    expect(result.current.isFiltering).toBe(true);
  });

  test('typed text filters live on name, image and state', () => {
    const { result } = renderHook(() => useContainerListView([web, pg, node]));
    act(() => result.current.openFilter());

    typeText(result, 'post');
    expect(result.current.query).toBe('post');
    expect(result.current.visible.map((c) => c.id)).toEqual(['b']);

    // 'exited' matches by state, not just name. clearFilter also closes the
    // field, so the second query starts by reopening it.
    act(() => result.current.clearFilter());
    act(() => result.current.openFilter());
    typeText(result, 'exited');
    expect(result.current.visible.map((c) => c.id).sort()).toEqual(['b', 'c']);
  });

  test('Enter and Esc are left to the keymap, not consumed as text', () => {
    const { result } = renderHook(() => useContainerListView([web]));
    act(() => result.current.openFilter());
    const enter = result.current.handleFilterKey('', { return: true });
    const escape = result.current.handleFilterKey('', { escape: true });
    expect(enter).toBe(false);
    expect(escape).toBe(false);
  });

  test('keys are ignored while the field is closed', () => {
    const { result } = renderHook(() => useContainerListView([web]));
    let handled;
    act(() => {
      handled = result.current.handleFilterKey('x', {});
    });
    expect(handled).toBe(false);
    expect(result.current.query).toBe('');
  });

  test('backspace removes from the query', () => {
    const { result } = renderHook(() => useContainerListView([web, pg]));
    act(() => result.current.openFilter());
    typeText(result, 'post');
    type(result, 'x');
    expect(result.current.query).toBe('postx');
    type(result, '', { backspace: true });
    expect(result.current.query).toBe('post');
  });

  test('closeFilter keeps the query applied; clearFilter drops it', () => {
    const { result } = renderHook(() => useContainerListView([web, pg]));
    act(() => result.current.openFilter());
    typeText(result, 'post');

    act(() => result.current.closeFilter());
    expect(result.current.isFiltering).toBe(false);
    expect(result.current.query).toBe('post');
    expect(result.current.visible.map((c) => c.id)).toEqual(['b']);

    act(() => result.current.clearFilter());
    expect(result.current.query).toBe('');
    expect(result.current.visible).toHaveLength(2);
  });

  test('cycleSort walks the three modes and comes back', () => {
    const { result } = renderHook(() => useContainerListView([web, pg]));
    expect(result.current.sortMode).toBe('state');
    act(() => result.current.cycleSort());
    expect(result.current.sortMode).toBe('name');
    act(() => result.current.cycleSort());
    expect(result.current.sortMode).toBe('created');
    act(() => result.current.cycleSort());
    expect(result.current.sortMode).toBe('state');
  });
});
