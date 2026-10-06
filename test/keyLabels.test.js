import { KEYMAP } from '../src/helpers/keymap.js';
import { formatKeyName, displayKeys } from '../src/helpers/keyLabels.js';

describe('formatKeyName', () => {
  test.each([
    ['up', '↑'],
    ['down', '↓'],
    ['left', '←'],
    ['right', '→'],
    ['escape', 'Esc'],
    ['enter', 'Enter'],
    ['return', 'Enter'],
    ['tab', 'Tab'],
    ['backspace', 'Backspace'],
    ['delete', 'Delete'],
    ['space', 'Space'],
    ['pageup', 'PgUp'],
    ['pagedown', 'PgDn'],
    ['ctrl+r', 'Ctrl+R'],
    ['ctrl+g', 'Ctrl+G'],
    ['shift+F', 'Shift+F'],
  ])('%s is shown as %s', (raw, shown) => {
    expect(formatKeyName(raw)).toBe(shown);
  });

  test('single characters and unknown names pass through unchanged', () => {
    for (const k of ['i', 'F', '?', '/', '1', 'whatever']) {
      expect(formatKeyName(k)).toBe(k);
    }
  });

  test('no multi-letter key name in the KEYMAP is shown raw', () => {
    const names = new Set();
    for (const bindings of Object.values(KEYMAP)) {
      for (const b of bindings) b.keys.forEach((k) => names.add(k));
    }
    const raw = [...names].filter(
      (k) => k.length > 1 && /^[a-z]/.test(k) && formatKeyName(k) === k
    );
    expect(raw).toEqual([]);
  });
});

describe('displayKeys', () => {
  test('drops shift+X when plain X is listed too', () => {
    expect(displayKeys(['F', 'shift+F'])).toEqual(['F']);
  });

  test('formats names and keeps order', () => {
    expect(displayKeys(['escape', '?'])).toEqual(['Esc', '?']);
  });

  test('keeps shift+X when plain X is absent', () => {
    expect(displayKeys(['shift+F'])).toEqual(['Shift+F']);
  });

  test('removes duplicates', () => {
    expect(displayKeys(['enter', 'return', 'y'])).toEqual(['Enter', 'y']);
  });
});
