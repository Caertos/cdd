// Script para agregar automáticamente la extensión .js a los imports relativos en dist/
const fs = require('fs');
const path = require('path');

function addJsExtensionToImports(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');
  // Reemplaza imports relativos sin extensión por .js
  code = code.replace(/(import\s+[^'";]+['"])(\.\/[^'".]+)(['"])/g, '$1$2.js$3');
  code = code.replace(/(from\s+['"])(\.{1,2}\/[^'".]+)(['"])/g, '$1$2.js$3');
  // También reemplaza importaciones que apunten a archivos .jsx por .js
  code = code.replace(/(from\s+['"])(\.{1,2}\/[^'"\s]+)\.jsx(['"])/g, '$1$2.js$3');
  code = code.replace(/(import\s+[^'";]+['"])(\.{1,2}\/[^'"\s]+)\.jsx(['"])/g, '$1$2.js$3');
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
