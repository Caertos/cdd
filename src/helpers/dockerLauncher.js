/**
 * Docker startup detection.
 *
 * Figures out HOW to start the Docker daemon/desktop on the current platform,
 * WITHOUT actually launching anything. The caller (PR 3) decides whether to
 * surface a launch key based on the result.
 */

import { existsSync as fsExistsSync } from 'node:fs';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { withTerminalHandover } from './terminalHandover.js';

/**
 * @typedef {Object} LaunchMethod
 * @property {'windows-desktop'|'macos-desktop'|'linux-user'|'linux-system'} kind
 * @property {string} command          - Executable to run
 * @property {string[]} args           - Arguments for the executable
 * @property {boolean} needsPrivileges - true -> must hand the terminal over (sudo)
 * @property {string} display          - Command shown verbatim to the user
 * @property {number} typicalWaitMs    - Typical time until the daemon is ready
 */

/**
 * Promisified `execFile` wrapper.
 *
 * Resolves with `{ stdout, stderr }` when the process exits 0; rejects
 * otherwise. Kept internal so tests can inject a deterministic fake.
 *
 * @param {string} cmd
 * @param {string[]} args
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
function defaultExecFile(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

/**
 * Windows detection: Docker Desktop install locations, in priority order.
 *
 * 1. %ProgramFiles%\Docker\Docker\Docker Desktop.exe  (machine-wide, default)
 * 2. %ProgramFiles(x86)%\Docker\Docker\Docker Desktop.exe
 * 3. %ProgramW6432%\Docker\Docker\Docker Desktop.exe  (32-bit Node on 64-bit OS)
 * 4. %LOCALAPPDATA%\Docker\Docker\Docker Desktop.exe  (per-user install)
 * 5. Any `Docker Desktop.exe` reachable through `env.PATH`
 *
 * @param {Object<string, string|undefined>} env
 * @param {(p: string) => boolean} existsSync
 * @returns {LaunchMethod|null}
 */
function detectWindows(env, existsSync) {
  const candidates = [];

  const programFiles = env.ProgramFiles;
  if (programFiles) {
    candidates.push(
      path.join(programFiles, 'Docker', 'Docker', 'Docker Desktop.exe')
    );
  }
  const programFilesX86 = env['ProgramFiles(x86)'];
  if (programFilesX86) {
    candidates.push(
      path.join(programFilesX86, 'Docker', 'Docker', 'Docker Desktop.exe')
    );
  }
  const programW6432 = env.ProgramW6432;
  if (programW6432) {
    candidates.push(
      path.join(programW6432, 'Docker', 'Docker', 'Docker Desktop.exe')
    );
  }
  const localAppData = env.LOCALAPPDATA;
  if (localAppData) {
    candidates.push(
      path.join(localAppData, 'Docker', 'Docker', 'Docker Desktop.exe')
    );
  }

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return {
        kind: 'windows-desktop',
        command: candidate,
        args: [],
        needsPrivileges: false,
        display: `"${candidate}"`,
        typicalWaitMs: 60000,
      };
    }
  }

  const pathEntries = (env.PATH ?? '').split(path.delimiter);
  for (const entry of pathEntries) {
    if (!entry) continue;
    const candidate = path.join(entry, 'Docker Desktop.exe');
    if (existsSync(candidate)) {
      return {
        kind: 'windows-desktop',
        command: candidate,
        args: [],
        needsPrivileges: false,
        display: `"${candidate}"`,
        typicalWaitMs: 60000,
      };
    }
  }

  return null;
}

/**
 * macOS detection: Docker Desktop.app in the standard Applications folder.
 *
 * @param {(p: string) => boolean} existsSync
 * @returns {LaunchMethod|null}
 */
function detectMacos(existsSync) {
  if (existsSync('/Applications/Docker.app')) {
    return {
      kind: 'macos-desktop',
      command: 'open',
      args: ['-a', 'Docker'],
      needsPrivileges: false,
      display: 'open -a Docker',
      typicalWaitMs: 30000,
    };
  }
  return null;
}

/**
 * Linux detection: rootless systemd service first, then system service.
 *
 * @param {(p: string) => boolean} existsSync
 * @param {(cmd: string, args: string[]) => Promise<{stdout: string, stderr: string}>} execFileAsync
 * @returns {Promise<LaunchMethod|null>}
 */
