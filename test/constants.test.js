/**
 * @jest-environment node
 */
import {
  REFRESH_INTERVALS,
  WIZARD_STEP_COUNT,
  MESSAGE_TIMEOUTS,
  EXIT_DELAY,
  TIMEOUTS,
  CONNECTION_RETRY_INTERVAL,
  DB_IMAGES,
  IMAGE_PROFILES,
} from '../src/helpers/constants.js';

describe('constants — scalar and grouped exports', () => {
  test('REFRESH_INTERVALS', () => {
    expect(REFRESH_INTERVALS).toEqual({ CONTAINER_LIST: 3000, CONTAINER_STATS: 1500 });
  });

  test('WIZARD_STEP_COUNT = 5 (image, name, ports, env, review)', () => {
    expect(WIZARD_STEP_COUNT).toBe(5);
  });

  test('MESSAGE_TIMEOUTS', () => {
    expect(MESSAGE_TIMEOUTS).toEqual({ SHORT: 2000, DEFAULT: 3000 });
  });

  test('EXIT_DELAY = 500', () => expect(EXIT_DELAY).toBe(500));

  test('TIMEOUTS', () => {
    expect(TIMEOUTS).toEqual({ CONTAINER_OP: 30000, PULL_IMAGE: 300000 });
  });

  test('CONNECTION_RETRY_INTERVAL = 5000', () => {
    expect(CONNECTION_RETRY_INTERVAL).toBe(5000);
  });

  test('DB_IMAGES contains the six supported databases', () => {
    expect(DB_IMAGES).toEqual(
      expect.arrayContaining(['mysql', 'mariadb', 'postgres', 'mongo', 'mssql', 'redis'])
    );
  });

  test('every DB_IMAGES image has a profile in IMAGE_PROFILES', () => {
    for (const img of DB_IMAGES) expect(IMAGE_PROFILES[img]).toBeDefined();
  });

  test('every profile key is lowercase', () => {
    for (const name of Object.keys(IMAGE_PROFILES)) {
      expect(name).toBe(name.toLowerCase());
    }
  });

  test('every requiredEnv also appears in suggestedEnv', () => {
    for (const [, p] of Object.entries(IMAGE_PROFILES)) {
      const keys = p.suggestedEnv.map((s) => s.split('=')[0]);
      for (const req of p.requiredEnv) {
        expect(keys).toContain(req);
      }
    }
  });
});

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

  test('every entry has defaultTag as a non-empty string', () => {
    for (const [key, profile] of Object.entries(IMAGE_PROFILES)) {
      expect(typeof profile.defaultTag).toBe('string');
      expect(profile.defaultTag.length).toBeGreaterThan(0);
    }
  });
});
