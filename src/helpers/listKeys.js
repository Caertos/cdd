/**
 * Pairs each item with a React key built from its content, so a list that has
 * no id of its own does not have to be keyed by array position.
 *
 * Equal items are told apart by their occurrence ("a#1", "a#2"), which keeps
 * the keys unique and stable while the content of the list does not change.
 *
 * @template T
 * @param {T[]} items
 * @param {(item: T) => string} [toText] content the key is built from
 * @returns {Array<{ item: T, key: string }>}
 */
export function withKeys(items, toText = String) {
  const seen = new Map();
  return items.map((item) => {
    const text = toText(item);
    const count = (seen.get(text) ?? 0) + 1;
    seen.set(text, count);
    return { item, key: `${text}#${count}` };
  });
}
