/**
 * @jest-environment node
 */
import {
  createLogBuffer,
  appendLines,
  prependLines,
  truncateLine,
  bufferHeadNotice,
  isHighVolume,
  canLoadMore,
  HIGH_VOLUME_WINDOW_MS,
  initialLogRequest,
  newerThanHeld,
} from '../src/helpers/logBuffer.js';
import { readLogRetention, LOG_RETENTION } from '../src/helpers/constants.js';

/** Small limits so the tests can overflow them with a handful of lines. */
const SMALL = { maxBytes: 20, maxLines: 1000, maxLineBytes: 1000 };

/** Ten-byte lines: `line-0000\n` is not counted, only the text. */
const ten = (n) => `line-${String(n).padStart(4, '0')}`.padEnd(10, '.');

describe('readLogRetention', () => {
  test('defaults match the documented policy', () => {
    expect(readLogRetention({})).toEqual({
      BUFFER_BYTES: 16 * 1024 * 1024,
      MAX_LINES: 100_000,
      INITIAL_TAIL_RUNNING: 2_000,
      INITIAL_TAIL_STOPPED: 'all',
      DIAGNOSTIC_TAIL: 200,
      LOAD_MORE_CHUNK: 2_000,
      MAX_LINE_BYTES: 1024 * 1024,
    });
  });

  test('CDD_LOG_BUFFER_BYTES and CDD_LOG_MAX_LINES override the ceilings', () => {
    const config = readLogRetention({
      CDD_LOG_BUFFER_BYTES: '1048576',
      CDD_LOG_MAX_LINES: '500',
    });
    expect(config.BUFFER_BYTES).toBe(1048576);
    expect(config.MAX_LINES).toBe(500);
  });

  test.each(['', 'abc', '0', '-5', '1.5', 'Infinity', '12abc'])(
    'an invalid value (%p) falls back to the default',
    (value) => {
      const config = readLogRetention({
        CDD_LOG_BUFFER_BYTES: value,
        CDD_LOG_MAX_LINES: value,
      });
      expect(config.BUFFER_BYTES).toBe(16 * 1024 * 1024);
      expect(config.MAX_LINES).toBe(100_000);
    }
  );

  test('LOG_RETENTION is the policy read from the real environment', () => {
    expect(LOG_RETENTION).toEqual(readLogRetention(process.env));
  });
});

describe('appendLines', () => {
  test('keeps every line while under the ceiling', () => {
    const buffer = appendLines(createLogBuffer(SMALL), ['a', 'b', 'c'], 0);
    expect(buffer.lines).toEqual(['a', 'b', 'c']);
    expect(buffer.bytes).toBe(3);
    expect(buffer.droppedLines).toBe(0);
  });

  test('does not mutate the buffer it receives', () => {
    const start = createLogBuffer(SMALL);
    appendLines(start, ['a'], 0);
    expect(start.lines).toEqual([]);
    expect(start.bytes).toBe(0);
  });

  test('stays under the byte ceiling and marks the start as cut', () => {
    const buffer = appendLines(
      createLogBuffer(SMALL),
      [ten(1), ten(2), ten(3)],
      5
    );
    expect(buffer.bytes).toBeLessThanOrEqual(SMALL.maxBytes);
    expect(buffer.droppedLines).toBe(1);
    expect(buffer.truncatedAtStart).toBe(true);
  });

  test('drops the oldest lines, never the recent ones', () => {
    const buffer = appendLines(
      createLogBuffer(SMALL),
      [ten(1), ten(2), ten(3), ten(4)],
      5
    );
    expect(buffer.lines).toEqual([ten(3), ten(4)]);
  });

  test('droppedLines adds up across several drops', () => {
    let buffer = createLogBuffer(SMALL);
    buffer = appendLines(buffer, [ten(1), ten(2)], 1);
    buffer = appendLines(buffer, [ten(3)], 2);
    buffer = appendLines(buffer, [ten(4), ten(5)], 3);
    expect(buffer.droppedLines).toBe(3);
    expect(buffer.lines).toEqual([ten(4), ten(5)]);
    expect(buffer.lastDropAt).toBe(3);
  });

  test('counts bytes, not characters', () => {
    const buffer = appendLines(createLogBuffer(SMALL), ['ñ'.repeat(8)], 0);
    expect(buffer.bytes).toBe(16);
    const over = appendLines(buffer, ['ñ'.repeat(8)], 1);
    expect(over.droppedLines).toBe(1);
  });

  test('the line ceiling is a second safety net', () => {
    const buffer = appendLines(
      createLogBuffer({ ...SMALL, maxBytes: 1e9, maxLines: 3 }),
      ['a', 'b', 'c', 'd', 'e'],
      0
    );
    expect(buffer.lines).toEqual(['c', 'd', 'e']);
    expect(buffer.droppedLines).toBe(2);
  });

  test('always keeps the newest line, even if it alone is over the ceiling', () => {
    const buffer = appendLines(
      createLogBuffer({ ...SMALL, maxBytes: 5 }),
      ['aaaa', 'bbbbbbbb'],
      0
    );
    expect(buffer.lines).toEqual(['bbbbbbbb']);
  });

  test('a buffer that grows to 20 MB of content stays under the ceiling', () => {
    const limits = { maxBytes: 1024 * 1024, maxLines: 1e9, maxLineBytes: 1e6 };
    const chunk = Array.from({ length: 1000 }, () => 'x'.repeat(99));
    let buffer = createLogBuffer(limits);
    for (let i = 0; i < 200; i += 1) {
      buffer = appendLines(buffer, chunk, i);
      expect(buffer.bytes).toBeLessThanOrEqual(limits.maxBytes);
    }
    expect(buffer.droppedLines).toBeGreaterThan(0);
  });

  test('an empty batch is the same buffer', () => {
    const start = createLogBuffer(SMALL);
    expect(appendLines(start, [], 0)).toBe(start);
  });
});

