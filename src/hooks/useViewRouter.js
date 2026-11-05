import { useCallback, useState } from 'react';
import { STRINGS } from '../helpers/strings.js';

/** @typedef {'containers'|'projects'|'images'} ViewId */

/**
 * @typedef {Object} ViewDefinition
 * @property {ViewId} id
 * @property {string} title
 * @property {boolean} enabled - false = pestaña visible con marcador
 * @property {number} shortcut - 1, 2, 3
 */

/** @type {ViewDefinition[]} */
const VIEWS = [
  {
    id: 'containers',
    title: STRINGS.views.containers,
    enabled: true,
    shortcut: 1,
  },
  {
    id: 'projects',
    title: STRINGS.views.projects,
    enabled: false,
    shortcut: 2,
  },
  {
    id: 'images',
    title: STRINGS.views.images,
    enabled: false,
    shortcut: 3,
  },
];

/**
 * Index of the view after (or before) `current`, wrapping around the list.
 *
 * @param {ViewId} current
 * @param {number} step - +1 for next, -1 for previous
 * @returns {ViewId}
 */
const stepView = (current, step) => {
  const index = VIEWS.findIndex((v) => v.id === current);
  const next = (index + step + VIEWS.length) % VIEWS.length;
  return VIEWS[next].id;
};

/**
 * Track which top-level view is active and move between them.
 *
 * Starts on `containers`. `nextView` / `prevView` cycle through the views in
 * order and wrap around. `setView` jumps straight to a view id and ignores ids
 * that are not in the list. Disabled views are still reachable; `enabled` only
 * tells the UI to mark them.
 *
 * @returns {{view: ViewId, views: ViewDefinition[], setView: (id: ViewId) => void, nextView: () => void, prevView: () => void}}
 */
export function useViewRouter() {
  const [view, setViewState] = useState(/** @type {ViewId} */ ('containers'));

  const setView = useCallback((id) => {
    if (VIEWS.some((v) => v.id === id)) setViewState(id);
  }, []);

  const nextView = useCallback(() => {
    setViewState((current) => stepView(current, 1));
  }, []);

  const prevView = useCallback(() => {
    setViewState((current) => stepView(current, -1));
  }, []);

  return { view, views: VIEWS, setView, nextView, prevView };
}
