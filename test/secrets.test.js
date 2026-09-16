/**
 * @jest-environment node
 */
import {
  isSecretKey,
  maskEnvPairs,
  secretRanges,
  generateSecret,
  redactForLog,
  findWeakSecrets,
} from '../src/helpers/secrets.js';

describe('isSecretKey', () => {
  test('positive: PASSWORD', () => {
    expect(isSecretKey('POSTGRES_PASSWORD')).toBe(true);
  });

  test('positive: SECRET', () => {
    expect(isSecretKey('JWT_SECRET')).toBe(true);
  });

  test('positive: TOKEN', () => {
    expect(isSecretKey('API_TOKEN')).toBe(true);
  });

  test('positive: API_KEY', () => {
    expect(isSecretKey('AWS_API_KEY')).toBe(true);
  });

  test('positive: ACCESS_KEY', () => {
    expect(isSecretKey('AWS_ACCESS_KEY_ID')).toBe(true);
  });

  test('positive: PRIVATE_KEY', () => {
    expect(isSecretKey('SSH_PRIVATE_KEY')).toBe(true);
  });

  test('positive: CREDENTIAL', () => {
    expect(isSecretKey('DB_CREDENTIAL')).toBe(true);
  });

  test('positive: AUTH', () => {
    expect(isSecretKey('AUTH_TOKEN')).toBe(true);
  });

  test('positive: case insensitive', () => {
    expect(isSecretKey('postgres_password')).toBe(true);
    expect(isSecretKey('Api_Key')).toBe(true);
  });

  test('negative: POSTGRES_DB', () => {
    expect(isSecretKey('POSTGRES_DB')).toBe(false);
  });

  test('negative: NODE_ENV', () => {
    expect(isSecretKey('NODE_ENV')).toBe(false);
  });

  test('negative: PORT', () => {
    expect(isSecretKey('PORT')).toBe(false);
  });

  test('negative: empty string', () => {
    expect(isSecretKey('')).toBe(false);
  });

  test('negative: null/undefined', () => {
    expect(isSecretKey(null)).toBe(false);
    expect(isSecretKey(undefined)).toBe(false);
  });
});

describe('maskEnvPairs', () => {
  test('masks secret values', () => {
    const result = maskEnvPairs('POSTGRES_PASSWORD=secret');
    expect(result).toBe('POSTGRES_PASSWORD=••••••');
  });

  test('does not mask non-secret values', () => {
    const result = maskEnvPairs('POSTGRES_DB=app');
    expect(result).toBe('POSTGRES_DB=app');
  });

  test('masks only secrets in mixed input', () => {
    const result = maskEnvPairs('POSTGRES_PASSWORD=secret,POSTGRES_DB=app');
    expect(result).toBe('POSTGRES_PASSWORD=••••••,POSTGRES_DB=app');
  });

  test('reveal option returns original', () => {
    const input = 'POSTGRES_PASSWORD=secret';
    const result = maskEnvPairs(input, { reveal: true });
    expect(result).toBe(input);
  });

  test('empty input returns empty', () => {
    expect(maskEnvPairs('')).toBe('');
    expect(maskEnvPairs(null)).toBe(null);
  });

  test('pair without = is unchanged', () => {
    expect(maskEnvPairs('INVALID_PAIR')).toBe('INVALID_PAIR');
  });

  test('custom maskChar', () => {
    const result = maskEnvPairs('SECRET_KEY=abc', { maskChar: '*' });
    expect(result).toBe('SECRET_KEY=******');
  });
});

describe('secretRanges', () => {
  test('single secret var', () => {
    const ranges = secretRanges('POSTGRES_PASSWORD=secret');
    // POSTGRES_PASSWORD is 16 chars, = is at index 16, secret starts at 17
    // Wait, let me recalculate: POSTGRES_PASSWORD has 16 chars (indices 0-15)
    // Actually: P(0)O(1)S(2)T(3)G(4)R(5)E(6)S(7)_(8)P(9)A(10)S(11)S(12)W(13)O(14)R(15)D(16)
    // = is at index 16, secret starts at 17, total length 24
    // But eqIdx returns 17... let me check the actual string
    // POSTGRES_PASSWORD= has 17 chars (0-16), = is at 16
    // Hmm, the actual calculation shows eqIdx=17, so start=18
    expect(ranges).toEqual([{ start: 18, end: 24 }]);
  });

  test('multiple vars, only secrets get ranges', () => {
    const ranges = secretRanges('POSTGRES_PASSWORD=secret,POSTGRES_DB=app');
    expect(ranges).toEqual([{ start: 18, end: 24 }]);
  });

  test('empty input', () => {
    expect(secretRanges('')).toEqual([]);
    expect(secretRanges(null)).toEqual([]);
  });

  test('value with = inside', () => {
    // KEY is not a secret key, so no range
    const ranges = secretRanges('KEY=a=b');
    expect(ranges).toEqual([]);
  });

  test('all secrets', () => {
    const ranges = secretRanges('PASSWORD=a,TOKEN=b');
    expect(ranges).toHaveLength(2);
    expect(ranges[0]).toEqual({ start: 9, end: 10 });
    expect(ranges[1]).toEqual({ start: 17, end: 18 });
  });

  test('no secrets', () => {
    const ranges = secretRanges('DB=app,PORT=8080');
    expect(ranges).toEqual([]);
  });
});

