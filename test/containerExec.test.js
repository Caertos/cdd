/**
 * @jest-environment node
 */
import { jest } from '@jest/globals';
import { EventEmitter } from 'events';

afterEach(() => {
  jest.resetModules();
  jest.useRealTimers();
});

/** Fake stream that emits `output` and ends. */
function fakeStream(output) {
  const s = new EventEmitter();
  setImmediate(() => {
    if (output) s.emit('data', Buffer.from(output));
    s.emit('end');
  });
  return s;
}

async function loadExec(execImpl, { spawn } = {}) {
  await jest.unstable_mockModule('../src/helpers/dockerService/dockerService.js', () => ({
    docker: { getContainer: jest.fn().mockReturnValue({ exec: execImpl }) },
  }));
  if (spawn) {
    await jest.unstable_mockModule('child_process', () => ({
      spawn,
      default: { spawn },
    }));
  }
  return import('../src/helpers/dockerService/serviceComponents/containerExec.js');
}

describe('detectShell', () => {
  // detectShell races a 30s timer it never clears (§5.1 residual), which would
  // keep Jest's event loop alive for 30s after the run. Fake that timer away;
  // setImmediate stays real so fakeStream() can flush on the real loop.
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['setImmediate'] });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  test('invalid ID → rejects before touching Docker', async () => {
    const exec = jest.fn();
    const { detectShell } = await loadExec(exec);
    await expect(detectShell('')).rejects.toThrow('Invalid container ID');
    expect(exec).not.toHaveBeenCalled();
  });

  test('`which bash` returns a path → "bash"', async () => {
    const exec = jest.fn((opts, cb) =>
      cb(null, { start: (o, sc) => sc(null, fakeStream('/bin/bash\n')) })
    );
    const { detectShell } = await loadExec(exec);
    await expect(detectShell('a'.repeat(64))).resolves.toBe('bash');
  });

  test('`which bash` empty → falls back to "sh"', async () => {
    const exec = jest.fn((opts, cb) =>
      cb(null, { start: (o, sc) => sc(null, fakeStream('')) })
    );
    const { detectShell } = await loadExec(exec);
    await expect(detectShell('a'.repeat(64))).resolves.toBe('sh');
  });

  test('exec fails → falls back to "sh" without propagating', async () => {
    const exec = jest.fn((opts, cb) => cb(new Error('no such container')));
    const { detectShell } = await loadExec(exec);
    await expect(detectShell('a'.repeat(64))).resolves.toBe('sh');
  });

  // Deferred to §5.1: detectShell still leaves a 30s setTimeout uncleared,
  // so "no pending timers after resolving" fails until that fix lands.
});

describe('execInteractive', () => {
  test('invalid ID → rejects', async () => {
    const { execInteractive } = await loadExec(jest.fn());
    await expect(execInteractive('no válido!')).rejects.toThrow('Invalid container ID');
  });

  test('shell outside allowlist → rejects', async () => {
    const { execInteractive } = await loadExec(jest.fn());
    await expect(
      execInteractive('a'.repeat(64), { shell: 'zsh' })
    ).rejects.toThrow('Unsupported shell: zsh');
  });

  test('spawns `docker exec -it <id> <shell>` without system shell', async () => {
    const child = new EventEmitter();
    const spawn = jest.fn(() => child);
    const { execInteractive } = await loadExec(jest.fn(), { spawn });

    const id = 'a'.repeat(64);
    const p = execInteractive(id, { shell: 'sh' });
    child.emit('close', 0, null);

    await expect(p).resolves.toEqual({ code: 0, signal: null });
    expect(spawn).toHaveBeenCalledWith('docker', ['exec', '-it', id, 'sh'], {
      stdio: 'inherit',
      shell: false,
    });
  });

  test('workingDir is inserted as -w before the id', async () => {
    const child = new EventEmitter();
    const spawn = jest.fn(() => child);
    const { execInteractive } = await loadExec(jest.fn(), { spawn });

    const id = 'a'.repeat(64);
    const p = execInteractive(id, { shell: 'sh', workingDir: '/app' });
    child.emit('close', 0, null);
    await p;

    expect(spawn.mock.calls[0][1]).toEqual(['exec', '-it', id, '-w', '/app', 'sh']);
  });

  test('spawn error → rejects with "Failed to open shell"', async () => {
    const child = new EventEmitter();
    const spawn = jest.fn(() => child);
    const { execInteractive } = await loadExec(jest.fn(), { spawn });

    const p = execInteractive('a'.repeat(64), { shell: 'sh' });
    child.emit('error', new Error('ENOENT'));

    await expect(p).rejects.toThrow('Failed to open shell: ENOENT');
  });
});

