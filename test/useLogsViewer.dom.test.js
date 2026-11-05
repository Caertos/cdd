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

const typeQuery = (hook, text) => {
  act(() => hook.result.current.openSearch());
  for (const ch of text) {
    act(() => {
      hook.result.current.handleSearchKey(ch, {});
    });
  }
};

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
    typeQuery({ result }, 'line');
    act(() => result.current.closeLogs());
    expect(result.current.following).toBe(true);
    expect(result.current.scrollOffset).toBe(0);
    expect(result.current.search.query).toBe('');
    expect(result.current.search.open).toBe(false);
  });
});

describe('useLogsViewer — search', () => {
  const log = ['boot', 'ERROR one', 'ok', 'error two', 'ok', 'Error three'];

  test('typing a query counts the matches, ignoring case', () => {
    const hook = setup(0, log);
    typeQuery(hook, 'error');
    expect(hook.result.current.search.query).toBe('error');
    expect(hook.result.current.search.matchCount).toBe(3);
  });

  test('highlight mode keeps every line', () => {
    const hook = setup(0, log);
    typeQuery(hook, 'error');
    expect(hook.result.current.shownLogs).toHaveLength(log.length);
  });

  test('Enter keeps the query and closes the field', () => {
    const hook = setup(0, log);
    typeQuery(hook, 'error');
    act(() => hook.result.current.closeSearch());
    expect(hook.result.current.search.open).toBe(false);
    expect(hook.result.current.search.query).toBe('error');
  });

  test('Esc clears the query', () => {
    const hook = setup(0, log);
    typeQuery(hook, 'error');
    act(() => hook.result.current.clearSearch());
    expect(hook.result.current.search.query).toBe('');
    expect(hook.result.current.search.matchCount).toBe(0);
  });

  test('the field takes text only while it is open', () => {
    const hook = setup(0, log);
    let taken;
    act(() => {
      taken = hook.result.current.handleSearchKey('x', {});
    });
    expect(taken).toBe(false);
    expect(hook.result.current.search.query).toBe('');
  });

  test('Enter and Esc are not text: they fall through to the keymap', () => {
    const hook = setup(0, log);
    act(() => hook.result.current.openSearch());
    let enter;
    let esc;
    act(() => {
      enter = hook.result.current.handleSearchKey('', { return: true });
      esc = hook.result.current.handleSearchKey('', { escape: true });
    });
    expect(enter).toBe(false);
    expect(esc).toBe(false);
  });

  test('backspace edits the query', () => {
    const hook = setup(0, log);
    typeQuery(hook, 'errx');
    act(() => {
      hook.result.current.handleSearchKey('', { backspace: true });
    });
    expect(hook.result.current.search.query).toBe('err');
  });

  test('n visits the matches in order and wraps; N goes back', () => {
    const hook = setup(0, log);
    typeQuery(hook, 'error');
    act(() => hook.result.current.closeSearch());
    const pos = () => hook.result.current.search.matchPos;
    act(() => hook.result.current.jumpToMatch(1));
    expect(pos()).toBe(0);
    act(() => hook.result.current.jumpToMatch(1));
    expect(pos()).toBe(1);
    act(() => hook.result.current.jumpToMatch(1));
    act(() => hook.result.current.jumpToMatch(1));
    expect(pos()).toBe(0); // wrapped
    act(() => hook.result.current.jumpToMatch(-1));
    expect(pos()).toBe(2); // wrapped backwards
  });

  test('N before any n starts from the newest match', () => {
    const hook = setup(0, log);
    typeQuery(hook, 'error');
    act(() => hook.result.current.jumpToMatch(-1));
    expect(hook.result.current.search.matchPos).toBe(2);
  });

  test('jumping to a match scrolls it into the window', () => {
    const many = lines(40);
    many[3] = 'needle here';
    const hook = setup(0, many);
    typeQuery(hook, 'needle');
    act(() => hook.result.current.closeSearch());
    act(() => hook.result.current.jumpToMatch(1));
    const { scrollOffset, shownLogs } = hook.result.current;
    const end = shownLogs.length - scrollOffset;
    const window = shownLogs.slice(end - HEIGHT, end);
    expect(window).toContain('needle here');
    expect(hook.result.current.following).toBe(false);
  });

  test('n with no matches does nothing', () => {
    const hook = setup(0, log);
    typeQuery(hook, 'zzz');
    act(() => hook.result.current.jumpToMatch(1));
    expect(hook.result.current.search.matchPos).toBe(-1);
  });

  test('changing the query resets the current match', () => {
    const hook = setup(0, log);
    typeQuery(hook, 'error');
    act(() => hook.result.current.jumpToMatch(1));
    act(() => {
      hook.result.current.handleSearchKey('s', {});
    });
    expect(hook.result.current.search.matchPos).toBe(-1);
  });
});

