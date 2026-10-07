/**
 * @jest-environment node
 */
import {
  normalizeForSearch,
  filterContainers,
} from '../src/helpers/containerFilters.js';

/**
 * Container-shaped fixtures shared by the filterContainers tests.
 * Each row keeps name, image and state distinct, so a query term can be
 * pinned to the exact field a test claims to match.
 */
const CONTAINERS = [
  { name: 'mi-postgres', image: 'postgres:15', state: 'running' },
  { name: 'Caché', image: 'redis:7-alpine', state: 'exited' },
  { name: 'builder', image: 'node:20-alpine', state: 'exited' },
  { name: 'frontend', image: 'node:20', state: 'running' },
];

describe('normalizeForSearch', () => {
  test('lowercases the text', () => {
    expect(normalizeForSearch('CACHE')).toBe('cache');
  });

  test('strips accents', () => {
    expect(normalizeForSearch('caché')).toBe('cache');
    expect(normalizeForSearch('ÁÉÍÓÚÑ')).toBe('aeioun');
  });

  test.each([[''], [null], [undefined]])(
    'empty input %p → empty string',
    (input) => {
      expect(normalizeForSearch(input)).toBe('');
    }
  );

  test.each(['CACHE', 'caché', 'ÁÉÍÓÚÑ', 'Web Server', 'plain'])(
    'is idempotent: normalizing %s twice equals normalizing it once',
    (text) => {
      expect(normalizeForSearch(normalizeForSearch(text))).toBe(
        normalizeForSearch(text)
      );
    }
  );
});

describe('filterContainers', () => {
  test('matches by name', () => {
    // 'builder' appears only in the name of one container.
    expect(filterContainers(CONTAINERS, 'builder')).toEqual([CONTAINERS[2]]);
  });

  test('matches by image', () => {
    // 'redis' appears only in the image of one container.
    expect(filterContainers(CONTAINERS, 'redis')).toEqual([CONTAINERS[1]]);
  });

  test('matches by state', () => {
    // 'exited' finds the stopped containers.
    expect(filterContainers(CONTAINERS, 'exited')).toEqual([
      CONTAINERS[1],
      CONTAINERS[2],
    ]);
  });

  test('is case-insensitive', () => {
    expect(filterContainers(CONTAINERS, 'BUILDER')).toEqual([CONTAINERS[2]]);
    expect(filterContainers(CONTAINERS, 'Node')).toEqual([
      CONTAINERS[2],
      CONTAINERS[3],
    ]);
  });

  test('is accent-insensitive: query "cache" finds the container named "Caché"', () => {
    expect(filterContainers(CONTAINERS, 'cache')).toEqual([CONTAINERS[1]]);
  });

  test('multiple words: AND across words, OR across fields', () => {
    // 'node' lives in the image, 'exit' in the state: two different fields
    // of the same container satisfy the two words.
    expect(filterContainers(CONTAINERS, 'node exit')).toEqual([CONTAINERS[2]]);
  });

  test('a container matching only one word of the query is excluded', () => {
    const result = filterContainers(CONTAINERS, 'node exit');
    // frontend has 'node' but not 'exit'; Caché has 'exit' but not 'node'.
    expect(result).not.toContain(CONTAINERS[3]);
    expect(result).not.toContain(CONTAINERS[1]);
    expect(result).toHaveLength(1);
  });

  test('a word that matches no container excludes everything', () => {
    expect(filterContainers(CONTAINERS, 'node zzzz')).toEqual([]);
  });

  test('empty query returns all containers', () => {
    expect(filterContainers(CONTAINERS, '')).toEqual(CONTAINERS);
  });

  test('whitespace-only query returns all containers', () => {
    expect(filterContainers(CONTAINERS, '   ')).toEqual(CONTAINERS);
  });

  test('does not mutate the input array and returns a new reference', () => {
    const input = [...CONTAINERS];
    const snapshot = JSON.parse(JSON.stringify(input));

    const filtered = filterContainers(input, 'node');
    expect(filtered).not.toBe(input);
    expect(filtered).toHaveLength(2);
    expect(input).toEqual(snapshot);

    // The empty-query shortcut copies the array too, it never returns it as-is.
    const all = filterContainers(input, '');
    expect(all).not.toBe(input);
    expect(all).toEqual(snapshot);
    expect(input).toEqual(snapshot);
  });
});