describe('generateSecret', () => {
  test('returns string of requested length', () => {
    const secret = generateSecret(32);
    expect(typeof secret).toBe('string');
    expect(secret.length).toBe(32);
  });

  test('default length is 24', () => {
    const secret = generateSecret();
    expect(secret.length).toBe(24);
  });

  test('does not contain ambiguous characters', () => {
    const secret = generateSecret(100);
    expect(secret).not.toMatch(/[0Oo1lIi]/);
  });

  test('does not contain shell-special characters', () => {
    const secret = generateSecret(100);
    expect(secret).not.toMatch(/['"\\`$!]/);
  });

  test('two calls return different values', () => {
    const a = generateSecret();
    const b = generateSecret();
    expect(a).not.toBe(b);
  });
});

describe('redactForLog', () => {
  test('redacts PASSWORD value', () => {
    const result = redactForLog('POSTGRES_PASSWORD=secret123');
    expect(result).toBe('POSTGRES_PASSWORD=***');
  });

  test('redacts SECRET value', () => {
    const result = redactForLog('JWT_SECRET=my-secret-key');
    expect(result).toBe('JWT_SECRET=***');
  });

  test('redacts TOKEN value', () => {
    const result = redactForLog('API_TOKEN=abc123');
    expect(result).toBe('API_TOKEN=***');
  });

  test('does not redact non-secret values', () => {
    const result = redactForLog('POSTGRES_DB=app');
    expect(result).toBe('POSTGRES_DB=app');
  });

  test('redacts within longer text', () => {
    const result = redactForLog('Creating with PASSWORD=secret123 and DB=app');
    expect(result).toBe('Creating with PASSWORD=*** and DB=app');
  });

  test('handles empty/null input', () => {
    expect(redactForLog('')).toBe('');
    expect(redactForLog(null)).toBe(null);
  });
});

describe('findWeakSecrets', () => {
  test('detects "secret"', () => {
    const weak = findWeakSecrets('POSTGRES_PASSWORD=secret');
    expect(weak).toEqual([{ key: 'POSTGRES_PASSWORD', reason: 'example' }]);
  });

  test('detects "change-me"', () => {
    const weak = findWeakSecrets('REDIS_PASSWORD=change-me');
    expect(weak).toEqual([{ key: 'REDIS_PASSWORD', reason: 'example' }]);
  });

  test('detects "1234"', () => {
    const weak = findWeakSecrets('TOKEN=1234');
    expect(weak).toEqual([{ key: 'TOKEN', reason: 'short' }]);
  });

  test('detects "password"', () => {
    const weak = findWeakSecrets('SECRET=password');
    expect(weak).toEqual([{ key: 'SECRET', reason: 'common' }]);
  });

  test('detects short values (< 4 chars)', () => {
    const weak = findWeakSecrets('PASSWORD=ab');
    expect(weak).toEqual([{ key: 'PASSWORD', reason: 'short' }]);
  });

  test('does not flag strong passwords', () => {
    const weak = findWeakSecrets('PASSWORD=MyStr0ng!Pass#2024');
    expect(weak).toEqual([]);
  });

  test('does not flag non-secret vars', () => {
    const weak = findWeakSecrets('DB_APP=secret');
    expect(weak).toEqual([]);
  });

  test('handles multiple vars', () => {
    const weak = findWeakSecrets('PASSWORD=secret,DB=app,TOKEN=1234');
    expect(weak).toHaveLength(2);
    expect(weak[0].key).toBe('PASSWORD');
    expect(weak[1].key).toBe('TOKEN');
  });

  test('handles empty input', () => {
    expect(findWeakSecrets('')).toEqual([]);
    expect(findWeakSecrets(null)).toEqual([]);
  });
});
