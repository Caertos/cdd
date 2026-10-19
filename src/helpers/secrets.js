import { randomInt } from 'crypto';
import { parseEnvPairs, envEntrySpans, formatEnvEntries } from './envInput.js';

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

  const masked = parseEnvPairs(envInput).map(({ key, value }) => {
    // An entry without '=' has no value to hide.
    if (value === null) return key;
    if (!isSecretKey(key)) return `${key}=${value}`;
    // Mask the WHOLE value: a value with commas used to leak its tail.
    return `${key}=${maskChar.repeat(6)}`;
  });
  // Re-escape around the rejoin so a comma inside a non-secret value stays
  // part of that value instead of splitting the list.
  return formatEnvEntries(masked);
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
  // Spans are computed on the original string so the range covers escaped
  // commas too: `POSTGRES_PASSWORD=a\,b` masks `a\,b`, not just `a`.
  for (const span of envEntrySpans(envInput)) {
    if (span.eqIndex === -1) continue;
    if (isSecretKey(span.key)) {
      ranges.push({ start: span.eqIndex + 1, end: span.end });
    }
  }

  return ranges;
}

/**
 * Generates a strong password suitable for shell and YAML.
 * Uses crypto.randomInt (rejection sampling — no module bias).
 * Alphabet excludes ambiguous characters (0/O, 1/l/I) and
 * shell/YAML-conflicting characters.
 *
 * @param {number} [length=24]
 * @returns {string}
 */
export function generateSecret(length = 24) {
  // Avoids: 0/O/o, 1/l/I, quotes, backticks, backslash, dollar, exclamation
  // Also avoids shell/YAML-conflicting chars: @ # % ^ & * + = etc.
  // And ambiguous: i (looks like 1 in some fonts)
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789_-';
  let result = '';
  for (let i = 0; i < length; i++) {
    // randomInt uses rejection sampling — uniform distribution, no bias
    result += alphabet[randomInt(alphabet.length)];
  }
  return result;
}

/**
 * Replaces sensitive values with '***' before logging.
 *
 * Accepts either an array of `KEY=VALUE` entries (each secret pair becomes
 * `KEY=***`) or a free string (each secret value is replaced in full, escaped
 * commas included). The old value regex `[^,}\s)]+` stopped at a space, `)`,
 * `}`, or a comma, logging the tail of the secret.
 *
 * @param {string|string[]} text
 * @returns {string|string[]}
 */
export function redactForLog(text) {
  if (Array.isArray(text)) {
    return text.map((entry) => {
      if (typeof entry !== 'string') return entry;
      const at = entry.indexOf('=');
      if (at === -1) return entry;
      const key = entry.slice(0, at).trim();
      if (!isSecretKey(key)) return entry;
      return `${key}=***`;
    });
  }

  if (!text || typeof text !== 'string') return text;

  const spans = envEntrySpans(text);
  if (!spans.length) return text;

  let result = '';
  let cursor = 0;
  for (const span of spans) {
    if (span.eqIndex === -1 || !isSecretKey(span.key)) continue;
    result += text.slice(cursor, span.eqIndex + 1);
    result += '***';
    cursor = span.end;
  }
  result += text.slice(cursor);
  return result;
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

  for (const { key, value } of parseEnvPairs(envInput)) {
    if (value === null) continue;

    const trimmed = value.trim();

    if (!isSecretKey(key) || !trimmed) continue;

    for (const { pattern, reason } of weakPatterns) {
      if (pattern.test(trimmed)) {
        weak.push({ key, reason });
        break;
      }
    }

    // Also flag very short passwords (less than 4 chars)
    if (
      trimmed.length > 0 &&
      trimmed.length < 4 &&
      !weak.some((w) => w.key === key)
    ) {
      weak.push({ key, reason: 'short' });
    }
  }

  return weak;
}
