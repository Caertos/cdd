import { MESSAGE_TIMEOUTS } from "../helpers/constants";
/**
 * Generic helper to perform a container action with user feedback.
 *
 * @param {Object} params
 * @param {Array} params.containers - Array of container objects
 * @param {number} params.selected - Index of the selected container
 * @param {Function} params.actionFn - Async function that performs the action (receives container id)
 * @param {string} params.actionLabel - Label used in feedback messages (e.g. 'Starting')
 * @param {Function} params.setMessage - Setter for feedback message
 * @param {Function} params.setMessageColor - Setter for feedback color
 * @param {Function} [params.stateCheck] - Optional function that validates container state before action
 * @returns {Promise<void>}
 */
export async function handleAction({
  containers,
  selected,
  actionFn,
  actionLabel,
  setMessage,
  setMessageColor,
  stateCheck
}) {
  const c = containers[selected];
  if (!c) return;
  if (stateCheck && stateCheck(c)) {
    setMessage(stateCheck(c));
    setMessageColor("red");
    setTimeout(() => setMessage(""), MESSAGE_TIMEOUTS.SHORT);
    return;
  }
  setMessage(`${actionLabel} container...`);
  setMessageColor("green");
  try {
    await actionFn(c.id);
    setMessage(`${actionLabel} container completed successfully`);
    setMessageColor("green");
    setTimeout(() => setMessage(""), MESSAGE_TIMEOUTS.DEFAULT);
  } catch (err) {
    setMessage(`Failed to ${actionLabel.toLowerCase()} container.`);
    setMessageColor("red");
    setTimeout(() => setMessage(""), MESSAGE_TIMEOUTS.DEFAULT);
  }
}