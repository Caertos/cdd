/**
 * Pure helpers for filtering and sorting containers.
 * Filtering matches a free-text query case-insensitively and
 * accent-insensitively against the container's name, image and state;
 * sorting orders the list by health trouble, name or creation time.
 * No I/O, no state, no mutation.
 */

/**
 * Letters that NFD (and NFKD) leave untouched — they have no decomposition
 * to strip — folded explicitly, so a container named 'brøtal-service' is
 * found when the user types 'o'.
 *
 * Every value is plain ASCII, and every key is a non-ASCII letter, so a
 * folded string can never contain a key again: the fold is idempotent by
 * construction, not by luck.
 *
 * Lowercase keys only: `toLowerCase()` runs before this step, so an
 * uppercase entry would be dead code — 'Ø', 'Ł', 'Ð', 'Þ', 'Æ', 'Œ', 'Đ'
 * and 'ẞ' all reach the fold already lowercased.
 *
 * @type {Object<string, string>}
 */
export const FOLD_LETTERS = {
  ø: 'o', // Norwegian, Danish
  đ: 'd', // Croatian, Vietnamese
  ł: 'l', // Polish
  ð: 'd', // Icelandic eth
  þ: 'th', // Icelandic thorn: the standard transliteration, like ð → d
  æ: 'ae', // Danish, Norwegian
  œ: 'oe', // French, Dutch
  ı: 'i', // Turkish dotless i
  ß: 'ss', // German sharp s: a real letter that never decomposes, not an accent
};

/**
 * One combined pattern derived from the table itself (single source of
 * truth), so the fold is a single pass over the text instead of one
 * `replaceAll` per letter. Every key is a plain letter: nothing needs
 * escaping inside a character class. Only ever passed to
 * `String.prototype.replace`, which resets `lastIndex` for a /g regex
 * before and after each call, so the shared pattern never leaks state.
 */
const FOLD_PATTERN = new RegExp(`[${Object.keys(FOLD_LETTERS).join('')}]`, 'g');

/**
 * Normalizes text for comparison: lowercase, without accents, and with the
 * letters NFD cannot decompose folded to ASCII ('brøtal' → 'brotal').
 * Idempotent: normalizing the result again returns the same string.
 *
 * @param {string} text
 * @returns {string}
 */
