import { safeCall } from '../src/helpers/safeCall.js';

describe('safeCall', () => {
  test('calls function and returns value', () => {
    function fn(a, b) {
      fn.called = true;
      fn.args = [a, b];
      return a + b;
    }
    const res = safeCall(fn, 2, 3);
    expect(fn.called).toBe(true);
    expect(fn.args).toEqual([2, 3]);
    expect(res).toBe(5);
  });

  test('returns undefined when fn is not a function', () => {
    const res = safeCall(undefined, 1, 2);
    expect(res).toBeUndefined();
  });

  test('catches errors thrown by function and does not rethrow', () => {
    const bad = () => { throw new Error('boom'); };
    expect(() => safeCall(bad)).not.toThrow();
  });
});
