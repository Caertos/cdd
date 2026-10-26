import { describe, expect, test } from '@jest/globals';
import { withKeys } from '../src/helpers/listKeys.js';

describe('withKeys', () => {
  test('pairs every item with a content-based key', () => {
    expect(withKeys(['a', 'b'])).toEqual([
      { item: 'a', key: 'a#1' },
      { item: 'b', key: 'b#1' },
    ]);
  });

  test('keeps equal items unique through their occurrence', () => {
    const keys = withKeys(['x', 'y', 'x', 'x']).map((entry) => entry.key);
    expect(keys).toEqual(['x#1', 'y#1', 'x#2', 'x#3']);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test('builds the key from toText when given', () => {
    const [entry] = withKeys([{ id: 7 }], (item) => `id-${item.id}`);
    expect(entry.key).toBe('id-7#1');
  });

  test('returns an empty list for an empty input', () => {
    expect(withKeys([])).toEqual([]);
  });
});
