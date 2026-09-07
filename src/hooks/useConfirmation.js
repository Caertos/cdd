import { useState, useCallback } from 'react';

/**
 * Generic yes/no confirmation hook.
 * Generalizes the pattern from useEraseConfirmation for reuse across
 * discard confirmation, danger actions, etc.
 *
 * @param {Object} params
 * @param {Function} params.onConfirm - Called when the user confirms (y/s).
 * @param {Function} params.onCancel  - Called when the user cancels (n/Escape).
 * @param {string[]} [params.yesKeys=['y','Y']] - Keys that accept.
 * @returns {{ active: boolean, start: Function, processKey: Function }}
 */
export function useConfirmation({
  onConfirm,
  onCancel,
  yesKeys = ['y', 's', 'Y', 'S'],
} = {}) {
  const [active, setActive] = useState(false);

  const start = useCallback(() => {
    setActive(true);
  }, []);

  const processKey = useCallback(
    (input, key) => {
      if (yesKeys.includes(input)) {
        onConfirm?.();
        setActive(false);
        return;
      }

      if (input === 'n' || input === 'N' || key?.escape) {
        onCancel?.();
        setActive(false);
        return;
      }
    },
    [onConfirm, onCancel, yesKeys]
  );

  return { active, start, processKey };
}
