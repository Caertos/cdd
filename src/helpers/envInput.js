/**
 * Single parser for the wizard's environment-variable field.
 *
 * The field is a comma-separated list of `KEY=VALUE` entries, but a value may
 * itself contain a comma (Docker allows it — e.g. Kafka's `KAFKA_LISTENERS`).
 * A bare `split(',')` cannot tell those commas apart, so the value escapes its
 * own `,` and `\` characters (`\,` and `\\`) and every reader — validation,
 * masking, the review screen, reassure/recreate — must go through these
 * helpers instead of splitting the string on its own.
 *
 * The encoding is lossless for canonical strings:
 * `formatEnvEntries(splitEnvEntries(x)) === x`.
 */

/**
 * Escapes the commas and backslashes inside a single value so it can live
 * within the comma-separated field. Backslashes are escaped first, otherwise
 * the backslash that escapes a comma would itself be doubled.
 *
 * @param {string} v
 * @returns {string}
 */
export function escapeEnvValue(v) {
  if (v == null) return '';
  return String(v).replace(/\\/g, '\\\\').replace(/,/g, '\\,');
}

/**
 * Reverses {@link escapeEnvValue}: `\,` becomes a literal comma and `\\` a
 * literal backslash. A backslash followed by anything else is kept verbatim.
 *
 * @param {string} v
 * @returns {string}
 */
export function unescapeEnvValue(v) {
  if (!v || typeof v !== 'string') return v;
  let out = '';
  for (let i = 0; i < v.length; i += 1) {
    const ch = v[i];
    if (ch === '\\') {
      const next = v[i + 1];
      if (next === '\\' || next === ',') {
        out += next;
        i += 1;
        continue;
      }
    }
    out += ch;
  }
  return out;
}

/**
 * Splits an env string on commas that are not escaped, then unescapes each
 * entry. `A=1\,2,B=3` yields `['A=1,2', 'B=3']` (the values carry real commas).
 * Falsy input yields an empty array.
 *
 * @param {string} envInput
 * @returns {string[]}
 */
export function splitEnvEntries(envInput) {
  if (!envInput || typeof envInput !== 'string') return [];
  const entries = [];
  let current = '';
  for (let i = 0; i < envInput.length; i += 1) {
    const ch = envInput[i];
    if (ch === '\\') {
      const next = envInput[i + 1];
      if (next === '\\' || next === ',') {
        current += next;
        i += 1;
        continue;
      }
      current += ch;
      continue;
    }
    if (ch === ',') {
      entries.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  entries.push(current);
  return entries;
}

/**
 * Parses the field into `{ key, value }` pairs. Each entry is cut at its first
 * `=`; an entry without one becomes `{ key: entry, value: null }`. Keys are
 * trimmed, values are not. Empty entries are ignored.
 *
 * @param {string} envInput
 * @returns {Array<{key: string, value: string|null}>}
 */
export function parseEnvPairs(envInput) {
  const pairs = [];
  for (const entry of splitEnvEntries(envInput)) {
    if (!entry.trim()) continue;
    const at = entry.indexOf('=');
    if (at === -1) {
      pairs.push({ key: entry.trim(), value: null });
    } else {
      pairs.push({
        key: entry.slice(0, at).trim(),
        value: entry.slice(at + 1),
      });
    }
  }
  return pairs;
}

/**
 * Re-escapes the values of `KEY=VALUE` entries and joins them with commas.
 * Inverse of {@link splitEnvEntries} for canonical input. Entry order and empty
 * entries are preserved.
 *
 * @param {string[]} entries
 * @returns {string}
 */
export function formatEnvEntries(entries) {
  if (!Array.isArray(entries)) return '';
  return entries
    .map((entry) => {
      if (typeof entry !== 'string') return '';
      const at = entry.indexOf('=');
      if (at === -1) return entry;
      const key = entry.slice(0, at);
      const value = entry.slice(at + 1);
      return `${key}=${escapeEnvValue(value)}`;
    })
    .join(',');
}

/**
 * Character spans of every non-empty entry in the ORIGINAL string, so callers
 * (e.g. `secretRanges`) can mask a value that contains escaped commas without
 * losing its offset.
 *
 * `start`/`end` delimit the whole entry (`end` is exclusive, at the separating
 * comma or end of string); `eqIndex` is the absolute index of the `=` (−1 when
 * there is none); `key` is the trimmed key.
 *
 * @param {string} envInput
 * @returns {Array<{start: number, end: number, eqIndex: number, key: string}>}
 */
export function envEntrySpans(envInput) {
  if (!envInput || typeof envInput !== 'string') return [];
  const spans = [];
  let start = 0;

  const flush = (end) => {
    const raw = envInput.slice(start, end);
    if (raw.trim()) {
      const at = raw.indexOf('=');
      spans.push({
        start,
        end,
        eqIndex: at === -1 ? -1 : start + at,
        key: (at === -1 ? raw : raw.slice(0, at)).trim(),
      });
    }
    start = end + 1;
  };

  for (let i = 0; i < envInput.length; i += 1) {
    const ch = envInput[i];
    if (ch === '\\') {
      i += 1;
      continue;
    }
    if (ch === ',') flush(i);
  }
  flush(envInput.length);
  return spans;
}
