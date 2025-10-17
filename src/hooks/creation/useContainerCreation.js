import { useState } from "react";
import { validatePorts } from "../../helpers/validationHelpers.js";
import { safeCall } from "../../helpers/safeCall";

/**
 * Custom hook to manage the container creation flow, step by step.
 * Handles input, validation, and feedback for each creation step.
 *
 * @param {Object} params
 * @param {Function} params.onCreate - Callback when creation is confirmed
 * @param {Function} params.onCancel - Callback when creation is cancelled
 * @param {Array<string>} params.dbImages - List of DB image names for env var warning
 * @returns {Object} Creation state, setters, and helpers
 */
export function useContainerCreation({ onCreate, onCancel, dbImages = [] }) {
  const [step, setStep] = useState(0); // 0: image, 1: name, 2: ports, 3: env
  const [imageName, setImageName] = useState("");
  const [containerName, setContainerName] = useState("");
  const [portInput, setPortInput] = useState("");
  const [envInput, setEnvInput] = useState("");
  const [message, setMessage] = useState("");
  const [messageColor, setMessageColor] = useState("yellow");

  /**
   * Advances to the next step, with validation and feedback.
   */
  function nextStep() {
    if (step === 0) {
      if (!imageName.trim()) {
        setMessage("Image name cannot be empty.");
        setMessageColor("red");
        return;
      }
      setStep(1);
      setMessage("Optional: Enter container name or leave empty and press Enter");
      setMessageColor("yellow");
      return;
    }
    if (step === 1) {
      setStep(2);
      setMessage("Optional: Enter ports (format 8080:80,443:443) or leave empty and press Enter");
      setMessageColor("yellow");
      return;
    }
    if (step === 2) {
      // Ports are now optional - only validate if provided
      if (portInput.trim() && !validatePorts(portInput)) {
        setMessage("Port format must be host:container and both must be numbers (e.g. 8080:80)");
        setMessageColor("red");
        return;
      }
      setStep(3);
      const isDb = dbImages.some(db => imageName.trim().toLowerCase().includes(db));
      if (isDb) {
        setMessage("Warning: This image usually requires environment variables (e.g. MYSQL_ROOT_PASSWORD=my-secret-pw for MySQL, POSTGRES_PASSWORD=yourpassword for Postgres). Enter them as VAR=val,VAR2=val2 or leave empty and press Enter.");
        setMessageColor("yellow");
      } else {
        setMessage("Optional: Enter environment variables (format VAR1=val1,VAR2=val2) or leave empty and press Enter");
        setMessageColor("yellow");
      }
      return;
    }
    if (step === 3) {
      // Final step: call onCreate with all data (safely)
      safeCall(onCreate, { imageName, containerName, portInput, envInput });
    }
  }

  /**
   * Cancels the creation process and resets state.
   */
  function cancelCreation() {
    setStep(0);
    setImageName("");
    setContainerName("");
    setPortInput("");
    setEnvInput("");
    setMessage("");
    setMessageColor("yellow");
    safeCall(onCancel);
  }

  return {
    step,
    setStep,
    imageName,
    setImageName,
    containerName,
    setContainerName,
    portInput,
    setPortInput,
    envInput,
    setEnvInput,
    message,
    setMessage,
    messageColor,
    setMessageColor,
    nextStep,
    cancelCreation,
  };
}
