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

// Level filtering: the level resolves ONCE at import time (logger.js), so each
// case reassigns process.env.CDD_LOG_LEVEL and reloads the module.
describe('logger — level filtering', () => {
  const originalLevel = process.env.CDD_LOG_LEVEL;

  afterEach(() => {
    if (originalLevel === undefined) {
      delete process.env.CDD_LOG_LEVEL;
    } else {
      process.env.CDD_LOG_LEVEL = originalLevel;
    }
    jest.resetModules();
  });

  async function loadLoggerWithLevel(level) {
    process.env.CDD_LOG_LEVEL = level;
    jest.resetModules();
    const { logger } = await import('../src/helpers/logger.js');
    const entries = [];
    const unsubscribe = logger.subscribe((e) => entries.push(e));
    return { logger, entries, unsubscribe };
  }

  test('info and debug emit entries with their level', async () => {
    const { logger, entries } = await loadLoggerWithLevel('debug');
    logger.info('hola');
    logger.debug('detalle');
    expect(entries.map((e) => e.level)).toEqual(['info', 'debug']);
  });

  test('with level warn, info and debug do not pass the filter', async () => {
    const { logger, entries } = await loadLoggerWithLevel('warn');
    logger.info('no');
    logger.debug('no');
    logger.warn('sí');
    logger.error('sí');
    expect(entries.map((e) => e.level)).toEqual(['warn', 'error']);
  });

  test('unknown level falls back to "info"', async () => {
    const { logger, entries } = await loadLoggerWithLevel('inventado');
    logger.info('sí');
    logger.debug('no');
    expect(entries).toHaveLength(1);
  });

  test('several listeners receive the same entry', async () => {
    const { logger } = await loadLoggerWithLevel('info');
    const a = jest.fn();
    const b = jest.fn();
    logger.subscribe(a);
    logger.subscribe(b);
    logger.warn('x');
    expect(a.mock.calls[0][0]).toBe(b.mock.calls[0][0]);
  });

  test('a throwing listener does not block the others', async () => {
    const { logger } = await loadLoggerWithLevel('info');
    const good = jest.fn();
    logger.subscribe(() => {
      throw new Error('boom');
    });
    logger.subscribe(good);
    expect(() => logger.error('x')).not.toThrow();
    expect(good).toHaveBeenCalled();
  });

  test('subscribe with a non-function returns a no-op unsubscribe', async () => {
    const { logger } = await loadLoggerWithLevel('info');
    const off = logger.subscribe('not a function');
    expect(typeof off).toBe('function');
    expect(() => off()).not.toThrow();
  });

  test('unsubscribe stops receiving entries', async () => {
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { logger, entries, unsubscribe } = await loadLoggerWithLevel('info');
    logger.warn('uno');
    unsubscribe();
    logger.warn('dos'); // no listeners left → console fallback, keep it quiet
    expect(entries).toHaveLength(1);
    spy.mockRestore();
  });

  test('with listeners does not write to console', async () => {
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { logger } = await loadLoggerWithLevel('info');
    logger.warn('x');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  test('entry includes ISO timestamp and formatted message', async () => {
    const { logger, entries } = await loadLoggerWithLevel('info');
    logger.error('fallo', { a: 1 });
    expect(entries[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(entries[0].formatted).toContain('[ERROR] fallo');
    expect(entries[0].args).toEqual([{ a: 1 }]);
  });
});
