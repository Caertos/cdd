// Script para agregar automáticamente la extensión .js a los imports relativos en dist/
const fs = require('fs');
const path = require('path');

function addJsExtensionToImports(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');
  // Reemplaza imports relativos sin extensión por .js
  code = code.replace(/(import\s+[^'";]+['"])(\.\/[^'".]+)(['"])/g, '$1$2.js$3');
  code = code.replace(/(from\s+['"])(\.\/[^'".]+)(['"])/g, '$1$2.js$3');
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
