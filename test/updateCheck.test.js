/**
 * @jest-environment node
 */
import { jest } from '@jest/globals';
import {
  isValidVersion,
  compareVersions,
  shouldSkipCheck,
  cacheFilePath,
  readCache,
  writeCache,
  fetchLatestVersion,
  checkForUpdate,
  REGISTRY_URL,
  CHECK_INTERVAL_MS,
} from '../src/helpers/updateCheck.js';

const TTY_ENV = {}; // no opt-out variables

function okResponse(body) {
  return { ok: true, json: async () => body };
}

function memoryFs(initial = {}) {
  const files = { ...initial };
  return {
    files,
    readFileSync: jest.fn((f) => {
      if (!(f in files)) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      return files[f];
    }),
    writeFileSync: jest.fn((f, data) => {
      files[f] = data;
    }),
    mkdirSync: jest.fn(),
  };
}

describe('compareVersions', () => {
  test.each([
    ['4.12.0', '4.11.1', 1],
    ['4.11.1', '4.12.0', -1],
    ['4.11.1', '4.11.1', 0],
    ['5.0.0', '4.99.99', 1],
    ['4.10.0', '4.9.0', 1], // numeric, not lexical
    ['1.0.0', '1.0.0-rc.1', 1],
    ['1.0.0-rc.2', '1.0.0-rc.1', 1],
    ['1.0.0+build.5', '1.0.0', 0],
  ])('%s vs %s → %i', (a, b, expected) => {
    expect(compareVersions(a, b)).toBe(expected);
  });

  test('invalid input throws TypeError', () => {
    expect(() => compareVersions('latest', '1.0.0')).toThrow(TypeError);
  });
});

describe('isValidVersion', () => {
  test.each(['1.2.3', '10.0.0-beta.1'])('accepts %s', (v) =>
    expect(isValidVersion(v)).toBe(true)
  );
  test.each([
    'v1.2.3',
    '1.2',
    'unknown',
    '1.2.3' + String.fromCharCode(27) + '[31m',
    42,
    null,
    '9'.repeat(70) + '.0.0',
  ])('rejects %p', (v) => expect(isValidVersion(v)).toBe(false));
});

describe('shouldSkipCheck', () => {
  test('runs on a TTY with no opt-out', () => {
    expect(shouldSkipCheck({}, true)).toBe(false);
  });
  test.each([
    [{ CDD_NO_UPDATE_CHECK: '1' }, true],
    [{ NO_UPDATE_NOTIFIER: '1' }, true],
    [{ CI: 'true' }, true],
    [{ NODE_ENV: 'test' }, true],
    [{}, false], // not a TTY
  ])('skips with env %p and isTTY=%p', (env, isTTY) => {
    expect(shouldSkipCheck(env, isTTY)).toBe(true);
  });
});

describe('cacheFilePath', () => {
  test('XDG_CACHE_HOME wins on unix', () => {
    expect(cacheFilePath({ XDG_CACHE_HOME: '/x' }, 'linux', '/home/u')).toBe(
      '/x/cdd/update-check.json'
    );
  });
  test('falls back to ~/.cache', () => {
    expect(cacheFilePath({}, 'darwin', '/Users/u')).toBe(
      '/Users/u/.cache/cdd/update-check.json'
    );
  });
  test('uses LOCALAPPDATA on win32', () => {
    expect(cacheFilePath({ LOCALAPPDATA: 'C:\\L' }, 'win32', 'C:\\U')).toContain('cdd');
  });
});

describe('readCache / writeCache', () => {
  test('round trip', () => {
    const mem = memoryFs();
    writeCache('/c/u.json', { checkedAt: 1, latest: '1.0.0' }, mem);
    expect(readCache('/c/u.json', mem)).toEqual({ checkedAt: 1, latest: '1.0.0' });
  });
  test('corrupt JSON → null', () => {
    expect(readCache('/c', memoryFs({ '/c': '{nope' }))).toBeNull();
  });
  test('invalid version in cache → null', () => {
    const mem = memoryFs({ '/c': JSON.stringify({ checkedAt: 1, latest: '<script>' }) });
    expect(readCache('/c', mem)).toBeNull();
  });
  test('write failure is swallowed', () => {
    const mem = memoryFs();
    mem.mkdirSync.mockImplementation(() => {
      throw new Error('EACCES');
    });
    expect(() => writeCache('/c', { checkedAt: 1, latest: '1.0.0' }, mem)).not.toThrow();
  });
});

