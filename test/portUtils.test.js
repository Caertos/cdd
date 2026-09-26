/**
 * @jest-environment node
 */
import { findAvailablePort } from '../src/helpers/portUtils.js';

describe('findAvailablePort — numeric base', () => {
  test('free base port is returned as-is', () => {
    const used = new Set();
    expect(findAvailablePort('5432', used)).toBe('5432');
  });

  test('mutates the Set with the chosen port', () => {
    const used = new Set();
    findAvailablePort('5432', used);
    expect(used.has('5432')).toBe(true);
  });

  test('occupied base increments until a free slot', () => {
    const used = new Set(['80', '81', '82']);
    expect(findAvailablePort('80', used)).toBe('83');
    expect(used.has('83')).toBe(true);
  });

  test('two consecutive calls with the same base do not collide', () => {
    const used = new Set();
    expect(findAvailablePort('3000', used)).toBe('3000');
    expect(findAvailablePort('3000', used)).toBe('3001');
  });

  test('base "0" is numeric and returned when free', () => {
    expect(findAvailablePort('0', new Set())).toBe('0');
  });

  test('"80abc" parses as 80 (permissive parseInt)', () => {
    expect(findAvailablePort('80abc', new Set())).toBe('80');
  });
});

describe('findAvailablePort — non-numeric base', () => {
  test('free → returned as-is', () => {
    expect(findAvailablePort('http', new Set())).toBe('http');
  });

  test('occupied → suffix -1, -2, …', () => {
    const used = new Set(['http']);
    expect(findAvailablePort('http', used)).toBe('http-1');
    expect(findAvailablePort('http', used)).toBe('http-2');
  });
});

describe('findAvailablePort — known limits', () => {
  // Documents current behaviour: does NOT clamp to 65535.
  // If clamping is decided, change this test together with the code.
  test('from occupied 65535 returns 65536, outside valid TCP range', () => {
    const used = new Set(['65535']);
    expect(findAvailablePort('65535', used)).toBe('65536');
  });
});