describe('execCommand', () => {
  test('successful command → stdout and exitCode', async () => {
    const exec = jest.fn((opts, cb) =>
      cb(null, {
        start: (o, sc) => sc(null, fakeStream('hola\n')),
        inspect: (icb) => icb(null, { ExitCode: 0 }),
      })
    );
    const { execCommand } = await loadExec(exec);
    await expect(execCommand('cid', ['echo', 'hola'])).resolves.toEqual({
      stdout: 'hola',
      stderr: '',
      exitCode: 0,
    });
  });

  test('inspect without info → exitCode -1', async () => {
    const exec = jest.fn((opts, cb) =>
      cb(null, {
        start: (o, sc) => sc(null, fakeStream('x')),
        inspect: (icb) => icb(new Error('gone')),
      })
    );
    const { execCommand } = await loadExec(exec);
    await expect(execCommand('cid', ['x'])).resolves.toMatchObject({ exitCode: -1 });
  });

  test('error creating exec → "Exec create failed"', async () => {
    const exec = jest.fn((opts, cb) => cb(new Error('boom')));
    const { execCommand } = await loadExec(exec);
    await expect(execCommand('cid', ['x'])).rejects.toThrow('Exec create failed: boom');
  });

  test('error starting exec → "Exec start failed"', async () => {
    const exec = jest.fn((opts, cb) =>
      cb(null, { start: (o, sc) => sc(new Error('nope')) })
    );
    const { execCommand } = await loadExec(exec);
    await expect(execCommand('cid', ['x'])).rejects.toThrow('Exec start failed: nope');
  });

  test('stream error → "Stream error"', async () => {
    const s = new EventEmitter();
    const exec = jest.fn((opts, cb) =>
      cb(null, { start: (o, sc) => sc(null, s), inspect: jest.fn() })
    );
    const { execCommand } = await loadExec(exec);
    const p = execCommand('cid', ['x']);
    s.emit('error', new Error('reset'));
    await expect(p).rejects.toThrow('Stream error: reset');
  });

  // Documents a known limitation (see §5.6 note on multiplexed streams).
  test('stderr is ALWAYS empty: multiplexed stream is not demultiplexed', async () => {
    const exec = jest.fn((opts, cb) =>
      cb(null, {
        start: (o, sc) => sc(null, fakeStream('error output')),
        inspect: (icb) => icb(null, { ExitCode: 1 }),
      })
    );
    const { execCommand } = await loadExec(exec);
    const res = await execCommand('cid', ['x']);
    expect(res.stderr).toBe('');
    expect(res.stdout).toContain('error output');
  });

  test('execCommand does NOT validate containerId (unlike detectShell)', async () => {
    const exec = jest.fn((opts, cb) =>
      cb(null, {
        start: (o, sc) => sc(null, fakeStream('')),
        inspect: (icb) => icb(null, { ExitCode: 0 }),
      })
    );
    const { execCommand } = await loadExec(exec);
    await expect(execCommand('; rm -rf /', ['x'])).resolves.toBeDefined();
    // Inconsistency to decide: should it validate like detectShell/execInteractive?
  });
});
