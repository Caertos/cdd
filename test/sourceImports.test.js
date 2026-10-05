/**
 * @jest-environment node
 */
import fs from 'fs';
import path from 'path';

const SRC = path.resolve('src');
// Relative specifiers in `from '…'`, `import('…')` and side-effect `import '…'`.
const SPEC = /(?:from\s+|import\s*\(\s*|^\s*import\s+)['"](\.\.?\/[^'"]+)['"]/gm;

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.jsx?$/.test(entry.name)) files.push(full);
  }
  return files;
}

function offenders() {
  const found = [];
  for (const file of walk(SRC)) {
    const code = fs.readFileSync(file, 'utf8');
    for (const [, spec] of code.matchAll(SPEC)) {
      if (!/\.(js|jsx|json)$/.test(spec)) {
        found.push(`${path.relative(SRC, file)} → ${spec}`);
      }
    }
  }
  return found;
}

// Control: the scanner does see relative imports at all.
test('scanner finds the relative imports of App.jsx', () => {
  const code = fs.readFileSync(path.join(SRC, 'App.jsx'), 'utf8');
  expect([...code.matchAll(SPEC)].length).toBeGreaterThan(0);
});

// §5.9 (D19)
test('every relative import carries an extension (valid ESM without fix-imports)', () => {
  expect(offenders()).toEqual([]);
});
