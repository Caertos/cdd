import { useState, useCallback } from 'react';

/**
 * Hook to manage the erase confirmation dialog flow.
 *
 * Encapsulates the `confirmErase` state and the input handler that resolves it.
 * The caller is responsible for what happens on confirm/cancel via the callbacks.
 *
 * @param {Object} params
 * @param {Function} params.onConfirm - Called when the user presses y/Y. Should trigger the erase action.
 * @param {Function} params.onCancel  - Called when the user presses n/N or Escape. Should clean up messages.
 * @returns {{ confirmErase: boolean, startErase: Function, processEraseConfirmation: Function }}
 */
export function useEraseConfirmation({ onConfirm, onCancel }) {
  const [confirmErase, setConfirmErase] = useState(false);

  const startErase = useCallback(() => {
    setConfirmErase(true);
  }, []);

  const processEraseConfirmation = useCallback(
    (input, key) => {
      if (input === 'y' || input === 'Y') {
        onConfirm();
        setConfirmErase(false);
        return;
      }

      if (input === 'n' || input === 'N' || key.escape) {
        setConfirmErase(false);
        onCancel();
        return;
      }
    },
    [onConfirm, onCancel]
  );

  return { confirmErase, startErase, processEraseConfirmation };
}