describe('fetchLatestVersion', () => {
  test('asks the latest dist-tag and returns its version', async () => {
    const fetchFn = jest.fn(async () => okResponse({ version: '4.12.0' }));
    await expect(fetchLatestVersion({ fetchFn })).resolves.toBe('4.12.0');
    expect(fetchFn).toHaveBeenCalledWith(
      REGISTRY_URL,
      expect.objectContaining({ signal: expect.anything() })
    );
  });
  test('non-2xx → null', async () => {
    const fetchFn = async () => ({ ok: false, json: async () => ({}) });
    await expect(fetchLatestVersion({ fetchFn })).resolves.toBeNull();
  });
  test('network error → null', async () => {
    const fetchFn = async () => {
      throw new TypeError('fetch failed');
    };
    await expect(fetchLatestVersion({ fetchFn })).resolves.toBeNull();
  });
  test('payload with an invalid version → null', async () => {
    const fetchFn = async () => okResponse({ version: '1.0.0; rm -rf /' });
    await expect(fetchLatestVersion({ fetchFn })).resolves.toBeNull();
  });
  test('times out', async () => {
    const fetchFn = (url, { signal }) =>
      new Promise((_, reject) =>
        signal.addEventListener('abort', () => reject(signal.reason))
      );
    await expect(fetchLatestVersion({ fetchFn, timeoutMs: 10 })).resolves.toBeNull();
  });
});

describe('checkForUpdate', () => {
  const base = { env: TTY_ENV, isTTY: true, cacheFile: '/c/u.json' };

  test('newer version on npm → updateAvailable', async () => {
    const fetchFn = jest.fn(async () => okResponse({ version: '4.12.0' }));
    const result = await checkForUpdate({
      ...base,
      currentVersion: '4.11.1',
      fetchFn,
      fsImpl: memoryFs(),
      now: () => 1000,
    });
    expect(result).toEqual({ current: '4.11.1', latest: '4.12.0', updateAvailable: true });
  });

  test('same version → not available', async () => {
    const fetchFn = async () => okResponse({ version: '4.11.1' });
    const result = await checkForUpdate({
      ...base,
      currentVersion: '4.11.1',
      fetchFn,
      fsImpl: memoryFs(),
    });
    expect(result.updateAvailable).toBe(false);
  });

  test('fresh cache → no network', async () => {
    const mem = memoryFs({
      '/c/u.json': JSON.stringify({ checkedAt: 1000, latest: '4.12.0' }),
    });
    const fetchFn = jest.fn();
    const result = await checkForUpdate({
      ...base,
      currentVersion: '4.11.1',
      fetchFn,
      fsImpl: mem,
      now: () => 2000,
    });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(result.latest).toBe('4.12.0');
  });

  test('stale cache → asks npm and rewrites the cache', async () => {
    const mem = memoryFs({ '/c/u.json': JSON.stringify({ checkedAt: 0, latest: '4.11.0' }) });
    const fetchFn = jest.fn(async () => okResponse({ version: '4.12.0' }));
    const now = () => CHECK_INTERVAL_MS + 1;
    await checkForUpdate({ ...base, currentVersion: '4.11.1', fetchFn, fsImpl: mem, now });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(JSON.parse(mem.files['/c/u.json'])).toEqual({
      checkedAt: now(),
      latest: '4.12.0',
    });
  });

  test('opt-out → null and no network', async () => {
    const fetchFn = jest.fn();
    const result = await checkForUpdate({
      ...base,
      env: { CDD_NO_UPDATE_CHECK: '1' },
      currentVersion: '4.11.1',
      fetchFn,
    });
    expect(result).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  test('current version unknown → null', async () => {
    const fetchFn = jest.fn();
    await expect(
      checkForUpdate({ ...base, currentVersion: 'unknown', fetchFn })
    ).resolves.toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  test('offline → null, cache untouched', async () => {
    const mem = memoryFs();
    const fetchFn = async () => {
      throw new TypeError('fetch failed');
    };
    await expect(
      checkForUpdate({ ...base, currentVersion: '4.11.1', fetchFn, fsImpl: mem })
    ).resolves.toBeNull();
    expect(mem.writeFileSync).not.toHaveBeenCalled();
  });
});
