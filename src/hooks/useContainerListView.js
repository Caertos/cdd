import { useState, useCallback, useMemo } from 'react';
import {
  filterContainers,
  sortContainers,
  nextSortMode,
} from '../helpers/containerFilters.js';
import { applyKeyToText, textStateOf } from '../helpers/textEditing.js';

/**
 * Presentation state of the container list: the live filter, the sort mode and
 * the rows the user actually sees, already filtered and ordered.
 *
 * Lives inside `useControls`, not in `App` (TASK-9 §4 bis). The filter opens
 * with a key, and keys are dispatched in one place — `useControls` — so the
 * state has to be reachable from there; `App` only reads `controls.view`.
 *
 * The text of the filter is a `TextState` ({ value, cursor }) so the caret,
 * Backspace and paste come from `applyKeyToText`, the same editor the wizard
 * uses. `handleFilterKey` returns false for Enter and Esc on purpose: those are
 * the two keys the keymap resolves, not text.
 *
 * @param {Array<Object>} containers - Raw list, neither filtered nor ordered
 * @param {Object} [ctx]
 * @param {Map<string, Object>} [ctx.health] - Verdicts for the 'state' sort
 * @returns {{
 *   visible: Array<Object>,
 *   totalCount: number,
 *   query: string,
 *   cursor: number,
 *   isFiltering: boolean,
 *   sortMode: 'state'|'name'|'created',
 *   openFilter: Function,
 *   closeFilter: Function,
 *   clearFilter: Function,
 *   cycleSort: Function,
 *   handleFilterKey: Function
 * }}
 */
export function useContainerListView(containers, ctx = {}) {
  const list = Array.isArray(containers) ? containers : [];
  const health = ctx.health;

  // The filter's text and caret. Kept together because the editor edits both.
  const [text, setText] = useState(() => textStateOf(''));
  // Is the field on screen? Enter closes it but keeps the query applied; Esc
  // closes it and clears it (§3.1).
  const [isFiltering, setIsFiltering] = useState(false);
  const [sortMode, setSortMode] = useState('state');

  const query = text.value;

  const visible = useMemo(
    () => sortContainers(filterContainers(list, query), sortMode, { health }),
    [list, query, sortMode, health]
  );

  const openFilter = useCallback(() => setIsFiltering(true), []);
  // Enter: keep the query applied and hand the list its keys back.
  const closeFilter = useCallback(() => setIsFiltering(false), []);
  // Esc: clear the query and close.
  const clearFilter = useCallback(() => {
    setText(textStateOf(''));
    setIsFiltering(false);
  }, []);
  const cycleSort = useCallback(
    () => setSortMode((mode) => nextSortMode(mode)),
    []
  );

  /**
   * Routes a keypress to the filter field. Returns true when the editor
   * consumed the key as text; false for Enter and Esc, which are the keymap's.
   *
   * @param {string} input - Raw Ink input (a char, a paste, or '')
   * @param {import('ink').Key} key - Ink key object
   * @returns {boolean}
   */
  const handleFilterKey = useCallback(
    (input, key) => {
      if (!isFiltering) return false;
      if (key.return || key.escape) return false;
      const { state, handled } = applyKeyToText(text, input, key);
      if (handled && state !== text) setText(state);
      return handled;
    },
    [isFiltering, text]
  );

  return {
    visible,
    totalCount: list.length,
    query,
    cursor: text.cursor,
    isFiltering,
    sortMode,
    openFilter,
    closeFilter,
    clearFilter,
    cycleSort,
    handleFilterKey,
  };
}
