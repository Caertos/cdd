/**
 * @jest-environment node
 */
import { STRINGS } from '../src/helpers/strings.js';

/** Collect [path, value] for every leaf of a nested object. */
function leaves(obj, prefix = '') {
  return Object.entries(obj).flatMap(([key, value]) => {
    const p = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) return leaves(value, p);
    return [[p, value]];
  });
}

const ALL = leaves(STRINGS);

describe('STRINGS', () => {
  test('has leaves to check', () => {
    expect(ALL.length).toBeGreaterThan(50);
  });

  test.each(ALL.filter(([, v]) => typeof v === 'string'))('%s is a non-empty string', (_, v) => {
    expect(v.trim()).not.toBe('');
  });

  test.each(ALL.filter(([, v]) => Array.isArray(v)))('%s is a list of non-empty strings', (_, v) => {
    expect(v.length).toBeGreaterThan(0);
    for (const item of v) expect(typeof item === 'string' && item.trim() !== '').toBe(true);
  });

  test('every leaf is a string, a string list or a function', () => {
    const odd = ALL.filter(
      ([, v]) => typeof v !== 'string' && typeof v !== 'function' && !Array.isArray(v)
    );
    expect(odd).toEqual([]);
  });
});

describe('STRINGS — functions', () => {
  test('containerFound pluralizes', () => {
    expect(STRINGS.containerFound(0)).toBe('0 containers found');
    expect(STRINGS.containerFound(1)).toBe('1 container found');
    expect(STRINGS.containerFound(2)).toBe('2 containers found');
  });

  test('logsTitle interpolates the name and falls back to "Container"', () => {
    expect(STRINGS.logsTitle('web')).toBe('web logs, press ESC to exit');
    expect(STRINGS.logsTitle(undefined)).toBe('Container logs, press ESC to exit');
  });

  test('connection.retrying interpolates the seconds', () => {
    expect(STRINGS.connection.retrying(5)).toBe('Retrying in 5 s...');
  });

  test('wizard.stepOf interpolates step and total', () => {
    expect(STRINGS.wizard.stepOf(2, 5)).toBe('Step 2 of 5');
  });
});

describe('STRINGS — connection hints', () => {
  test.each(['notRunning', 'permission', 'timeout', 'unknown'])(
    '%s has hints for linux, darwin and win32',
    (kind) => {
      expect(Object.keys(STRINGS.connection[kind].hints).sort()).toEqual([
        'darwin',
        'linux',
        'win32',
      ]);
    }
  );
});
