// Script para agregar automáticamente la extensión .js a los imports relativos en dist/
const fs = require('node:fs');
const path = require('node:path');

function needsExtension(p) {
  // already has a known extension
  return !/\.(js|jsx|mjs|json)$/.test(p);
}

function normalizePath(p) {
  return needsExtension(p) ? `${p}.js` : p;
}

function addJsExtensionToImports(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');

  // from '...'
  code = code.replace(/from\s+(['"])(\.{1,2}\/[^'"\)]+?)\1/g, (_m, quote, p) => {
    return `from ${quote}${normalizePath(p)}${quote}`;
  });

  // side-effect imports: import '...';
  code = code.replace(/(^|\n)\s*import\s+(['"])(\.{1,2}\/[^'"\)]+?)\2/gm, (_m, pre, quote, p) => {
    return `${pre}import ${quote}${normalizePath(p)}${quote}`;
  });

  // export ... from '...'
  code = code.replace(/export[\s\S]*?from\s+(['"])(\.{1,2}\/[^'"\)]+?)\1/g, (m, _quote, p) => {
    return m.replace(p, normalizePath(p));
  });

  // dynamic imports import('...')
  code = code.replace(/import\(\s*(['"])(\.{1,2}\/[^'"\)]+?)\1\s*\)/g, (_m, quote, p) => {
    return `import(${quote}${normalizePath(p)}${quote})`;
  });

  // Convert any remaining .jsx import specifiers to .js
  code = code.replace(/(['"])(\.{1,2}\/[^'"\s]+?)\.jsx\1/g, (_m, q, p) => `${q}${p}.js${q}`);

  fs.writeFileSync(filePath, code, 'utf8');
}

function processDir(dir) {
  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (file.endsWith('.js')) {
      addJsExtensionToImports(fullPath);
    }
  });
}

processDir(path.join(__dirname, 'dist'));
