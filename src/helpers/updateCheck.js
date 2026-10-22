import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** npm package name; must match package.json "name". */
export const PACKAGE_NAME = 'cdd-cli';
export const REGISTRY_URL = `https://registry.npmjs.org/${PACKAGE_NAME}/latest`;
export const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const FETCH_TIMEOUT_MS = 3000;

// MAJOR.MINOR.PATCH with an optional -prerelease and ignored +build.
const SEMVER =
  /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

/**
 * True when `value` is a plain semver string. Anything that comes from the
 * network goes through this before it is shown or used.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidVersion(value) {
  return typeof value === 'string' && value.length <= 64 && SEMVER.test(value);
}

/**
 * Compares two semver strings.
 * A prerelease ranks below its release (1.0.0-rc.1 < 1.0.0); two prereleases
 * of the same core compare as plain strings, which is enough for rc.N tags.
 *
 * @param {string} a
 * @param {string} b
 * @returns {-1|0|1} -1 if a < b, 1 if a > b, 0 if equal
 * @throws {TypeError} if either argument is not a valid version
 */
export function compareVersions(a, b) {
  const pa = SEMVER.exec(a);
  const pb = SEMVER.exec(b);
  if (!pa || !pb) throw new TypeError(`Invalid version: ${!pa ? a : b}`);
  for (let i = 1; i <= 3; i++) {
    const diff = Number(pa[i]) - Number(pb[i]);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  const [preA, preB] = [pa[4], pb[4]];
  if (preA === preB) return 0;
  if (preA === undefined) return 1;
  if (preB === undefined) return -1;
  return preA > preB ? 1 : -1;
}

/**
 * Whether the update check must not run at all.
 *
 * @param {Object<string, string|undefined>} env
 * @param {boolean|undefined} isTTY - process.stdout.isTTY
 * @returns {boolean}
 */
export function shouldSkipCheck(env, isTTY) {
  return Boolean(
    env.CDD_NO_UPDATE_CHECK ||
    env.NO_UPDATE_NOTIFIER ||
    env.CI ||
    env.NODE_ENV === 'test' ||
    !isTTY
  );
}

/**
 * Where the last check result is stored.
 *
 * @param {Object<string, string|undefined>} env
 * @param {string} platform - process.platform
 * @param {string} homedir - os.homedir()
 * @returns {string}
 */
export function cacheFilePath(env, platform, homedir) {
  let base;
  if (platform === 'win32') {
    base = env.LOCALAPPDATA || path.join(homedir, 'AppData', 'Local');
  } else {
    base = env.XDG_CACHE_HOME || path.join(homedir, '.cache');
  }
  return path.join(base, 'cdd', 'update-check.json');
}

/**
 * Reads the cache. Any problem (missing, corrupt, wrong shape) → null.
 *
 * @param {string} file
 * @param {{ readFileSync: Function }} fsImpl
 * @returns {{ checkedAt: number, latest: string }|null}
 */
export function readCache(file, fsImpl = fs) {
  try {
    const data = JSON.parse(fsImpl.readFileSync(file, 'utf8'));
    if (Number.isFinite(data?.checkedAt) && isValidVersion(data?.latest)) {
      return { checkedAt: data.checkedAt, latest: data.latest };
    }
  } catch {
    // Missing or unreadable cache is the normal first-run case.
  }
  return null;
}

/**
 * Writes the cache. Failures are swallowed: a read-only home must not break CDD.
 *
 * @param {string} file
 * @param {{ checkedAt: number, latest: string }} entry
 * @param {{ mkdirSync: Function, writeFileSync: Function }} fsImpl
 */
export function writeCache(file, entry, fsImpl = fs) {
  try {
    fsImpl.mkdirSync(path.dirname(file), { recursive: true });
    fsImpl.writeFileSync(file, JSON.stringify(entry));
  } catch {
    // Best effort only.
  }
}

/**
 * Asks the npm registry for the `latest` dist-tag.
 *
 * @param {Object} [options]
 * @param {typeof fetch} [options.fetchFn=globalThis.fetch]
 * @param {number} [options.timeoutMs=FETCH_TIMEOUT_MS]
 * @returns {Promise<string|null>} The version, or null on any failure
 */
export async function fetchLatestVersion({
  fetchFn = globalThis.fetch,
  timeoutMs = FETCH_TIMEOUT_MS,
} = {}) {
  try {
    const res = await fetchFn(REGISTRY_URL, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const body = await res.json();
    return isValidVersion(body?.version) ? body.version : null;
  } catch {
    return null;
  }
}

/**
 * @typedef {Object} UpdateInfo
 * @property {string} current
 * @property {string} latest
 * @property {boolean} updateAvailable
 */

/**
 * Full check: opt-out, cache, registry. Never throws.
 *
 * @param {Object} options
 * @param {string} options.currentVersion - From getAppVersion()
 * @param {Object<string, string|undefined>} [options.env=process.env]
 * @param {boolean} [options.isTTY=process.stdout.isTTY]
 * @param {() => number} [options.now=Date.now]
 * @param {typeof fetch} [options.fetchFn]
 * @param {Object} [options.fsImpl=fs]
 * @param {string} [options.cacheFile]
 * @returns {Promise<UpdateInfo|null>} null when skipped or unknown
 */
export async function checkForUpdate({
  currentVersion,
  env = process.env,
  isTTY = process.stdout?.isTTY,
  now = Date.now,
  fetchFn,
  fsImpl = fs,
  cacheFile = cacheFilePath(env, process.platform, os.homedir()),
}) {
  if (shouldSkipCheck(env, isTTY) || !isValidVersion(currentVersion)) {
    return null;
  }

  let latest;
  const cached = readCache(cacheFile, fsImpl);
  if (cached && now() - cached.checkedAt < CHECK_INTERVAL_MS) {
    latest = cached.latest;
  } else {
    latest = await fetchLatestVersion({ fetchFn });
    if (!latest) return null;
    writeCache(cacheFile, { checkedAt: now(), latest }, fsImpl);
  }

  return {
    current: currentVersion,
    latest,
    updateAvailable: compareVersions(latest, currentVersion) > 0,
  };
}
