'use strict';
const path = require('path');
const fs = require('fs');
const { createRequire } = require('module');
const pnpmDir = path.join(__dirname, '../node_modules/.pnpm');
const entry = fs.readdirSync(pnpmDir).find((d) => d.startsWith('@socketregistry+indent-string@'));
if (!entry) {
  throw new Error('Socket indent-string override not found in pnpm store');
}
const req = createRequire(path.join(pnpmDir, entry, 'node_modules/@socketregistry/indent-string/package.json'));
module.exports = req('./index.cjs');
