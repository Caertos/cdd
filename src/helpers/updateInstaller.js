import { realpathSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { withTerminalHandover } from './terminalHandover.js';
import { PACKAGE_NAME } from './updateCheck.js';

/**
 * @typedef {Object} InstallMethod
 * @property {'npm'|'pnpm'|'yarn'|'bun'|'npx'|'unknown'} kind
 * @property {string|null} command - Executable, null when CDD cannot update itself
 * @property {string[]} args
 * @property {string} display - What the user sees (and could copy)
 */

const TARGET = `${PACKAGE_NAME}@latest`;

const METHODS = {
  npm: { command: 'npm', args: ['install', '-g', TARGET] },
  pnpm: { command: 'pnpm', args: ['add', '-g', TARGET] },
  yarn: { command: 'yarn', args: ['global', 'add', TARGET] },
  bun: { command: 'bun', args: ['add', '-g', TARGET] },
};

/**
 * Works out which package manager installed the running CDD.
 * Order matters: a pnpm global path also contains /node_modules/cdd-cli/.
 *
 * @param {Object} [options]
 * @param {string} [options.scriptPath=process.argv[1]]
 * @param {(p: string) => string} [options.realpath=realpathSync]
 * @returns {InstallMethod}
 */
export function detectInstallMethod({
  scriptPath = process.argv[1],
  realpath = realpathSync,
} = {}) {
  let resolved = scriptPath ?? '';
  try {
    resolved = realpath(resolved);
  } catch {
    // Keep the unresolved path; detection still works on most layouts.
  }
  const p = resolved.replace(/\\/g, '/');

  let kind = 'unknown';
  if (p.includes('/_npx/')) kind = 'npx';
  else if (p.includes('/pnpm/') || p.includes('/.pnpm/')) kind = 'pnpm';
  else if (p.includes('/.bun/')) kind = 'bun';
  else if (p.includes('/.yarn/') || p.includes('/yarn/global/')) kind = 'yarn';
  else if (p.includes(`/node_modules/${PACKAGE_NAME}/`)) kind = 'npm';

  if (kind === 'npx') {
    return { kind, command: null, args: [], display: `npx ${TARGET}` };
  }
  const method = METHODS[kind] ?? METHODS.npm;
  const display = `${method.command} ${method.args.join(' ')}`;
  if (kind === 'unknown') {
    return { kind, command: null, args: [], display };
  }
  return { kind, command: method.command, args: method.args, display };
}

/**
 * Runs the install command with the real terminal attached.
 * On Windows package managers are .cmd shims, which Node refuses to spawn
 * without a shell since CVE-2024-27980. command/args are literals from
 * METHODS, so the shell sees no outside input.
 *
 * @param {InstallMethod} method
 * @param {Object} [options]
 * @param {typeof spawn} [options.spawnFn=spawn]
 * @param {string} [options.platform=process.platform]
 * @returns {Promise<{ ok: boolean, exitCode: number|null }>}
 */
export function runUpdateCommand(
  method,
  { spawnFn = spawn, platform = process.platform } = {}
) {
  return new Promise((resolve) => {
    if (!method?.command) {
      resolve({ ok: false, exitCode: null });
      return;
    }
    let child;
    try {
      child = spawnFn(method.command, method.args, {
        stdio: 'inherit',
        shell: platform === 'win32',
      });
    } catch {
      resolve({ ok: false, exitCode: null });
      return;
    }
    child.once('error', () => resolve({ ok: false, exitCode: null }));
    child.once('close', (code) => resolve({ ok: code === 0, exitCode: code }));
  });
}

/**
 * Hands the terminal over and runs the update, so the package manager's
 * output and any prompt are visible.
 *
 * @param {InstallMethod} method
 * @returns {Promise<{ ok: boolean, exitCode: number|null }>}
 */
export async function installUpdate(method) {
  return withTerminalHandover(() => runUpdateCommand(method));
}