async function detectLinux(existsSync, execFileAsync) {
  try {
    await execFileAsync('systemctl', ['--user', 'is-enabled', 'docker']);
    return {
      kind: 'linux-user',
      command: 'systemctl',
      args: ['--user', 'start', 'docker'],
      needsPrivileges: false,
      display: 'systemctl --user start docker',
      typicalWaitMs: 30000,
    };
  } catch {
    // Not enabled as a user service — fall through to the system check.
  }

  if (
    existsSync('/usr/lib/systemd/system/docker.service') ||
    existsSync('/etc/init.d/docker')
  ) {
    return {
      kind: 'linux-system',
      command: 'sudo',
      args: ['systemctl', 'start', 'docker'],
      needsPrivileges: true,
      display: 'sudo systemctl start docker',
      typicalWaitMs: 30000,
    };
  }

  return null;
}

/**
 * Determine how to start Docker on this system.
 *
 * Returns `null` when there is no known way, so the caller can hide the
 * launch key. Detection runs BEFORE offering the key because a button that
 * fails half the time is worse than no button at all.
 *
 * Windows is the PRIMARY platform (the repo currently only runs against
 * Docker Desktop on Windows), so its candidates are searched first and in a
 * strict priority order: ProgramFiles → ProgramFiles(x86) → ProgramW6432 →
 * LOCALAPPDATA → PATH.
 *
 * All real filesystem/process access is injectable via `deps` so the function
 * is testable without real files or spawning.
 *
 * @param {string} [platform=process.platform] - Node platform identifier
 * @param {Object} [deps={}] - Injectable dependencies
 * @param {(p: string) => boolean} [deps.existsSync] - Defaults to `fs.existsSync`
 * @param {Object<string, string|undefined>} [deps.env] - Defaults to `process.env`
 * @param {(cmd: string, args: string[]) => Promise<{stdout: string, stderr: string}>} [deps.execFile] - Defaults to a promisified `execFile`
 * @returns {Promise<LaunchMethod|null>}
 */
export async function detectLaunchMethod(
  platform = process.platform,
  deps = {}
) {
  const existsSync = deps.existsSync ?? fsExistsSync;
  const env = deps.env ?? process.env;
  const execFileAsync = deps.execFile ?? defaultExecFile;

  switch (platform) {
    case 'win32':
      return detectWindows(env, existsSync);
    case 'darwin':
      return detectMacos(existsSync);
    case 'linux':
      return detectLinux(existsSync, execFileAsync);
    default:
      return null;
  }
}

/**
 * Launch Docker without needing privileges (Windows, macOS, Linux rootless).
 * Resolves once the process has been spawned, NOT when Docker is ready.
 *
 * @param {LaunchMethod} method
 * @returns {Promise<{ started: boolean, error?: string }>}
 */
export async function launchDocker(method) {
  try {
    const child = spawn(method.command, method.args, {
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
    });
    child.unref();
    return { started: true };
  } catch (err) {
    return { started: false, error: err.message };
  }
}

/**
 * Spawn a command in the inherited terminal and resolve with its exit code.
 *
 * Internal helper, exported only so tests can inject a fake `spawn`. It
 * reports the raw exit code and deliberately does NOT interpret what a
 * non-zero exit means (e.g. a wrong sudo password) — that judgement belongs
 * to the caller.
 *
 * @param {LaunchMethod} method
 * @param {typeof spawn} [spawnFn] - Injectable spawn (defaults to `node:child_process` spawn)
 * @returns {Promise<{ started: boolean, exitCode: number|null }>}
 */
export function runElevatedCommand(method, spawnFn = spawn) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawnFn(method.command, method.args, { stdio: 'inherit' });
    } catch {
      resolve({ started: false, exitCode: null });
      return;
    }

    child.once('error', () => resolve({ started: false, exitCode: null }));
    child.once('close', (code) => {
      resolve({ started: code === 0, exitCode: code });
    });
  });
}

/**
 * Launch Docker handing the terminal over so sudo can prompt for a password.
 * Reuses the same unmount/remount mechanism as shell mode.
 *
 * @param {LaunchMethod} method
 * @returns {Promise<{ started: boolean, exitCode: number|null }>}
 */
export async function launchDockerElevated(method) {
  return withTerminalHandover(() => runElevatedCommand(method));
}
