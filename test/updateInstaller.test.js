/**
 * @jest-environment node
 */
import { jest } from '@jest/globals';
import { EventEmitter } from 'node:events';
import { detectInstallMethod, runUpdateCommand } from '../src/helpers/updateInstaller.js';

const id = (p) => p;

describe('detectInstallMethod', () => {
  test.each([
    ['/usr/lib/node_modules/cdd-cli/dist/index.js', 'npm', 'npm install -g cdd-cli@latest'],
    [
      '/home/u/.nvm/versions/node/v22.0.0/lib/node_modules/cdd-cli/dist/index.js',
      'npm',
      'npm install -g cdd-cli@latest',
    ],
    [
      '/home/u/.local/share/pnpm/global/5/node_modules/cdd-cli/dist/index.js',
      'pnpm',
      'pnpm add -g cdd-cli@latest',
    ],
    [
      '/home/u/.config/yarn/global/node_modules/cdd-cli/dist/index.js',
      'yarn',
      'yarn global add cdd-cli@latest',
    ],
    [
      '/home/u/.bun/install/global/node_modules/cdd-cli/dist/index.js',
      'bun',
      'bun add -g cdd-cli@latest',
    ],
    [
      'C:\\Users\\u\\AppData\\Roaming\\npm\\node_modules\\cdd-cli\\dist\\index.js',
      'npm',
      'npm install -g cdd-cli@latest',
    ],
  ])('%s → %s', (scriptPath, kind, display) => {
    const m = detectInstallMethod({ scriptPath, realpath: id });
    expect(m.kind).toBe(kind);
    expect(m.display).toBe(display);
    expect(m.command).not.toBeNull();
  });

  test('npx cannot self-update', () => {
    const m = detectInstallMethod({
      scriptPath: '/home/u/.npm/_npx/abc/node_modules/cdd-cli/dist/index.js',
      realpath: id,
    });
    expect(m).toEqual({ kind: 'npx', command: null, args: [], display: 'npx cdd-cli@latest' });
  });

  test('a source checkout is unknown and only shows the npm command', () => {
    const m = detectInstallMethod({ scriptPath: '/home/u/src/cdd/dist/index.js', realpath: id });
    expect(m.kind).toBe('unknown');
    expect(m.command).toBeNull();
    expect(m.display).toBe('npm install -g cdd-cli@latest');
  });

  test('follows the bin symlink', () => {
    const realpath = jest.fn(() => '/usr/lib/node_modules/cdd-cli/dist/index.js');
    expect(detectInstallMethod({ scriptPath: '/usr/bin/cdd', realpath }).kind).toBe('npm');
  });

  test('realpath failure falls back to the raw path', () => {
    const realpath = () => {
      throw new Error('ENOENT');
    };
    expect(
      detectInstallMethod({ scriptPath: '/usr/lib/node_modules/cdd-cli/dist/index.js', realpath })
        .kind
    ).toBe('npm');
  });
});

function fakeSpawn(behaviour) {
  return jest.fn(() => {
    const child = new EventEmitter();
    setImmediate(() => behaviour(child));
    return child;
  });
}

describe('runUpdateCommand', () => {
  const NPM = {
    kind: 'npm',
    command: 'npm',
    args: ['install', '-g', 'cdd-cli@latest'],
    display: '',
  };

  test('exit 0 → ok, stdio inherited, no shell on unix', async () => {
    const spawnFn = fakeSpawn((c) => c.emit('close', 0));
    await expect(runUpdateCommand(NPM, { spawnFn, platform: 'linux' })).resolves.toEqual({
      ok: true,
      exitCode: 0,
    });
    expect(spawnFn).toHaveBeenCalledWith('npm', NPM.args, { stdio: 'inherit', shell: false });
  });

  test('uses a shell on win32', async () => {
    const spawnFn = fakeSpawn((c) => c.emit('close', 0));
    await runUpdateCommand(NPM, { spawnFn, platform: 'win32' });
    expect(spawnFn.mock.calls[0][2].shell).toBe(true);
  });

  test('non-zero exit → not ok with the code', async () => {
    const spawnFn = fakeSpawn((c) => c.emit('close', 243));
    await expect(runUpdateCommand(NPM, { spawnFn, platform: 'linux' })).resolves.toEqual({
      ok: false,
      exitCode: 243,
    });
  });

  test('spawn error (command missing) → not ok', async () => {
    const spawnFn = fakeSpawn((c) => c.emit('error', new Error('ENOENT')));
    await expect(runUpdateCommand(NPM, { spawnFn })).resolves.toEqual({
      ok: false,
      exitCode: null,
    });
  });

  test('method without command never spawns', async () => {
    const spawnFn = jest.fn();
    await expect(
      runUpdateCommand({ command: null, args: [] }, { spawnFn })
    ).resolves.toEqual({ ok: false, exitCode: null });
    expect(spawnFn).not.toHaveBeenCalled();
  });
});
