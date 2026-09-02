/**
 * @jest-environment jsdom
 */
import { getActiveContext, getBindings, resolveKey, keyNameOf, KEYMAP } from '../src/helpers/keymap.js';

describe('getActiveContext — pure function', () => {
  test('returns list when no special state is active', () => {
    expect(getActiveContext({})).toBe('list');
  });

  test('confirm wins over everything', () => {
    expect(getActiveContext({ confirmErase: true, showLogs: true, creatingContainer: true })).toBe('confirm');
  });

  test('help wins over logs and wizard', () => {
    expect(getActiveContext({ showHelp: true, showLogs: true })).toBe('help');
  });

  test('logs wins over list', () => {
    expect(getActiveContext({ showLogs: true })).toBe('logs');
  });

  test('wizard-list wins over wizard', () => {
    expect(getActiveContext({ creatingContainer: true, hasActiveList: true })).toBe('wizard-list');
  });

  test('wizard when creating without active list', () => {
    expect(getActiveContext({ creatingContainer: true })).toBe('wizard');
  });

  test('debug when showDebugLogs is true', () => {
    expect(getActiveContext({ showDebugLogs: true })).toBe('debug');
  });

  test('list when only showDebugLogs is false', () => {
    expect(getActiveContext({ creatingContainer: false, showLogs: false })).toBe('list');
  });
});

describe('getBindings — filters and sorts', () => {
  test('filters out bindings where when() returns false', () => {
    const bindings = getBindings('list', { hasSelection: false });
    const ids = bindings.map((b) => b.id);
    expect(ids).not.toContain('container.start');
    expect(ids).not.toContain('container.stop');
    expect(ids).toContain('container.create');
  });

  test('includes bindings where when() returns true', () => {
    const bindings = getBindings('list', { hasSelection: true });
    const ids = bindings.map((b) => b.id);
    expect(ids).toContain('container.start');
    expect(ids).toContain('container.stop');
  });

  test('sorts by priority descending', () => {
    const bindings = getBindings('list', { hasSelection: true });
    const priorities = bindings.map((b) => b.priority ?? 50);
    for (let i = 1; i < priorities.length; i++) {
      expect(priorities[i]).toBeLessThanOrEqual(priorities[i - 1]);
    }
  });
});

describe('resolveKey — maps keypress to binding', () => {
  test('resolves i to container.start in list context', () => {
    const binding = resolveKey('list', 'i', {}, { hasSelection: true });
    expect(binding).not.toBeNull();
    expect(binding.id).toBe('container.start');
  });

  test('returns null for unmapped key', () => {
    const binding = resolveKey('list', 'z', {}, {});
    expect(binding).toBeNull();
  });

  test('resolves up arrow to nav.up', () => {
    const binding = resolveKey('list', '', { upArrow: true }, {});
    expect(binding).not.toBeNull();
    expect(binding.id).toBe('nav.up');
  });

  test('resolves escape in logs context to logs.close', () => {
    const binding = resolveKey('logs', '', { escape: true }, {});
    expect(binding).not.toBeNull();
    expect(binding.id).toBe('logs.close');
  });
});

describe('keyNameOf — normalizes Ink keys', () => {
  test('returns "up" for upArrow', () => {
    expect(keyNameOf('', { upArrow: true })).toBe('up');
  });

  test('returns "down" for downArrow', () => {
    expect(keyNameOf('', { downArrow: true })).toBe('down');
  });

  test('returns "escape" for escape', () => {
    expect(keyNameOf('', { escape: true })).toBe('escape');
  });

  test('returns "enter" for return', () => {
    expect(keyNameOf('', { return: true })).toBe('enter');
  });

  test('returns "enter" for \\r', () => {
    expect(keyNameOf('\r', {})).toBe('enter');
  });

  test('returns "tab" for tab', () => {
    expect(keyNameOf('', { tab: true })).toBe('tab');
  });

  test('returns "backspace" for delete', () => {
    expect(keyNameOf('', { delete: true })).toBe('backspace');
  });

  test('returns ctrl+w for ctrl+w', () => {
    expect(keyNameOf('w', { ctrl: true })).toBe('ctrl+w');
  });

  test('returns plain input for regular key', () => {
    expect(keyNameOf('i', {})).toBe('i');
  });
});

describe('KEYMAP integrity — no duplicate keys per context', () => {
  const contexts = Object.keys(KEYMAP);

  test.each(contexts)('context "%s" has no duplicate key names', (ctx) => {
    const bindings = KEYMAP[ctx];
    const allKeys = bindings.flatMap((b) => b.keys);
    const uniqueKeys = new Set(allKeys);
    expect(uniqueKeys.size).toBe(allKeys.length);
  });
});