describe('truncateLine', () => {
  test('leaves a short line alone', () => {
    expect(truncateLine('hello', 100)).toBe('hello');
  });

  test('cuts a long line and says how big it was', () => {
    const line = 'x'.repeat(3 * 1024 * 1024);
    const result = truncateLine(line, 1024 * 1024);
    expect(result.startsWith('x'.repeat(1024))).toBe(true);
    expect(result).toMatch(/\[line cut: 3\.0 MB\]$/);
    expect(Buffer.byteLength(result)).toBeLessThan(1024 * 1024 + 100);
  });

  test('never cuts a multi-byte character in half', () => {
    const result = truncateLine('ñ'.repeat(10), 5);
    expect(result).not.toContain('�');
  });

  test('appendLines truncates an oversized line before storing it', () => {
    const buffer = appendLines(
      createLogBuffer({ maxBytes: 1e9, maxLines: 10, maxLineBytes: 10 }),
      ['y'.repeat(5_000)],
      0
    );
    expect(buffer.lines[0]).toMatch(/\[line cut: /);
    expect(buffer.bytes).toBeLessThan(100);
  });
});

describe('prependLines', () => {
  test('puts the older lines in front', () => {
    const start = appendLines(createLogBuffer(SMALL), ['c', 'd'], 0);
    const buffer = prependLines(start, ['a', 'b'], false);
    expect(buffer.lines).toEqual(['a', 'b', 'c', 'd']);
    expect(buffer.bytes).toBe(4);
  });

  test('reachedStart turns the cut-at-start mark off', () => {
    const start = createLogBuffer(SMALL);
    expect(start.truncatedAtStart).toBe(true);
    const buffer = prependLines(start, ['a'], true);
    expect(buffer.truncatedAtStart).toBe(false);
    expect(buffer.isComplete).toBe(true);
  });

  test('without reachedStart the start is still not the real start', () => {
    const buffer = prependLines(createLogBuffer(SMALL), ['a'], false);
    expect(buffer.truncatedAtStart).toBe(true);
    expect(buffer.isComplete).toBe(false);
  });

  test('stays under the ceiling and counts what it had to drop', () => {
    const start = appendLines(createLogBuffer(SMALL), [ten(3), ten(4)], 0);
    const buffer = prependLines(start, [ten(1), ten(2)], true);
    expect(buffer.bytes).toBeLessThanOrEqual(SMALL.maxBytes);
    expect(buffer.droppedLines).toBe(2);
    expect(buffer.isComplete).toBe(false);
  });
});

describe('bufferHeadNotice', () => {
  test('a buffer holding the whole log says it is the start', () => {
    const buffer = prependLines(
      appendLines(createLogBuffer(SMALL), ['a'], 0),
      [],
      true
    );
    const notice = bufferHeadNotice(buffer);
    expect(notice.kind).toBe('complete');
    expect(notice.text).toMatch(/start of log/);
  });

  test('a buffer that dropped lines says how many', () => {
    const buffer = appendLines(
      createLogBuffer({ ...SMALL, reachedStart: true }),
      Array.from({ length: 4313 }, (_, i) => ten(i)),
      0
    );
    const notice = bufferHeadNotice(buffer);
    expect(notice.kind).toBe('dropped');
    expect(notice.text).toContain('4,311');
    expect(notice.text).toMatch(/memory limit/);
  });

  test('a buffer that was never given its start offers to load more', () => {
    const buffer = appendLines(createLogBuffer(SMALL), ['a'], 0);
    const notice = bufferHeadNotice(buffer);
    expect(notice.kind).toBe('partial');
    expect(notice.text).toMatch(/\[Ctrl\+U\] load earlier lines/);
  });

  test('an empty buffer has nothing to say', () => {
    const notice = bufferHeadNotice(createLogBuffer(SMALL));
    expect(notice).toEqual({ text: '', kind: 'empty' });
  });

  test('every state yields a mark, so nothing is dropped silently', () => {
    const states = [
      createLogBuffer(SMALL),
      appendLines(createLogBuffer(SMALL), ['a'], 0),
      appendLines(createLogBuffer({ ...SMALL, reachedStart: true }), ['a'], 0),
      appendLines(createLogBuffer(SMALL), [ten(1), ten(2), ten(3)], 0),
    ];
    for (const state of states) {
      const { kind, text } = bufferHeadNotice(state);
      if (state.lines.length > 0) expect(text).not.toBe('');
      if (state.droppedLines > 0) expect(kind).toBe('dropped');
    }
  });
});

describe('canLoadMore', () => {
  test('true when the start was never requested and nothing was dropped', () => {
    expect(canLoadMore(appendLines(createLogBuffer(SMALL), ['a'], 0))).toBe(
      true
    );
  });

  test('false once the real start is in the buffer', () => {
    const buffer = createLogBuffer({ ...SMALL, reachedStart: true });
    expect(canLoadMore(appendLines(buffer, ['a'], 0))).toBe(false);
  });

  test('false after a memory drop: loading more would only be dropped again', () => {
    const buffer = appendLines(
      createLogBuffer(SMALL),
      [ten(1), ten(2), ten(3)],
      0
    );
    expect(canLoadMore(buffer)).toBe(false);
  });
});

describe('isHighVolume', () => {
  const limits = { maxBytes: 100, maxLines: 1e9, maxLineBytes: 1000 };
  const fill = (n) => Array.from({ length: n }, () => 'x'.repeat(10));

  test('a quiet buffer is not high volume', () => {
    const buffer = appendLines(createLogBuffer(limits), fill(3), 0);
    expect(isHighVolume(buffer, 1)).toBe(false);
  });

  test('a single small overflow is not high volume', () => {
    const buffer = appendLines(createLogBuffer(limits), fill(12), 0);
    expect(buffer.droppedLines).toBe(2);
    expect(isHighVolume(buffer, 1)).toBe(false);
  });

  test('renewing the whole buffer inside the window is high volume', () => {
    let buffer = createLogBuffer(limits);
    buffer = appendLines(buffer, fill(10), 0);
    buffer = appendLines(buffer, fill(10), 1_000);
    buffer = appendLines(buffer, fill(10), 2_000);
    expect(isHighVolume(buffer, 2_000)).toBe(true);
  });

  test('the same drops are forgotten once the window has passed', () => {
    let buffer = createLogBuffer(limits);
    buffer = appendLines(buffer, fill(10), 0);
    buffer = appendLines(buffer, fill(10), 1_000);
    buffer = appendLines(buffer, fill(10), 2_000);
    expect(isHighVolume(buffer, 2_000 + HIGH_VOLUME_WINDOW_MS + 1)).toBe(false);
  });

  test('the record of drops stays bounded however long it runs', () => {
    let buffer = createLogBuffer(limits);
    for (let i = 0; i < 5000; i += 1) {
      buffer = appendLines(buffer, fill(20), i * 100_000);
    }
    expect(buffer.recentDrops.length).toBeLessThan(5);
  });
});

describe('initialLogRequest', () => {
  test.each(['exited', 'created', 'dead', 'removing'])(
    'a %s container is read whole, from its first line',
    (state) => {
      expect(initialLogRequest(state)).toEqual({
        tail: 'all',
        reachedStart: true,
      });
    }
  );

  test.each(['running', 'restarting', 'paused'])(
    'a %s container gets the last lines only, and its start is not assumed',
    (state) => {
      expect(initialLogRequest(state)).toEqual({
        tail: LOG_RETENTION.INITIAL_TAIL_RUNNING,
        reachedStart: false,
      });
    }
  );

  test('an unknown state is treated as live: never claim a start we lack', () => {
    expect(initialLogRequest(undefined).reachedStart).toBe(false);
    expect(initialLogRequest('weird').tail).toBe(
      LOG_RETENTION.INITIAL_TAIL_RUNNING
    );
  });
});

describe('newerThanHeld', () => {
  const ls = (from, to) =>
    Array.from({ length: to - from }, (_, i) => `l${from + i}`);

  test('keeps what comes before the lines already held', () => {
    expect(
      newerThanHeld({ lines: ls(0, 10), reachedStart: true }, 5, 2000)
    ).toEqual({ older: ls(0, 5), reachedStart: true });
  });

  test('lines that streamed in meanwhile are part of what is held', () => {
    expect(
      newerThanHeld({ lines: ls(0, 11), reachedStart: false }, 6, 2000)
    ).toEqual({ older: ls(0, 5), reachedStart: false });
  });

  test('nothing new when the chunk is no bigger than the buffer', () => {
    expect(
      newerThanHeld({ lines: ls(5, 10), reachedStart: false }, 5, 2000)
    ).toEqual({ older: [], reachedStart: false });
    expect(
      newerThanHeld({ lines: ls(8, 10), reachedStart: false }, 5, 2000)
    ).toEqual({ older: [], reachedStart: false });
  });

  test('more than a chunk is cut to the newest, and the start is not claimed', () => {
    const result = newerThanHeld(
      { lines: ls(0, 15), reachedStart: true },
      5,
      4
    );
    expect(result.older).toEqual(ls(6, 10));
    expect(result.reachedStart).toBe(false);
  });
});

