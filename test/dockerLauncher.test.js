/**
 * @jest-environment node
 */
import path from 'node:path';
import { detectLaunchMethod } from '../src/helpers/dockerLauncher.js';

// Windows Docker Desktop.exe location given an install root.
const winCandidate = (base) =>
  path.join(base, 'Docker', 'Docker', 'Docker Desktop.exe');

// existsSync fake that returns true only for the listed absolute paths.
const existsAmong = (...allowed) => {
  const set = new Set(allowed);
  return (p) => set.has(p);
};

// existsSync fake that always returns false.
const existsNowhere = () => false;

// execFile fake that resolves (exit 0).
const execResolves = async () => ({ stdout: '', stderr: '' });

// execFile fake that rejects (non-zero exit / error).
const execRejects = async () => {
  throw new Error('Failed to get unit file state: No such file');
};

const PF = 'C:\\Program Files';
const PF_X86 = 'C:\\Program Files (x86)';
const PF_6432 = 'C:\\ProgramW6432';
const LOCALAPPDATA = 'C:\\Users\\tester\\AppData\\Local';

describe('detectLaunchMethod — Windows (win32)', () => {
  test('returns windows-desktop when the ProgramFiles candidate exists', async () => {
    const candidate = winCandidate(PF);
    const result = await detectLaunchMethod('win32', {
      env: { ProgramFiles: PF },
      existsSync: existsAmong(candidate),
    });

    expect(result).toEqual({
      kind: 'windows-desktop',
      command: candidate,
      args: [],
      needsPrivileges: false,
      display: `"${candidate}"`,
      typicalWaitMs: 60000,
    });
  });

  test('falls back to LOCALAPPDATA when earlier candidates are missing', async () => {
    const candidate = winCandidate(LOCALAPPDATA);
    const result = await detectLaunchMethod('win32', {
      env: {
        ProgramFiles: PF,
        'ProgramFiles(x86)': PF_X86,
        ProgramW6432: PF_6432,
        LOCALAPPDATA,
      },
      // Only the LOCALAPPDATA candidate exists: ProgramFiles, (x86) and
      // ProgramW6432 are all reported as missing so priority order is exercised.
      existsSync: existsAmong(candidate),
    });

    expect(result.command).toBe(candidate);
    expect(result.kind).toBe('windows-desktop');
  });

  test('falls back to a PATH entry when no install-dir candidate exists', async () => {
    // Drive-letter paths (C:\...) are avoided here: their ":" collides with
    // path.delimiter on POSIX test runners and would corrupt the PATH split.
    const binA = '/tools/binA';
    const binB = '/tools/binB';
    const candidate = path.join(binB, 'Docker Desktop.exe');

    const result = await detectLaunchMethod('win32', {
      env: { PATH: [binA, binB].join(path.delimiter) },
      existsSync: existsAmong(candidate),
    });

    expect(result.command).toBe(candidate);
    expect(result.kind).toBe('windows-desktop');
  });

  test('returns null when no candidate exists', async () => {
    const result = await detectLaunchMethod('win32', {
      env: {
        ProgramFiles: PF,
        'ProgramFiles(x86)': PF_X86,
        ProgramW6432: PF_6432,
        LOCALAPPDATA,
        PATH: ['/tools/binA', '/tools/binB'].join(path.delimiter),
      },
      existsSync: existsNowhere,
    });

    expect(result).toBeNull();
  });
});

describe('detectLaunchMethod — macOS (darwin)', () => {
  test('returns macos-desktop with `open -a Docker` when the app exists', async () => {
    const result = await detectLaunchMethod('darwin', {
      existsSync: existsAmong('/Applications/Docker.app'),
    });

    expect(result).toEqual({
      kind: 'macos-desktop',
      command: 'open',
      args: ['-a', 'Docker'],
      needsPrivileges: false,
      display: 'open -a Docker',
      typicalWaitMs: 30000,
    });
  });

  test('returns null when the app is missing', async () => {
    const result = await detectLaunchMethod('darwin', {
      existsSync: existsNowhere,
    });

    expect(result).toBeNull();
  });
});

describe('detectLaunchMethod — Linux', () => {
  test('returns linux-user when the rootless service is enabled', async () => {
    const result = await detectLaunchMethod('linux', {
      execFile: execResolves,
      existsSync: existsNowhere,
    });

    expect(result).toEqual({
      kind: 'linux-user',
      command: 'systemctl',
      args: ['--user', 'start', 'docker'],
      needsPrivileges: false,
      display: 'systemctl --user start docker',
      typicalWaitMs: 30000,
    });
  });

  test('returns linux-system when user service is absent and the unit exists', async () => {
    const result = await detectLaunchMethod('linux', {
      execFile: execRejects,
      existsSync: existsAmong('/usr/lib/systemd/system/docker.service'),
    });

    expect(result).toEqual({
      kind: 'linux-system',
      command: 'sudo',
      args: ['systemctl', 'start', 'docker'],
      needsPrivileges: true,
      display: 'sudo systemctl start docker',
      typicalWaitMs: 30000,
    });
  });

  test('returns linux-system via /etc/init.d/docker as an alternative', async () => {
    const result = await detectLaunchMethod('linux', {
      execFile: execRejects,
      existsSync: existsAmong('/etc/init.d/docker'),
    });

    expect(result.kind).toBe('linux-system');
  });

  test('returns null when user service is absent and no service file exists', async () => {
    const result = await detectLaunchMethod('linux', {
      execFile: execRejects,
      existsSync: existsNowhere,
    });

    expect(result).toBeNull();
  });
});

describe('detectLaunchMethod — privilege flags', () => {
  test('needsPrivileges is false for desktop/user, true only for linux-system', async () => {
    const windows = await detectLaunchMethod('win32', {
      env: { ProgramFiles: PF },
      existsSync: existsAmong(winCandidate(PF)),
    });
    const macos = await detectLaunchMethod('darwin', {
      existsSync: existsAmong('/Applications/Docker.app'),
    });
    const linuxUser = await detectLaunchMethod('linux', {
      execFile: execResolves,
      existsSync: existsNowhere,
    });
    const linuxSystem = await detectLaunchMethod('linux', {
      execFile: execRejects,
      existsSync: existsAmong('/usr/lib/systemd/system/docker.service'),
    });

    expect(windows.needsPrivileges).toBe(false);
    expect(macos.needsPrivileges).toBe(false);
    expect(linuxUser.needsPrivileges).toBe(false);
    expect(linuxSystem.needsPrivileges).toBe(true);
  });
});

describe('detectLaunchMethod — unknown platform', () => {
  test('returns null for a non-win32/darwin/linux platform', async () => {
    await expect(detectLaunchMethod('freebsd')).resolves.toBeNull();
    await expect(detectLaunchMethod('aix', {})).resolves.toBeNull();
  });
});
