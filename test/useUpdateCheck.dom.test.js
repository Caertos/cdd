/**
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals';
import { renderHook, act } from '@testing-library/react';
import { useUpdateCheck } from '../src/hooks/useUpdateCheck.js';

const NPM = {
  kind: 'npm',
  command: 'npm',
  args: ['install', '-g', 'cdd-cli@latest'],
  display: 'npm install -g cdd-cli@latest',
};
const NPX = { kind: 'npx', command: null, args: [], display: 'npx cdd-cli@latest' };

function makeFakes({ latest = '4.12.0', available = true, method = NPM } = {}) {
  return {
    currentVersion: '4.11.1',
    checkForUpdate: jest.fn(async () => ({
      current: '4.11.1',
      latest,
      updateAvailable: available,
    })),
    detectInstallMethod: jest.fn(() => method),
    installUpdate: jest.fn(async () => ({ ok: true, exitCode: 0 })),
  };
}

async function renderUpdater(fakes) {
  const rendered = renderHook(() => useUpdateCheck(fakes));
  await act(async () => {});
  return rendered;
}

describe('useUpdateCheck', () => {
  test('newer version → available with latest and method', async () => {
    const { result } = await renderUpdater(makeFakes());
    expect(result.current.status).toBe('available');
    expect(result.current.latest).toBe('4.12.0');
    expect(result.current.canSelfUpdate).toBe(true);
  });

  test('up to date → stays idle', async () => {
    const { result } = await renderUpdater(makeFakes({ available: false }));
    expect(result.current.status).toBe('idle');
  });

  test('check skipped (null) → stays idle', async () => {
    const fakes = makeFakes();
    fakes.checkForUpdate.mockResolvedValue(null);
    const { result } = await renderUpdater(fakes);
    expect(result.current.status).toBe('idle');
  });

  test('confirm → updating → updated', async () => {
    const fakes = makeFakes();
    const { result } = await renderUpdater(fakes);
    act(() => result.current.openConfirm());
    expect(result.current.status).toBe('confirming');
    await act(async () => {
      await result.current.confirm();
    });
    expect(fakes.installUpdate).toHaveBeenCalledWith(NPM);
    expect(result.current.status).toBe('updated');
  });

  test('install failure → failed with exit code; acknowledge → available', async () => {
    const fakes = makeFakes();
    fakes.installUpdate.mockResolvedValue({ ok: false, exitCode: 243 });
    const { result } = await renderUpdater(fakes);
    act(() => result.current.openConfirm());
    await act(async () => {
      await result.current.confirm();
    });
    expect(result.current.status).toBe('failed');
    expect(result.current.exitCode).toBe(243);
    act(() => result.current.acknowledge());
    expect(result.current.status).toBe('available');
  });

  test('cancel returns to available without installing', async () => {
    const fakes = makeFakes();
    const { result } = await renderUpdater(fakes);
    act(() => result.current.openConfirm());
    act(() => result.current.cancel());
    expect(result.current.status).toBe('available');
    expect(fakes.installUpdate).not.toHaveBeenCalled();
  });

  test('npx: confirm never installs', async () => {
    const fakes = makeFakes({ method: NPX });
    const { result } = await renderUpdater(fakes);
    expect(result.current.canSelfUpdate).toBe(false);
    act(() => result.current.openConfirm());
    await act(async () => {
      await result.current.confirm();
    });
    expect(fakes.installUpdate).not.toHaveBeenCalled();
  });

  test('a result arriving after unmount is ignored', async () => {
    let resolve;
    const fakes = makeFakes();
    fakes.checkForUpdate.mockReturnValue(new Promise((r) => (resolve = r)));
    const { unmount } = renderHook(() => useUpdateCheck(fakes));
    unmount();
    await act(async () =>
      resolve({ current: '4.11.1', latest: '4.12.0', updateAvailable: true })
    );
    expect(fakes.detectInstallMethod).not.toHaveBeenCalled();
  });
});
