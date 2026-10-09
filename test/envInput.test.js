/**
 * @jest-environment node
 */
import {
  splitEnvEntries,
  parseEnvPairs,
  formatEnvEntries,
  envEntrySpans,
  escapeEnvValue,
  unescapeEnvValue,
} from '../src/helpers/envInput.js';

describe('splitEnvEntries', () => {
  test('falsy input yields an empty array', () => {
    expect(splitEnvEntries('')).toEqual([]);
    expect(splitEnvEntries(null)).toEqual([]);
    expect(splitEnvEntries(undefined)).toEqual([]);
  });

  test('splits plain comma-separated entries', () => {
    expect(splitEnvEntries('A=1,B=2')).toEqual(['A=1', 'B=2']);
  });

  test('a comma escaped with a backslash is a literal comma', () => {
    expect(splitEnvEntries('A=1\\,2,B=3')).toEqual(['A=1,2', 'B=3']);
  });

  test('a double backslash is a literal backslash', () => {
    expect(splitEnvEntries('A=C:\\\\path,B=1')).toEqual([
      'A=C:\\path',
      'B=1',
    ]);
  });

  test('Kafka listeners with escaped commas stay in one entry', () => {
    const input =
      'KAFKA_LISTENERS=PLAINTEXT://0.0.0.0:9092\\,CONTROLLER://0.0.0.0:9093';
    expect(splitEnvEntries(input)).toEqual([
      'KAFKA_LISTENERS=PLAINTEXT://0.0.0.0:9092,CONTROLLER://0.0.0.0:9093',
    ]);
  });

  test('an escaped backslash does not escape the following comma', () => {
    // A=1\\,B=2 -> entry "A=1\" then separator then "B=2"
    expect(splitEnvEntries('A=1\\\\,B=2')).toEqual(['A=1\\', 'B=2']);
  });
});

describe('escapeEnvValue / unescapeEnvValue', () => {
  test('escapes commas and backslashes', () => {
    expect(escapeEnvValue('a,b')).toBe('a\\,b');
    expect(escapeEnvValue('a\\b')).toBe('a\\\\b');
  });

  test('unescapes commas and backslashes', () => {
    expect(unescapeEnvValue('a\\,b')).toBe('a,b');
    expect(unescapeEnvValue('a\\\\b')).toBe('a\\b');
  });

  test('round-trips values with commas, backslashes and spaces', () => {
    for (const v of ['a,b', 'a\\b', 'a\\,b', 'plain', 'with space, and\\slash']) {
      expect(unescapeEnvValue(escapeEnvValue(v))).toBe(v);
    }
  });
});

describe('parseEnvPairs', () => {
  test('splits at the first = of each entry', () => {
    expect(parseEnvPairs('A=1,B=2')).toEqual([
      { key: 'A', value: '1' },
      { key: 'B', value: '2' },
    ]);
    expect(parseEnvPairs('TOKEN=a=b')).toEqual([
      { key: 'TOKEN', value: 'a=b' },
    ]);
  });

  test('an entry without = has a null value', () => {
    expect(parseEnvPairs('BARE, A=1')).toEqual([
      { key: 'BARE', value: null },
      { key: 'A', value: '1' },
    ]);
  });

  test('keys are trimmed but values are not', () => {
    expect(parseEnvPairs('  A  = 1 ')).toEqual([
      { key: 'A', value: ' 1 ' },
    ]);
  });

  test('empty entries are ignored', () => {
    expect(parseEnvPairs('A=1,,B=2')).toEqual([
      { key: 'A', value: '1' },
      { key: 'B', value: '2' },
    ]);
    expect(parseEnvPairs(',,')).toEqual([]);
    expect(parseEnvPairs('')).toEqual([]);
  });

  test('an escaped comma stays inside the value', () => {
    expect(parseEnvPairs('A=1\\,2')).toEqual([{ key: 'A', value: '1,2' }]);
  });
});

describe('formatEnvEntries', () => {
  test('joins entries with commas', () => {
    expect(formatEnvEntries(['A=1', 'B=2'])).toBe('A=1,B=2');
  });

  test('re-escapes commas inside a value', () => {
    expect(formatEnvEntries(['A=1,2'])).toBe('A=1\\,2');
  });

  test('re-escapes backslashes inside a value', () => {
    expect(formatEnvEntries(['A=C:\\path'])).toBe('A=C:\\\\path');
  });

  test('a non-array yields an empty string', () => {
    expect(formatEnvEntries(null)).toBe('');
    expect(formatEnvEntries('A=1')).toBe('');
  });

  test('round-trips formatEnvEntries(splitEnvEntries(x))', () => {
    const samples = [
      'A=1,B=2',
      'POSTGRES_PASSWORD=hunter2\\,s3cr3t',
      'KAFKA_LISTENERS=PLAINTEXT://0.0.0.0:9092\\,CONTROLLER://0.0.0.0:9093',
      'A=C:\\\\path,B=1',
      'TOKEN=a=b',
      'BARE',
    ];
    for (const x of samples) {
      expect(formatEnvEntries(splitEnvEntries(x))).toBe(x);
    }
  });
});

describe('envEntrySpans', () => {
  test('falsy input yields an empty array', () => {
    expect(envEntrySpans('')).toEqual([]);
    expect(envEntrySpans(null)).toEqual([]);
  });

  test('reports start, end, absolute eqIndex and key', () => {
    expect(envEntrySpans('A=1,B=2')).toEqual([
      { start: 0, end: 3, eqIndex: 1, key: 'A' },
      { start: 4, end: 7, eqIndex: 5, key: 'B' },
    ]);
  });

  test('a bare entry has eqIndex -1', () => {
    expect(envEntrySpans('BARE')).toEqual([
      { start: 0, end: 4, eqIndex: -1, key: 'BARE' },
    ]);
  });

  test('spans cover a value that contains escaped commas', () => {
    const input = 'POSTGRES_PASSWORD=hunter2\\,s3cr3t,D=1';
    expect(envEntrySpans(input)).toEqual([
      { start: 0, end: 33, eqIndex: 17, key: 'POSTGRES_PASSWORD' },
      { start: 34, end: 37, eqIndex: 35, key: 'D' },
    ]);
  });
});
