import { useState, useCallback, useEffect } from 'react';

/** An empty list never throws and never moves the selection. */
const EMPTY = [];

/**
 * Selection anchored to the container id.
 *
 * This is a product fix, not a refactor. The selection used to be a numeric
 * index over a list Docker replaces wholesale every three seconds: when a
 * container disappeared — the user erased it, or something reaped it —
 * everything below it shifted up one position and the selection silently
 * jumped to a different container. In a long list that is a route to pressing
 * `E` (erase) on the wrong one. Anchoring to the id makes a surviving
 * container keep the selection wherever it ends up in the list, and turns the
 * loss of the selection into an explicit event instead of a silent one.
 *
 * The state is a single `{ id, index }` anchor. `id` is the selected
 * container; `index` is the last position that id was known to occupy. That
 * stored index exists for exactly one reason: when the container disappears
 * the new list can no longer be asked where it was, so the stored slot is the
 * only way to land the selection on whatever slid into it.
 *
 * `selectedIndex`, `selectedContainer` and `selected` are DERIVED on every
 * render from the anchor plus `items`; they are never written. That is what
 * keeps the UI correct without ever a frame where the stale index leaks
 * through:
 *
 *   - id found in `items`     → its position in `items` right now;
 *   - id gone, `items` sized → `min(storedIndex, items.length - 1)`, the
 *                              neighbour that slid into the vacated slot;
 *   - nothing ever chosen     → the top of the list, which is what the app
 *                              has always shown on first paint;
 *   - `items` empty           → `-1`, and no selection.
 *
 * `selected` is the derived index under its old name, kept as a compatibility
 * value for the downstream layers that still receive a position
 * (`useControls`, `useContainerCommandRouter`, `useContainerActions`);
 * `selectedIndex` is the same number. Later work migrates those to
 * `selectedId` and drops this alias.
 *
 * @param {Array<{id: string}>} items - List already filtered and sorted
 * @returns {{
 *   selectedId: string|null,
 *   selectedIndex: number,
 *   selectedContainer: Object|null,
 *   selected: number,
 *   move: (delta: number) => void,
 *   selectId: (id: string) => void,
 *   lostSelection: boolean
 * }}
 */
export function useContainerSelection(items) {
  const list = Array.isArray(items) ? items : EMPTY;
  // The anchor, not the position: { id: selectedId, index: last known slot }.
  const [anchor, setAnchor] = useState(() => ({ id: null, index: 0 }));
  // A pulse, not a held flag: see the clearing effect below.
  const [lostSelection, setLostSelection] = useState(false);

  // An item without a usable id must not break the derivation, and an anchor
  // that never got a usable id must not be treated as "still selected".
  const anchored = anchor.id !== null && anchor.id !== undefined;
  const foundIndex = anchored
    ? list.findIndex((item) => item && item.id === anchor.id)
    : -1;
  const selectedIndex = deriveIndex(foundIndex, anchor, list);
  const selected = selectedIndex >= 0 ? list[selectedIndex] : null;

  const move = useCallback(
    (delta) => {
      if (list.length === 0) {
        return;
      }
      // Relative to where the selection renders NOW, not to the stale slot.
      setAnchor((prev) => {
        const from = deriveIndex(
          prev.id !== null && prev.id !== undefined
            ? list.findIndex((item) => item && item.id === prev.id)
            : -1,
          prev,
          list
        );
        const next = (from + delta + list.length) % list.length;
        return { id: list[next].id ?? null, index: next };
      });
    },
    [list]
  );

  const selectId = useCallback(
    (id) => {
      const index = list.findIndex((item) => item && item.id === id);
      if (index < 0) {
        // An id that is not in the list changes nothing. Clearing the anchor
        // would drop the selection back to the top of the list, and storing
        // the dangling id would let it derive to the vacated slot — either
        // way the highlight moves to a container nobody picked, which is the
        // exact failure this hook exists to prevent. Leaving it alone is the
        // only honest answer to an id we cannot place.
        return;
      }
      setAnchor({ id, index });
    },
    [list]
  );

  // Pulse. The anchor is written back so the state matches what is already
  // being rendered, and `lostSelection` is true for exactly one commit: the
  // clearing effect below runs on the next render, which is the commit after
  // the one that raised it. It cannot get stuck true, because the only thing
  // that sets it back to true is this effect, and it returns early once the
  // anchor is back in the list.
  useEffect(() => {
    if (!anchored || foundIndex >= 0 || list.length === 0) {
      return;
    }
    setAnchor({ id: list[selectedIndex].id ?? null, index: selectedIndex });
    setLostSelection(true);
  }, [list, anchored, foundIndex, selectedIndex]);

  useEffect(() => {
    if (lostSelection) {
      setLostSelection(false);
    }
  }, [lostSelection]);

  return {
    selectedId: selected ? selected.id : null,
    selectedIndex,
    selectedContainer: selected,
    // Deprecated alias of `selectedIndex`, kept for the layers that still
    // thread a position around. Same value, not a second source of truth.
    selected: selectedIndex,
    move,
    selectId,
    lostSelection,
  };
}

/**
 * Position the selection renders at, given the anchor and the current list.
 * Extracted so `move` follows exactly the same rule inside its state updater
 * instead of duplicating the derivation.
 */
function deriveIndex(foundIndex, anchor, list) {
  if (list.length === 0) {
    return -1;
  }
  if (foundIndex >= 0) {
    return foundIndex;
  }
  if (anchor.id === null || anchor.id === undefined) {
    // Nothing was ever chosen, so nothing can be lost: the list simply has a
    // selection at the top, as it did before this hook was anchored.
    return 0;
  }
  // Anchored but gone: land on whatever slid into the vacated slot.
  return Math.min(anchor.index, list.length - 1);
}
