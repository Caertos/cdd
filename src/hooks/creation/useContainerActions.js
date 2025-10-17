import { useState } from "react";
import { safeCall } from "../../helpers/safeCall.js";
import { startContainer as svcStartContainer, stopContainer as svcStopContainer, restartContainer as svcRestartContainer, removeContainer as svcRemoveContainer } from "../../helpers/dockerService/serviceComponents/containerActions.js";

/**
 * Custom hook to manage container actions (start, stop, restart, remove).
 * Handles feedback messages and exposes helpers for each action.
 *
 * @param {Object} params
 * @param {Array} params.containers - List of containers
 * @param {Function} params.onAction - Callback after action is performed
 * @returns {Object} Action helpers and feedback state
 */
export function useContainerActions({ containers, onAction }) {
  const [message, setMessage] = useState("");
  const [messageColor, setMessageColor] = useState("yellow");

  /**
   * Handles a generic container action and sets feedback.
   * @param {Function} actionFn - The async action function (start, stop, etc)
   * @param {string} actionLabel - Action label for feedback
   * @param {number} selected - Index of selected container
   * @param {Function} [stateCheck] - Optional function to check state before action
   */
  async function handleAction({ actionFn, actionLabel, selected, stateCheck }) {
    const container = containers[selected];
    if (!container) return;
    if (stateCheck) {
      const checkMsg = stateCheck(container);
      if (checkMsg) {
        setMessage(checkMsg);
        setMessageColor("yellow");
        return;
      }
    }
    setMessage(`${actionLabel} container...`);
    setMessageColor("yellow");
    try {
      await actionFn(container.id);
  setMessage(`${actionLabel} container successful.`);
  setMessageColor("green");
  safeCall(onAction);
    } catch (err) {
      setMessage(`Failed to ${actionLabel.toLowerCase()} container: ${err.message}`);
      setMessageColor("red");
    }
  }

  return {
    message,
    setMessage,
    messageColor,
    setMessageColor,
    handleAction,
    // Expose concrete actions so callers can use actions.startContainer(id)
    startContainer: async (id) => {
      return await svcStartContainer(id);
    },
    stopContainer: async (id) => {
      return await svcStopContainer(id);
    },
    restartContainer: async (id) => {
      return await svcRestartContainer(id);
    },
    removeContainer: async (id) => {
      return await svcRemoveContainer(id);
    },
  };
}