describe('useLogsViewer — filter', () => {
  const log = ['boot', 'ERROR one', 'ok', 'error two', 'ok'];

  test('Ctrl+F shows only the matching lines, and again shows all', () => {
    const hook = setup(0, log);
    typeQuery(hook, 'error');
    act(() => hook.result.current.toggleFilter());
    expect(hook.result.current.search.filter).toBe(true);
    expect(hook.result.current.shownLogs).toEqual(['ERROR one', 'error two']);
    act(() => hook.result.current.toggleFilter());
    expect(hook.result.current.shownLogs).toEqual(log);
  });

  test('the buffer itself is never trimmed by the filter', () => {
    const hook = setup(0, log);
    typeQuery(hook, 'error');
    act(() => hook.result.current.toggleFilter());
    expect(hook.result.current.logs).toEqual(log);
  });

  test('Esc while filtering drops the filter and goes to the bottom', () => {
    const hook = setup(0, log);
    typeQuery(hook, 'error');
    act(() => hook.result.current.toggleFilter());
    act(() => hook.result.current.clearSearch());
    expect(hook.result.current.search.filter).toBe(false);
    expect(hook.result.current.shownLogs).toEqual(log);
    expect(hook.result.current.following).toBe(true);
  });

  test('a new line that does not match is not counted while filtered and paused', () => {
    const hook = setup(0, [...lines(10), 'error a']);
    typeQuery(hook, 'error');
    act(() => hook.result.current.toggleFilter());
    act(() => hook.result.current.toggleFollow()); // pause
    act(() => hook.result.current.appendLogs(['plain', 'plain']));
    expect(hook.result.current.pendingCount).toBe(0);
    act(() => hook.result.current.appendLogs(['error b']));
    expect(hook.result.current.pendingCount).toBe(1);
  });

  test('the filter matches what is on screen, not the raw escape bytes', () => {
    const hook = setup(0, ['\u001b[31mred\u001b[0m text', 'plain']);
    typeQuery(hook, '31m');
    expect(hook.result.current.search.matchCount).toBe(0);
  });
});

describe('useLogsViewer — retention buffer (TASK-11)', () => {
  const MB = 1024 * 1024;
  const bigLine = (n) => `${String(n).padStart(3, '0')}${'x'.repeat(900 * 1024)}`;

  test('an empty viewer has nothing to announce', () => {
    const hook = renderHook(() => useLogsViewer());
    act(() => hook.result.current.openLogs());
    expect(hook.result.current.headNotice).toEqual({ text: '', kind: 'empty' });
  });

  test('a viewer opened on a whole log says it is the start', () => {
    const hook = renderHook(() => useLogsViewer());
    act(() => {
      hook.result.current.openLogs({ reachedStart: true });
      hook.result.current.appendLogs(['a', 'b']);
    });
    expect(hook.result.current.headNotice.kind).toBe('complete');
  });

  test('a viewer opened on a tail does not claim the start', () => {
    const hook = renderHook(() => useLogsViewer());
    act(() => {
      hook.result.current.openLogs();
      hook.result.current.appendLogs(['a', 'b']);
    });
    expect(hook.result.current.headNotice.kind).toBe('partial');
  });

  test('the old 1000-line cut is gone: 5000 short lines are all kept', () => {
    const hook = renderHook(() => useLogsViewer());
    act(() => {
      hook.result.current.openLogs({ reachedStart: true });
      hook.result.current.appendLogs(lines(5000));
    });
    expect(hook.result.current.logs).toHaveLength(5000);
    expect(hook.result.current.headNotice.kind).toBe('complete');
  });

  test('past the byte ceiling the oldest lines go and the notice says so', () => {
    const hook = renderHook(() => useLogsViewer());
    act(() => {
      hook.result.current.openLogs({ reachedStart: true });
      hook.result.current.appendLogs(
        Array.from({ length: 20 }, (_, i) => bigLine(i))
      );
    });
    const { logs, headNotice } = hook.result.current;
    expect(logs.length).toBeLessThan(20);
    expect(logs[logs.length - 1].startsWith('019')).toBe(true);
    expect(logs[0].startsWith('000')).toBe(false);
    expect(headNotice.kind).toBe('dropped');
    expect(headNotice.text).toContain(`${20 - logs.length}`);
    expect(
      logs.reduce((n, l) => n + Buffer.byteLength(l), 0)
    ).toBeLessThanOrEqual(16 * MB);
  });

  test('closing the viewer empties the buffer and the notice', () => {
    const hook = renderHook(() => useLogsViewer());
    act(() => {
      hook.result.current.openLogs({ reachedStart: true });
      hook.result.current.appendLogs(['a']);
    });
    act(() => hook.result.current.closeLogs());
    expect(hook.result.current.logs).toEqual([]);
    expect(hook.result.current.headNotice.kind).toBe('empty');
  });

  test('reopening starts from a fresh buffer, not the previous notice', () => {
    const hook = renderHook(() => useLogsViewer());
    act(() => {
      hook.result.current.openLogs({ reachedStart: true });
      hook.result.current.appendLogs(['a']);
    });
    act(() => hook.result.current.openLogs());
    act(() => hook.result.current.appendLogs(['b']));
    expect(hook.result.current.headNotice.kind).toBe('partial');
    expect(hook.result.current.logs).toEqual(['b']);
  });
});
