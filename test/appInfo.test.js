/**
 * @jest-environment node
 */
import { jest } from '@jest/globals';

// getAppVersion caches in module scope: without resetModules the first test contaminates the rest.
afterEach(() => jest.resetModules());

describe('getAppVersion', () => {
  test('returns the package.json version', async () => {
    await jest.unstable_mockModule('fs', () => ({
      readFileSync: jest.fn(() => JSON.stringify({ version: '9.9.9' })),
      default: { readFileSync: jest.fn() },
    }));
    const { getAppVersion } = await import('../src/helpers/appInfo.js');
    expect(getAppVersion()).toBe('9.9.9');
  });

  test('caches: second call does not re-read the file', async () => {
    const readFileSync = jest.fn(() => JSON.stringify({ version: '1.0.0' }));
    await jest.unstable_mockModule('fs', () => ({
      readFileSync,
      default: { readFileSync },
    }));
    const { getAppVersion } = await import('../src/helpers/appInfo.js');
    getAppVersion();
    getAppVersion();
    expect(readFileSync).toHaveBeenCalledTimes(1);
  });

  test('read error → "unknown"', async () => {
    await jest.unstable_mockModule('fs', () => {
      const readFileSync = jest.fn(() => {
        throw new Error('ENOENT');
      });
      return { readFileSync, default: { readFileSync } };
    });
    const { getAppVersion } = await import('../src/helpers/appInfo.js');
    expect(getAppVersion()).toBe('unknown');
  });

  test('package.json without version field → "unknown"', async () => {
    await jest.unstable_mockModule('fs', () => {
      const readFileSync = jest.fn(() => JSON.stringify({ name: 'cdd' }));
      return { readFileSync, default: { readFileSync } };
    });
    const { getAppVersion } = await import('../src/helpers/appInfo.js');
    expect(getAppVersion()).toBe('unknown');
  });

  test('corrupt JSON → "unknown" (does not propagate the exception)', async () => {
    await jest.unstable_mockModule('fs', () => {
      const readFileSync = jest.fn(() => '{ not json');
      return { readFileSync, default: { readFileSync } };
    });
    const { getAppVersion } = await import('../src/helpers/appInfo.js');
    expect(getAppVersion()).toBe('unknown');
  });
});
