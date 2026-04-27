/**
 * @jest-environment node
 */
import { IMAGE_PROFILES } from '../src/helpers/constants.js';

describe('IMAGE_PROFILES', () => {
  test('has ~20 entries', () => {
    const count = Object.keys(IMAGE_PROFILES).length;
    expect(count).toBeGreaterThanOrEqual(20);
  });

  test('every entry has requiredEnv (array), defaultPort (string), and suggestedEnv (array)', () => {
    for (const [key, profile] of Object.entries(IMAGE_PROFILES)) {
      expect(Array.isArray(profile.requiredEnv)).toBe(true);
      expect(typeof profile.defaultPort).toBe('string');
      expect(Array.isArray(profile.suggestedEnv)).toBe(true);
    }
  });

  test('postgres has POSTGRES_PASSWORD in requiredEnv and suggestedEnv hints', () => {
    expect(IMAGE_PROFILES.postgres.requiredEnv).toContain('POSTGRES_PASSWORD');
    expect(IMAGE_PROFILES.postgres.suggestedEnv.length).toBeGreaterThan(0);
  });

  test('nginx has empty requiredEnv, defaultPort 80, and empty suggestedEnv', () => {
    expect(IMAGE_PROFILES.nginx.requiredEnv).toEqual([]);
    expect(IMAGE_PROFILES.nginx.defaultPort).toBe('80');
    expect(IMAGE_PROFILES.nginx.suggestedEnv).toEqual([]);
  });

  test('node has suggestedEnv with NODE_ENV hint', () => {
    expect(IMAGE_PROFILES.node.suggestedEnv).toContain('NODE_ENV=production');
  });
});
