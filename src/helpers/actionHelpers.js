import { MESSAGE_TIMEOUTS } from "../helpers/constants.js";
import { logger } from "./logger.js";
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
  if (stateCheck) {
    const failureReason = stateCheck(c);
    if (failureReason) {
      logger.warn("Action %s blocked for container %s: %s", actionLabel, c.id, failureReason);
      setMessage(failureReason);
      setMessageColor("red");
      setTimeout(() => setMessage(""), MESSAGE_TIMEOUTS.SHORT);
      return;
    }
  }
  setMessage(`${actionLabel} container...`);
  setMessageColor("green");
  logger.info("Action %s requested for container %s", actionLabel, c.id);
  try {
    await actionFn(c.id);
    setMessage(`${actionLabel} container completed successfully`);
    setMessageColor("green");
    setTimeout(() => setMessage(""), MESSAGE_TIMEOUTS.DEFAULT);
    logger.info("Action %s completed for container %s", actionLabel, c.id);
  } catch (err) {
    setMessage(`Failed to ${actionLabel.toLowerCase()} container.`);
    setMessageColor("red");
    setTimeout(() => setMessage(""), MESSAGE_TIMEOUTS.DEFAULT);
    logger.error("Action %s failed for container %s", actionLabel, c.id, err);
  }
}