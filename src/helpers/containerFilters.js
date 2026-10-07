/**
 * Pure helpers for filtering containers by free-text query.
 * Matching is case-insensitive and accent-insensitive, against the
 * container's name, image and state. No I/O, no state, no mutation.
 */

/**
 * Normalizes text for comparison: lowercase and without accents.
 *
 * @param {string} text
 * @returns {string}
 */
export function normalizeForSearch(text) {
  if (!text) return '';
  // NFD splits an accented letter into base letter + combining mark, and the
  // regex drops the marks, so 'caché' and 'cache' compare equal.
  return String(text)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/**
 * Filters containers by a match on name, image and state.
 * Every word of the query must appear in some field: AND across words,
 * OR across fields. An empty or whitespace-only query returns everything.
 *
 * @param {Array<Object>} containers
 * @param {string} query
 * @returns {Array<Object>}
 */
export function filterContainers(containers, query) {
  if (!Array.isArray(containers)) return [];
  const words = normalizeForSearch(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...containers];

  return containers.filter((container) => {
    const { name, image, state } = container ?? {};
    // Fields joined with a space: a query word never spans two fields,
    // because words are split on whitespace and cannot contain a space.
    const haystack = normalizeForSearch(
      `${name ?? ''} ${image ?? ''} ${state ?? ''}`
    );
    return words.every((word) => haystack.includes(word));
  });
}
