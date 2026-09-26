/**
 * @jest-environment node
 */
import { jest } from '@jest/globals';

afterEach(() => {
  jest.resetModules();
  jest.useRealTimers();
});

/** Load the module with child_process.spawn mocked. */
async function loadWithSpawnMock() {
  const spawn = jest.fn();
  await jest.unstable_mockModule('child_process', () => ({
    spawn,
    default: { spawn },
  }));
  const mod = await import('../src/helpers/exitWithMessage.js');
  return { ...mod, spawn };
}

describe('exitWithMessage', () => {
  test('sets the given message and color', async () => {
    jest.useFakeTimers();
    const { exitWithMessage } = await loadWithSpawnMock();
    const setMessage = jest.fn();
    const setMessageColor = jest.fn();

    exitWithMessage({ setMessage, setMessageColor, message: 'Bye', color: 'red' });

    expect(setMessage).toHaveBeenCalledWith('Bye');
    expect(setMessageColor).toHaveBeenCalledWith('red');
  });

  test('uses "Exiting..." and "yellow" by default', async () => {
    jest.useFakeTimers();
    const { exitWithMessage } = await loadWithSpawnMock();
    const setMessage = jest.fn();
    const setMessageColor = jest.fn();

    exitWithMessage({ setMessage, setMessageColor });

    expect(setMessage).toHaveBeenCalledWith('Exiting...');
    expect(setMessageColor).toHaveBeenCalledWith('yellow');
  });

  test('uses EXIT_DELAY by default for the timer', async () => {
    jest.useFakeTimers();
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    const { exitWithMessage } = await loadWithSpawnMock();
    const { EXIT_DELAY } = await import('../src/helpers/constants.js');

    exitWithMessage({ setMessage: jest.fn(), setMessageColor: jest.fn() });

    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), EXIT_DELAY);
    setTimeoutSpy.mockRestore();
  });

  test('after the delay: clears message, clears terminal, exits', async () => {
    jest.useFakeTimers();
    const { exitWithMessage, spawn } = await loadWithSpawnMock();
    const setMessage = jest.fn();
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});

    exitWithMessage({ setMessage, setMessageColor: jest.fn(), delay: 10 });
    jest.advanceTimersByTime(10);

    expect(setMessage).toHaveBeenLastCalledWith('');
    expect(spawn).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalled();
    exitSpy.mockRestore();
  });

  test('on win32 clears with "cmd /c cls"; elsewhere with "clear"', async () => {
    jest.useFakeTimers();
    const { exitWithMessage, spawn } = await loadWithSpawnMock();
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    const original = process.platform;

    Object.defineProperty(process, 'platform', { value: 'win32' });
    exitWithMessage({ setMessage: jest.fn(), setMessageColor: jest.fn(), delay: 1 });
    jest.advanceTimersByTime(1);
    expect(spawn).toHaveBeenCalledWith('cmd', ['/c', 'cls'], { stdio: 'inherit' });

    spawn.mockClear();
    Object.defineProperty(process, 'platform', { value: 'linux' });
    exitWithMessage({ setMessage: jest.fn(), setMessageColor: jest.fn(), delay: 1 });
    jest.advanceTimersByTime(1);
    expect(spawn).toHaveBeenCalledWith('clear', [], { stdio: 'inherit' });

    Object.defineProperty(process, 'platform', { value: original });
    exitSpy.mockRestore();
  });
});
