/**
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals';
import { renderHook, act } from '@testing-library/react';
import { useDockerLauncher } from '../src/hooks/useDockerLauncher.js';

const METHOD = {
  kind: 'linux-system',
  command: 'sudo',
  args: ['systemctl', 'start', 'docker'],
  needsPrivileges: true,
  display: 'sudo systemctl start docker',
  typicalWaitMs: 30000,
};

function makeFakes() {
  return {
    detectLaunchMethod: jest.fn(),
    launchDocker: jest.fn(),
    launchDockerElevated: jest.fn(),
    waitForDocker: jest.fn(),
  };
}

/** Render the hook with injected fakes and flush the mount detection. */
async function renderLauncher(fakes) {
  const rendered = renderHook(() => useDockerLauncher(fakes));
  await act(async () => {});
  return rendered;
}

describe('useDockerLauncher', () => {
  test('canLaunch is true once detection resolves a method', async () => {
    const fakes = makeFakes();
    fakes.detectLaunchMethod.mockResolvedValue(METHOD);

    const { result } = await renderLauncher(fakes);

    expect(result.current.method).toEqual(METHOD);
    expect(result.current.canLaunch).toBe(true);
    expect(result.current.status).toBe('idle');
  });

  test('canLaunch is false when detection resolves null', async () => {
    const fakes = makeFakes();
    fakes.detectLaunchMethod.mockResolvedValue(null);

    const { result } = await renderLauncher(fakes);

    expect(result.current.method).toBeNull();
    expect(result.current.canLaunch).toBe(false);
  });

  test('confirm launches (privileged) and reaches ready on success', async () => {
    const fakes = makeFakes();
    fakes.detectLaunchMethod.mockResolvedValue(METHOD);
    fakes.launchDockerElevated.mockResolvedValue({ started: true, exitCode: 0 });
    fakes.waitForDocker.mockResolvedValue({ ready: true, elapsedMs: 42 });

    const { result } = await renderLauncher(fakes);

    act(() => result.current.start());
    expect(result.current.status).toBe('confirming');

    await act(async () => {
      await result.current.confirm();
    });

    expect(fakes.launchDockerElevated).toHaveBeenCalledWith(METHOD);
    expect(fakes.launchDocker).not.toHaveBeenCalled();
    expect(fakes.waitForDocker).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('ready');
  });

  test('confirm uses launchDocker when no privileges are needed', async () => {
    const fakes = makeFakes();
    const macMethod = { ...METHOD, needsPrivileges: false };
    fakes.detectLaunchMethod.mockResolvedValue(macMethod);
    fakes.launchDocker.mockResolvedValue({ started: true });
    fakes.waitForDocker.mockResolvedValue({ ready: true });

    const { result } = await renderLauncher(fakes);

    act(() => result.current.start());
    await act(async () => {
      await result.current.confirm();
    });

    expect(fakes.launchDocker).toHaveBeenCalledWith(macMethod);
    expect(fakes.launchDockerElevated).not.toHaveBeenCalled();
    expect(result.current.status).toBe('ready');
  });

  test('failed launch sets failed and surfaces the error', async () => {
    const fakes = makeFakes();
    fakes.detectLaunchMethod.mockResolvedValue(METHOD);
    fakes.launchDockerElevated.mockResolvedValue({
      started: false,
      exitCode: 1,
    });
    fakes.waitForDocker.mockResolvedValue({ ready: false });

    const { result } = await renderLauncher(fakes);

    act(() => result.current.start());
    await act(async () => {
      await result.current.confirm();
    });

    expect(result.current.status).toBe('failed');
    expect(result.current.error).toBe('Failed to start Docker.');
    expect(fakes.waitForDocker).not.toHaveBeenCalled();
  });

  test('failed launch surfaces the real error when present', async () => {
    const fakes = makeFakes();
    fakes.detectLaunchMethod.mockResolvedValue(METHOD);
    fakes.launchDockerElevated.mockResolvedValue({
      started: false,
      exitCode: null,
      error: 'ENOENT: sudo not found',
    });
    fakes.waitForDocker.mockResolvedValue({ ready: false });

    const { result } = await renderLauncher(fakes);

    act(() => result.current.start());
    await act(async () => {
      await result.current.confirm();
    });

    expect(result.current.status).toBe('failed');
    expect(result.current.error).toBe('ENOENT: sudo not found');
  });

  test('wait timeout sets timeout', async () => {
    const fakes = makeFakes();
    fakes.detectLaunchMethod.mockResolvedValue(METHOD);
    fakes.launchDockerElevated.mockResolvedValue({ started: true, exitCode: 0 });
    fakes.waitForDocker.mockResolvedValue({
      ready: false,
      reason: 'timeout',
      elapsedMs: 90000,
    });

    const { result } = await renderLauncher(fakes);

    act(() => result.current.start());
    await act(async () => {
      await result.current.confirm();
    });

    expect(result.current.status).toBe('timeout');
  });

  test('cancelWait aborts the wait and returns to idle', async () => {
    const fakes = makeFakes();
    fakes.detectLaunchMethod.mockResolvedValue(METHOD);
    fakes.launchDockerElevated.mockResolvedValue({ started: true, exitCode: 0 });
    fakes.waitForDocker.mockImplementation(
      ({ signal }) =>
        new Promise((resolve) => {
          if (signal.aborted) {
            resolve({ ready: false, elapsedMs: 0, reason: 'aborted' });
            return;
          }
          signal.addEventListener(
            'abort',
            () => resolve({ ready: false, elapsedMs: 0, reason: 'aborted' }),
            { once: true }
          );
        })
    );

    const { result } = await renderLauncher(fakes);

    act(() => result.current.start());

    let confirmPromise;
    act(() => {
      confirmPromise = result.current.confirm();
    });

    // Flush the launch promise so the hook enters `waiting`.
    await act(async () => {});
    expect(result.current.status).toBe('waiting');

    act(() => result.current.cancelWait());
    await act(async () => {
      await confirmPromise;
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.elapsedMs).toBe(0);
  });

  test('keepWaiting re-enters waiting from timeout', async () => {
    const fakes = makeFakes();
    fakes.detectLaunchMethod.mockResolvedValue(METHOD);
    fakes.launchDockerElevated.mockResolvedValue({ started: true, exitCode: 0 });
    fakes.waitForDocker
      .mockResolvedValueOnce({
        ready: false,
        reason: 'timeout',
        elapsedMs: 90000,
      })
      .mockResolvedValueOnce({ ready: true, elapsedMs: 1000 });

    const { result } = await renderLauncher(fakes);

    act(() => result.current.start());
    await act(async () => {
      await result.current.confirm();
    });
    expect(result.current.status).toBe('timeout');

    await act(async () => {
      await result.current.keepWaiting();
    });
    expect(result.current.status).toBe('ready');
  });

  test('reset returns to idle from confirming', async () => {
    const fakes = makeFakes();
    fakes.detectLaunchMethod.mockResolvedValue(METHOD);

    const { result } = await renderLauncher(fakes);

    act(() => result.current.start());
    expect(result.current.status).toBe('confirming');

    act(() => result.current.reset());
    expect(result.current.status).toBe('idle');
  });

  test('unmount aborts any in-flight wait', async () => {
    const fakes = makeFakes();
    fakes.detectLaunchMethod.mockResolvedValue(METHOD);
    fakes.launchDockerElevated.mockResolvedValue({ started: true, exitCode: 0 });
    let capturedSignal = null;
    fakes.waitForDocker.mockImplementation(({ signal }) => {
      capturedSignal = signal;
      return new Promise(() => {});
    });

    const { result, unmount } = renderHook(() => useDockerLauncher(fakes));
    await act(async () => {});

    act(() => result.current.start());
    let confirmPromise;
    act(() => {
      confirmPromise = result.current.confirm();
    });
    await act(async () => {});
    expect(result.current.status).toBe('waiting');
    expect(capturedSignal).not.toBeNull();

    unmount();
    expect(capturedSignal.aborted).toBe(true);
    void confirmPromise;
  });
});
