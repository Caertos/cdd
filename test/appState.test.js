/**
 * @jest-environment node
 */
import { jest } from '@jest/globals';

// Module is a singleton: re-import in each test for a clean state.
afterEach(() => jest.resetModules());

describe('appState', () => {
  test('getInkApp returns null before any set', async () => {
    const { getInkApp } = await import('../src/helpers/appState.js');
    expect(getInkApp()).toBeNull();
  });

  test('setInkApp stores the reference and getInkApp returns it', async () => {
    const { setInkApp, getInkApp } = await import('../src/helpers/appState.js');
    const app = { unmount: () => {} };
    setInkApp(app);
    expect(getInkApp()).toBe(app);
  });

  test('a second setInkApp overwrites the first', async () => {
    const { setInkApp, getInkApp } = await import('../src/helpers/appState.js');
    setInkApp({ id: 1 });
    setInkApp({ id: 2 });
    expect(getInkApp()).toEqual({ id: 2 });
  });

  test('setInkApp(null) leaves it null again', async () => {
    const { setInkApp, getInkApp } = await import('../src/helpers/appState.js');
    setInkApp({ id: 1 });
    setInkApp(null);
    expect(getInkApp()).toBeNull();
  });
});
