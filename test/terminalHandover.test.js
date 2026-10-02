/**
 * @jest-environment node
 */
import { jest } from '@jest/globals';

// Module state is a singleton: re-import in each test for a clean slot.
afterEach(() => jest.resetModules());

async function loadHandover() {
  const appState = await import('../src/helpers/appState.js');
  const { withTerminalHandover } = await import(
    '../src/helpers/terminalHandover.js'
  );
  return { ...appState, withTerminalHandover };
}

describe('withTerminalHandover', () => {
  test('runs fn and returns its value when no suspendTerminal is registered', async () => {
    const { withTerminalHandover } = await loadHandover();
    const result = await withTerminalHandover(async () => 'done');
    expect(result).toBe('done');
  });

  test('propagates errors from fn when no suspendTerminal is registered', async () => {
    const { withTerminalHandover } = await loadHandover();
    await expect(
      withTerminalHandover(async () => {
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');
  });

  test('suspends the terminal around fn and resumes afterwards', async () => {
    const { setSuspendTerminal, withTerminalHandover } = await loadHandover();
    const resume = jest.fn(async () => {});
    setSuspendTerminal(async () => ({ resume }));

    const order = [];
    const result = await withTerminalHandover(async () => {
      order.push('fn');
      expect(resume).not.toHaveBeenCalled();
      return 42;
    });

    expect(result).toBe(42);
    expect(order).toEqual(['fn']);
    expect(resume).toHaveBeenCalledTimes(1);
  });

  test('resumes the terminal even when fn throws', async () => {
    const { setSuspendTerminal, withTerminalHandover } = await loadHandover();
    const resume = jest.fn(async () => {});
    setSuspendTerminal(async () => ({ resume }));

    await expect(
      withTerminalHandover(async () => {
        throw new Error('child failed');
      })
    ).rejects.toThrow('child failed');
    expect(resume).toHaveBeenCalledTimes(1);
  });

  test('setSuspendTerminal(null) releases the slot again', async () => {
    const { setSuspendTerminal, getSuspendTerminal, withTerminalHandover } =
      await loadHandover();
    const resume = jest.fn(async () => {});
    setSuspendTerminal(async () => ({ resume }));
    setSuspendTerminal(null);

    expect(getSuspendTerminal()).toBeNull();
    const result = await withTerminalHandover(async () => 'no-suspend');
    expect(result).toBe('no-suspend');
    expect(resume).not.toHaveBeenCalled();
  });
});
