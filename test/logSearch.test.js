/**
 * @jest-environment node
 */
import {
  searchLogLines,
  splitHighlight,
  lineMatches,
} from '../src/helpers/logSearch.js';

const LOG = ['starting up', 'ERROR: disk full', 'ready', 'error again'];

describe('searchLogLines', () => {
  test('ignores case', () => {
    const r = searchLogLines(LOG, 'error');
    expect(r.matchIndices).toEqual([1, 3]);
    expect(r.matchCount).toBe(2);
  });

  test('highlight mode keeps every line', () => {
    expect(searchLogLines(LOG, 'error').lines).toEqual(LOG);
  });

  test('filter mode keeps only the matching lines, indexed from zero', () => {
    const r = searchLogLines(LOG, 'error', { filter: true });
    expect(r.lines).toEqual(['ERROR: disk full', 'error again']);
    expect(r.matchIndices).toEqual([0, 1]);
    expect(r.matchCount).toBe(2);
  });

  test('an empty query matches nothing and filters nothing', () => {
    expect(searchLogLines(LOG, '')).toEqual({
      lines: LOG,
      matchIndices: [],
      matchCount: 0,
    });
    expect(searchLogLines(LOG, '', { filter: true }).lines).toEqual(LOG);
  });

  test('no match in filter mode leaves nothing to show', () => {
    const r = searchLogLines(LOG, 'nope', { filter: true });
    expect(r.lines).toEqual([]);
    expect(r.matchCount).toBe(0);
  });

  test('regular-expression characters are plain text', () => {
    const lines = ['a [b] (c) d.e', 'abcde', 'a+b'];
    expect(searchLogLines(lines, '[b]').matchIndices).toEqual([0]);
    expect(searchLogLines(lines, '(c)').matchIndices).toEqual([0]);
    expect(searchLogLines(lines, 'd.e').matchIndices).toEqual([0]);
    expect(searchLogLines(lines, 'a+b').matchIndices).toEqual([2]);
  });

  test('tolerates a non-array', () => {
    expect(searchLogLines(undefined, 'x').matchCount).toBe(0);
  });
});

describe('lineMatches', () => {
  test('is repeatable (no sticky regex state between calls)', () => {
    expect(lineMatches('Error', 'error')).toBe(true);
    expect(lineMatches('Error', 'error')).toBe(true);
    expect(lineMatches('fine', 'error')).toBe(false);
    expect(lineMatches('x', '')).toBe(false);
  });
});

describe('splitHighlight', () => {
  test('several matches in one line, keeping the original case', () => {
    expect(splitHighlight('Error: error!', 'error')).toEqual([
      { text: 'Error', match: true },
      { text: ': ', match: false },
      { text: 'error', match: true },
      { text: '!', match: false },
    ]);
  });

  test('a match at the very start and at the very end', () => {
    expect(splitHighlight('abc', 'a')[0]).toEqual({ text: 'a', match: true });
    const end = splitHighlight('abc', 'c');
    expect(end[end.length - 1]).toEqual({ text: 'c', match: true });
  });

  test('no query or no match → the whole line as one piece', () => {
    expect(splitHighlight('hello', '')).toEqual([
      { text: 'hello', match: false },
    ]);
    expect(splitHighlight('hello', 'zzz')).toEqual([
      { text: 'hello', match: false },
    ]);
  });

  test('special characters are literal', () => {
    expect(splitHighlight('a.b a-b', '.')).toEqual([
      { text: 'a', match: false },
      { text: '.', match: true },
      { text: 'b a-b', match: false },
    ]);
  });

  test('the pieces always add up to the original line', () => {
    const line = 'x=1 y=2 x=3';
    expect(
      splitHighlight(line, 'x=')
        .map((p) => p.text)
        .join('')
    ).toBe(line);
  });
});