export function normalizeForSearch(text) {
  if (!text) return '';
  // NFD splits an accented letter into base letter + combining mark, and the
  // regex drops the marks, so 'caché' and 'cache' compare equal.
  return (
    String(text)
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      // Last step: ø, ł, ß… have no combining form, so the strip above cannot
      // help and they are folded by hand from FOLD_LETTERS.
      .replace(FOLD_PATTERN, (letter) => FOLD_LETTERS[letter])
  );
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

/** @typedef {'state'|'name'|'created'} SortMode */

/**
 * Weight of each verdict level for the 'state' sort: lower sorts first,
 * so what is broken rises to the top of the list.
 *
 * Null prototype on purpose. A plain object literal answers a lookup from
 * `Object.prototype`, so one polluted key (`Object.prototype.bogus = 0`)
 * would hand a weight to a level that has none — and the `typeof` guard
 * below only rejects inherited *functions*, not an inherited *number*.
 * With no prototype every lookup is own-key only, and reading it stays the
 * plain `HEALTH_WEIGHTS[level]` a reader expects.
 *
 * @type {Object<string, number>}
 */
const HEALTH_WEIGHTS = Object.assign(Object.create(null), {
  fail: 0,
  warn: 1,
  ok: 2,
  idle: 3,
});

/**
 * Compares two texts alphabetically, case- and accent-insensitively.
 * When two different values normalize alike ('Web' vs 'web'), the raw
 * text breaks the tie, so distinct values never compare equal.
 *
 * @param {unknown} left
 * @param {unknown} right
 * @returns {number} negative if left first, positive if right first, 0 on a tie
 */
function compareText(left, right) {
  const a = normalizeForSearch(left);
  const b = normalizeForSearch(right);
  if (a !== b) return a < b ? -1 : 1;

  const rawLeft = String(left ?? '');
  const rawRight = String(right ?? '');
  if (rawLeft === rawRight) return 0;
  return rawLeft < rawRight ? -1 : 1;
}

/**
 * Total tie-break shared by every mode: alphabetical by name, then by id.
 * Ids are unique, so the final order never depends on the engine's sort
 * stability.
 *
 * @param {Object} a
 * @param {Object} b
 * @returns {number}
 */
function compareByNameThenId(a, b) {
  return compareText(a?.name, b?.name) || compareText(a?.id, b?.id);
}

/**
 * Parses Docker's `Created` field: a Unix epoch timestamp in seconds.
 * Zero or negative values are Docker's zero time and count as unusable.
 *
 * @param {unknown} value
 * @returns {number|null} usable timestamp, or null when unusable
 */
function creationTime(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : null;
}

/**
 * Compares creation times descending (newest first). A missing, non-numeric
 * or otherwise unusable `createdAt` sorts last: it is the least informative
 * value, not the newest one.
 *
 * @param {unknown} left
 * @param {unknown} right
 * @returns {number}
 */
function compareCreated(left, right) {
  const a = creationTime(left);
  const b = creationTime(right);
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

/**
 * Sorts the list according to the mode. Does not mutate the received array,
 * the container objects nor the health map: always returns a new array.
 *
 * 'state' (default): trouble first — fail, warn, ok, idle — then by name.
 * 'name': alphabetical.
 * 'created': newest first; a missing or unusable `createdAt` sorts last.
 *
 * Every comparison ends on name and id, so the same input always yields the
 * same output regardless of the engine's sort stability.
 *
 * @param {Array<Object>} containers
 * @param {SortMode} mode
 * @param {Object} ctx
 * @param {Map<string, HealthVerdict>} ctx.health - Used by mode 'state'.
 *   May be incomplete: a container that has not been inspected yet has no
 *   verdict, and that is not an error (see TASK-9 §3.2) — it weighs as idle.
 * @returns {Array<Object>}
 */
export function sortContainers(containers, mode, ctx) {
  if (!Array.isArray(containers)) return [];

  const rawHealth = ctx == null ? undefined : ctx.health;
  // Anything without a `get` (missing, not a Map) behaves as an empty map.
  const healthMap =
    rawHealth && typeof rawHealth.get === 'function' ? rawHealth : null;
  const weightOf = (container) =>
    healthWeight(healthMap ? healthMap.get(container?.id) : undefined);

  const sorted = [...containers];

  if (mode === 'name') {
    sorted.sort((a, b) => compareByNameThenId(a, b));
    return sorted;
  }

  if (mode === 'created') {
    sorted.sort(
      (a, b) =>
        compareCreated(a?.createdAt, b?.createdAt) || compareByNameThenId(a, b)
    );
    return sorted;
  }

  // Default mode 'state': what is broken first, then by name.
  sorted.sort((a, b) => weightOf(a) - weightOf(b) || compareByNameThenId(a, b));
  return sorted;
}

/**
 * Weight of a verdict for the 'state' sort: fail < warn < ok < idle, so
 * lower sorts first and trouble rises to the top.
 *
 * Reads `verdict.level` ('ok' | 'idle' | 'warn' | 'fail'), not
 * `verdict.code`: `code` names the symptom while `level` already means
 * "this is worrying", which is exactly what the sort needs to know.
 * A container without a verdict weighs as `idle`, and an unknown or absent
 * level falls back to `idle` too, so a bad verdict can never produce a NaN
 * that silently corrupts the sort.
 *
 * Only an *own* `level` counts: a plain `verdict.level` walks the prototype
 * chain, so an inherited `level` would turn a verdict that names no level
 * into whatever the chain claims — a polluted `Object.prototype.level =
 * 'fail'` would weigh the "not inspected yet" verdict as `fail` and send
 * it to the top of the list.
 *
 * @param {HealthVerdict|undefined} verdict
 * @returns {number}
 */
export function healthWeight(verdict) {
  const level =
    verdict == null || !Object.hasOwn(verdict, 'level')
      ? undefined
      : verdict.level;
  // The table has no prototype and the guard rejects anything that is not a
  // literal weight, so `toString`, `constructor` or a polluting number all
  // fall back to idle.
  const weight = HEALTH_WEIGHTS[level];
  return typeof weight === 'number' ? weight : HEALTH_WEIGHTS.idle;
}

/**
 * Returns the mode that follows the given one in the fixed cycle
 * 'state' → 'name' → 'created' → 'state'. 'state' is both the default
 * mode and the first entry of the cycle.
 *
 * An unknown, empty or non-string mode is treated as the default
 * ('state') instead of throwing, so it advances to 'name' — the same
 * fallback `sortContainers` applies to an unusable mode.
 *
 * @param {SortMode|string|null|undefined} mode
 * @returns {SortMode}
 */
export function nextSortMode(mode) {
  if (mode === 'state') return 'name';
  if (mode === 'name') return 'created';
  if (mode === 'created') return 'state';
  // Unusable input is treated as the default mode 'state', which also
  // lands on 'name', so the result always stays inside the cycle.
  return 'name';
}
