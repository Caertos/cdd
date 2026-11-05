/**
 * @jest-environment jsdom
 */
import {
  getActiveContext,
  getBindings,
  resolveKey,
  keyNameOf,
  KEYMAP,
} from '../src/helpers/keymap.js';

const VIEW_CONTEXTS = ['list', 'projects', 'images'];

describe('getActiveContext by view', () => {
  test('maps the projects and images views to their own contexts', () => {
    expect(getActiveContext({ view: 'projects' })).toBe('projects');
    expect(getActiveContext({ view: 'images' })).toBe('images');
  });

  test('keeps list for containers or no view', () => {
    expect(getActiveContext({})).toBe('list');
    expect(getActiveContext({ view: 'containers' })).toBe('list');
  });

  test('overlays still win over the view context', () => {
    expect(getActiveContext({ view: 'projects', showHelp: true })).toBe('help');
    expect(getActiveContext({ view: 'projects', isFiltering: true })).toBe(
      'filter'
    );
    expect(getActiveContext({ view: 'projects', disconnected: true })).toBe(
      'disconnected'
    );
  });
});

describe('global view bindings', () => {
  test.each(VIEW_CONTEXTS)('%s has the global bindings', (ctx) => {
    const bindings = getBindings(ctx, {});
    const ids = bindings.map((b) => b.id);
    expect(ids).toEqual(
      expect.arrayContaining(['view.next', 'view.prev', 'view.goto', 'app.quit', 'app.help'])
    );
    expect(bindings.find((b) => b.id === 'view.goto').keys).toEqual(['1', '2', '3']);
  });

  test.each(VIEW_CONTEXTS)('%s resolves tab, shift+tab and 1-3', (ctx) => {
    expect(resolveKey(ctx, '', { tab: true }, {}).id).toBe('view.next');
    expect(resolveKey(ctx, '', { tab: true, shift: true }, {}).id).toBe('view.prev');
    expect(resolveKey(ctx, '1', {}, {}).id).toBe('view.goto');
    expect(resolveKey(ctx, '2', {}, {}).id).toBe('view.goto');
    expect(resolveKey(ctx, '3', {}, {}).id).toBe('view.goto');
    expect(resolveKey(ctx, 'q', {}, {}).id).toBe('app.quit');
    expect(resolveKey(ctx, '?', {}, {}).id).toBe('app.help');
  });

  test('list keys do not resolve in projects or images', () => {
    expect(resolveKey('projects', 'l', {}, { hasSelection: true })).toBeNull();
    expect(resolveKey('images', 'l', {}, { hasSelection: true })).toBeNull();
    expect(resolveKey('list', 'l', {}, { hasSelection: true }).id).toBe(
      'container.logs'
    );
  });

  test('projects and images only carry the global bindings', () => {
    const globalIds = KEYMAP.list
      .map((b) => b.id)
      .filter((id) => id.startsWith('view.') || id === 'app.quit' || id === 'app.help')
      .sort();
    expect(KEYMAP.projects.map((b) => b.id).sort()).toEqual(globalIds);
    expect(KEYMAP.images.map((b) => b.id).sort()).toEqual(globalIds);
  });

  test('the global bindings are the same objects in every context', () => {
    const listNext = KEYMAP.list.find((b) => b.id === 'view.next');
    expect(KEYMAP.projects.find((b) => b.id === 'view.next')).toBe(listNext);
    expect(KEYMAP.images.find((b) => b.id === 'view.next')).toBe(listNext);
  });
});

describe('keyNameOf shift+tab', () => {
  test('reports shift+tab when tab and shift are both set', () => {
    expect(keyNameOf('', { tab: true, shift: true })).toBe('shift+tab');
    expect(keyNameOf('', { tab: true })).toBe('tab');
  });
});
