import { randomBytes } from 'crypto';

/**
 * Creates a Buffer from a secret string for secure handling.
 * The original string should be discarded after this call.
 * @param {string} secret
 * @returns {Buffer}
 */
export function secretToBuffer(secret) {
  return Buffer.from(secret, 'utf8');
}

/**
 * Clears a buffer's contents (best-effort zeroization).
 * Note: JavaScript/Node.js cannot guarantee memory zeroization due to
 * GC and string interning. This is a defense-in-depth measure.
 * @param {Buffer} buf
 */
export function clearBuffer(buf) {
  if (Buffer.isBuffer(buf)) {
    buf.fill(0);
  }
}

/**
 * Compares two buffers in constant time to prevent timing attacks.
 * @param {Buffer} a
 * @param {Buffer} b
 * @returns {boolean}
 */
export function timingSafeEqual(a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) return false;
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}

/**
 * Fragments of env var names that mark a value as sensitive.
 * Matched case-insensitively against the variable name.
 */
export const SECRET_KEY_PATTERNS = [
  'PASSWORD',
  'PASSWD',
  'SECRET',
  'TOKEN',
  'APIKEY',
  'API_KEY',
  'PRIVATE_KEY',
  'ACCESS_KEY',
  'CREDENTIAL',
  'AUTH',
];

/**
 * Does this variable name indicate a sensitive value?
 * @param {string} name - Variable name, e.g. 'POSTGRES_PASSWORD'
 * @returns {boolean}
 */
export function isSecretKey(name) {
  if (!name) return false;
  const upper = name.toUpperCase();
  return SECRET_KEY_PATTERNS.some((p) => upper.includes(p));
}

/**
 * Masks sensitive values in a 'K=V,K2=V2' string for display.
 * Does not modify the original string.
 *
 * @param {string} envInput
 * @param {Object} [options]
 * @param {boolean} [options.reveal=false] - If true, returns the string unchanged
 * @param {string}  [options.maskChar='•']
 * @returns {string}
 */
export function maskEnvPairs(envInput, options = {}) {
  const { reveal = false, maskChar = '•' } = options;
  if (reveal || !envInput) return envInput;

  return envInput
    .split(',')
    .map((pair) => {
      const eqIdx = pair.indexOf('=');
      if (eqIdx === -1) return pair;
      const key = pair.slice(0, eqIdx);
      if (!isSecretKey(key)) return pair;
      return `${key}=${maskChar.repeat(6)}`;
    })
    .join(',');
}

/**
 * Calculates which character ranges in an env input string should be masked.
 * Used by TextField to mask without altering the value or cursor position.
 *
 * @param {string} envInput - e.g. 'POSTGRES_PASSWORD=secret,POSTGRES_DB=app'
 * @returns {Array<{start: number, end: number}>}
 */
export function secretRanges(envInput) {
  if (!envInput) return [];

  const ranges = [];
  let offset = 0;

  const pairs = envInput.split(',');
  for (const pair of pairs) {
    const eqIdx = pair.indexOf('=');
    if (eqIdx !== -1) {
      const key = pair.slice(0, eqIdx);
      if (isSecretKey(key)) {
        const valueStart = offset + eqIdx + 1;
        const valueEnd = offset + pair.length;
        ranges.push({ start: valueStart, end: valueEnd });
      }
    }
    offset += pair.length + 1; // +1 for the comma
  }

  return ranges;
}

/**
 * Generates a strong password suitable for shell and YAML.
 * Uses crypto.randomBytes. Alphabet excludes ambiguous characters
 * (0/O, 1/l/I) and shell/YAML-conflicting characters.
 *
 * @param {number} [length=24]
 * @returns {string}
 */
export function generateSecret(length = 24) {
  // Avoids: 0/O/o, 1/l/I, quotes, backticks, backslash, dollar, exclamation
  // Also avoids shell/YAML-conflicting chars: @ # % ^ & * + = etc.
  // And ambiguous: i (looks like 1 in some fonts)
  const alphabet =
    'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789_-';
  const bytes = randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += alphabet[bytes[i] % alphabet.length];
  }
  return result;
}

/**
 * Replaces sensitive values with '***' in any text before logging.
 * @param {string} text
 * @returns {string}
 */
export function redactForLog(text) {
  if (!text) return text;

  // Match patterns like KEY=value where KEY contains a secret pattern
  return text.replace(
    /([A-Z_]*(?:PASSWORD|PASSWD|SECRET|TOKEN|APIKEY|API_KEY|PRIVATE_KEY|ACCESS_KEY|CREDENTIAL|AUTH)[A-Z_]*)\s*=\s*[^,}\s)]+/gi,
    '$1=***'
  );
}

/**
 * Detects weak or example secret values for the review warning.
 * @param {string} envInput
 * @returns {Array<{key: string, reason: 'example'|'short'|'common'}>}
 */
export function findWeakSecrets(envInput) {
  if (!envInput) return [];

  const weakPatterns = [
    { pattern: /^secret$/i, reason: 'example' },
    { pattern: /^change[-_]?me$/i, reason: 'example' },
    { pattern: /^password$/i, reason: 'common' },
    { pattern: /^1234$/, reason: 'short' },
    { pattern: /^admin$/i, reason: 'common' },
    { pattern: /^guest$/i, reason: 'common' },
    { pattern: /^test$/i, reason: 'common' },
    { pattern: /^default$/i, reason: 'common' },
  ];

  const weak = [];
  const pairs = envInput.split(',');

  for (const pair of pairs) {
    const eqIdx = pair.indexOf('=');
    if (eqIdx === -1) continue;

    const key = pair.slice(0, eqIdx).trim();
    const value = pair.slice(eqIdx + 1).trim();

    if (!isSecretKey(key) || !value) continue;

    for (const { pattern, reason } of weakPatterns) {
      if (pattern.test(value)) {
        weak.push({ key, reason });
        break;
      }
    }

    // Also flag very short passwords (less than 4 chars)
    if (value.length > 0 && value.length < 4 && !weak.some((w) => w.key === key)) {
      weak.push({ key, reason: 'short' });
    }
  }

  return weak;
}
