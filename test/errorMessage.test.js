/**
 * @jest-environment node
 */
import { withContext } from '../src/helpers/errorMessage.js';

describe('withContext', () => {
  test('prefixes a bare message', () => {
    expect(withContext('Error creating container', 'pull access denied')).toBe(
      'Error creating container: pull access denied'
    );
  });

  test('does not double a prefix the service already added', () => {
    // The bug: "Error creating container: Error creating container: …".
    expect(
      withContext(
        'Error creating container',
        'Error creating container: (HTTP code 409) conflict'
      )
    ).toBe('Error creating container: (HTTP code 409) conflict');
  });

  test('a message that merely starts with the same word is still prefixed', () => {
    // Only an exact prefix match counts, not a shared first word.
    expect(withContext('Error creating container', 'Error creating cont')).toBe(
      'Error creating container: Error creating cont'
    );
  });

  test('handles the erase path, which doubled the same way', () => {
    expect(
      withContext(
        'Failed to erase container',
        'Error removing container: no such container'
      )
    ).toBe('Failed to erase container: Error removing container: no such container');
  });

  test('an empty message yields the prefix alone', () => {
    expect(withContext('Error creating container', '')).toBe(
      'Error creating container'
    );
  });

  test('a missing message does not print "null"', () => {
    expect(withContext('Error creating container', null)).toBe(
      'Error creating container'
    );
    expect(withContext('Error creating container', undefined)).not.toContain(
      'undefined'
    );
  });

  test('it never leaves the user without the reason', () => {
    const daemon = '(HTTP code 409) conflict';
    for (const prefix of [
      'Error creating container',
      'Failed to erase container',
      'Failed to stop container',
    ]) {
      const out = withContext(prefix, daemon);
      expect(out).toContain(daemon);
      expect(out.split(prefix).length - 1).toBeLessThanOrEqual(1);
    }
  });
});