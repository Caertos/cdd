/**
 * Tests for src/helpers/logger.js
 * Verifies that console output is suppressed when Ink listeners are active.
 */
import { jest } from '@jest/globals';

const { logger } = await import('../src/helpers/logger.js');

describe('logger — console output suppression', () => {
  let consoleSpy;
  let warnSpy;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    warnSpy.mockRestore();
  });

  test('when NO listeners are registered, logger.error calls console.error (fallback)', () => {
    logger.error('test error no listener');
    expect(consoleSpy).toHaveBeenCalledTimes(1);
  });

  test('when a listener IS registered, logger.error does NOT call console.error', () => {
    const unsubscribe = logger.subscribe(() => {});
    logger.error('test error with listener');
    expect(consoleSpy).not.toHaveBeenCalled();
    unsubscribe();
  });

  test('when a listener IS registered, logger.warn does NOT call console.warn', () => {
    const unsubscribe = logger.subscribe(() => {});
    logger.warn('test warn with listener');
    expect(warnSpy).not.toHaveBeenCalled();
    unsubscribe();
  });

  test('after unsubscribing last listener, logger.error resumes calling console.error', () => {
    const unsubscribe = logger.subscribe(() => {});
    unsubscribe();
    logger.error('after unsubscribe');
    expect(consoleSpy).toHaveBeenCalledTimes(1);
  });

  test('listener is invoked with the log entry even when console output is suppressed', () => {
    const received = [];
    const unsubscribe = logger.subscribe((entry) => received.push(entry));
    logger.error('entry delivered', 'extra-arg');
    expect(received).toHaveLength(1);
    expect(received[0].level).toBe('error');
    expect(received[0].message).toBe('entry delivered');
    unsubscribe();
  });
});
