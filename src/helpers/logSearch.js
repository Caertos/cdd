/**
 * Search inside a log. Pure: no state, no rendering.
 *
 * The query is always literal text, never a pattern: `[`, `(` and `.` in a
 * log search are characters the user is looking for.
 *
 * @module logSearch
 */

/** Escapes a string so a RegExp matches it literally. */
function literal(query) {
  return query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matcher(query) {
  return new RegExp(literal(query), 'giu');
}

/**
 * @typedef {Object} SearchResult
 * @property {string[]} lines - What to show: every line, or only the matching
 *   ones in filter mode
 * @property {number[]} matchIndices - Indices into `lines` of the matches
 * @property {number} matchCount
 */

/**
 * Finds the lines that contain `query`, ignoring case.
 *
 * Highlight mode (the default) keeps every line so the lines around a match,
 * which are half the information in a log, stay in view. Filter mode hides
 * the rest on purpose.
 *
 * @param {string[]} lines
 * @param {string} query
 * @param {Object} [options]
 * @param {boolean} [options.filter=false] - Hide the lines that do not match
 * @returns {SearchResult}
 */
export function searchLogLines(lines, query, { filter = false } = {}) {
  const all = Array.isArray(lines) ? lines : [];
  if (!query) return { lines: all, matchIndices: [], matchCount: 0 };

  const re = matcher(query);
  const hits = [];
  all.forEach((line, i) => {
    re.lastIndex = 0;
    if (re.test(line)) hits.push(i);
  });

  if (filter) {
    return {
      lines: hits.map((i) => all[i]),
      matchIndices: hits.map((_, n) => n),
      matchCount: hits.length,
    };
  }
  return { lines: all, matchIndices: hits, matchCount: hits.length };
}

/**
 * Does the line contain the query? Case-insensitive, literal.
 *
 * @param {string} line
 * @param {string} query
 * @returns {boolean}
 */
export function lineMatches(line, query) {
  if (!query) return false;
  return matcher(query).test(line);
}

/**
 * Splits a line into matching and non-matching pieces, so the renderer can
 * highlight without building patterns of its own.
 *
 * @param {string} line
 * @param {string} query
 * @returns {Array<{text: string, match: boolean}>}
 */
export function splitHighlight(line, query) {
  const text = String(line ?? '');
  if (!query) return [{ text, match: false }];

  const parts = [];
  let last = 0;
  for (const found of text.matchAll(matcher(query))) {
    if (found.index > last) {
      parts.push({ text: text.slice(last, found.index), match: false });
    }
    parts.push({ text: found[0], match: true });
    last = found.index + found[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), match: false });
  return parts.length > 0 ? parts : [{ text, match: false }];
}
