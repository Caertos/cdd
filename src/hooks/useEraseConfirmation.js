import { useConfirmation } from './useConfirmation.js';

/**
 * Hook to manage the erase confirmation dialog flow.
 * Now delegates to the generic useConfirmation hook.
 *
 * @param {Object} params
 * @param {Function} params.onConfirm - Called when the user presses y/Y.
 * @param {Function} params.onCancel  - Called when the user presses n/N or Escape.
 * @returns {{ confirmErase: boolean, startErase: Function, processEraseConfirmation: Function }}
 */
export function useEraseConfirmation({ onConfirm, onCancel }) {
  const { active, start, processKey } = useConfirmation({
    onConfirm,
    onCancel,
    yesKeys: ['y', 'Y'],
  });

  return {
    confirmErase: active,
    startErase: start,
    processEraseConfirmation: processKey,
  };
}
