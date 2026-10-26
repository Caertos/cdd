import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let cachedVersion;

export function getAppVersion() {
  if (cachedVersion) {
    return cachedVersion;
  }

  try {
    const __filename = fileURLToPath(import.meta.url);
    const moduleDir = path.dirname(__filename);
    const packageJsonPath = path.resolve(moduleDir, '../../package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    cachedVersion = packageJson.version ?? 'unknown';
    return cachedVersion;
  } catch (_error) {
    cachedVersion = 'unknown';
    return cachedVersion;
  }
}
