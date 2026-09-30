/**
 * @jest-environment node
 */
import fs from 'fs';
import path from 'path';

const SRC = path.resolve('src');

/** Walk src/ and collect named imports of 'ink' (ignores JSDoc). */
function collectInkImports(dir, found = new Set()) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectInkImports(full, found);
      continue;
    }
    if (!/\.jsx?$/.test(entry.name)) continue;
    const code = fs.readFileSync(full, 'utf8');
    const m =
      code.match(/^\s*import\s+\{([^}]+)\}\s+from\s+['"]ink['"];?\s*$/gm) ?? [];
    for (const stmt of m) {
      stmt
        .replace(/^\s*import\s*\{|\}\s*from\s*['"]ink['"];?\s*$/g, '')
        .split(',')
        .map((s) => s.trim().split(/\s+as\s+/)[0])
        .filter(Boolean)
        .forEach((name) => found.add(name));
    }
  }
  return found;
}

test('ink mock exports every named import used under src/', async () => {
  const used = [...collectInkImports(SRC)];
  const mock = await import('../__mocks__/ink.cjs');
  const missing = used.filter((name) => !(name in mock.default ?? mock));
  expect(missing).toEqual([]);
});

// Contract: every Text prop a component relies on must reach the DOM as data-*,
// or tests silently lose it (it happened with dimColor, then with inverse).
test('ink mock Text forwards color, dimColor and inverse as data-*', async () => {
  const mock = await import('../__mocks__/ink.cjs');
  const { Text } = mock.default ?? mock;
  const el = Text({ children: 'x', color: 'red', dimColor: true, inverse: true });
  expect(el.props).toMatchObject({
    'data-color': 'red',
    'data-dim': 'true',
    'data-inverse': 'true',
  });
});
