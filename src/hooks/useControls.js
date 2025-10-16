import React from "react";
import { useContainerActions } from "./creation/useContainerActions";
import { useContainerCreation } from "./creation/useContainerCreation";
import { useLogsViewer } from "./creation/useLogsViewer";
import { useInput } from "ink";
import { getLogsStream } from "../helpers/dockerService/serviceComponents/containerLogs.js";
import { createContainer as svcCreateContainer } from "../helpers/dockerService/serviceComponents/containerActions.js";

// Principal hook to manage user inputs and control the app state
/**
 * Main hook that wires user input, creation, actions and logs viewing.
 * It coordinates the modular hooks and exposes a compact API consumed by the App.
 *
 * @param {Array<Object>} containers - Current list of Docker containers
 * @returns {Object} controls - API for the App component
 * @property {number} selected - Index of the currently selected container
 * @property {function} setSelected - Setter for selected index
 * @property {string} message - Current feedback message (creation or actions)
 * @property {string} messageColor - Color to show for the feedback message
 * @property {boolean} showLogs - Whether the logs viewer is active
 * @property {Array<string>} logs - Array of log lines currently collected
 * @property {function} exitLogs - Helper to close the logs viewer
 * @property {boolean} creatingContainer - Whether the create-container prompt is open
 * @property {number} creationStep - Current step in the creation flow
 * @property {string} imageNameInput - Current value of the image name field
 * @property {string} containerNameInput - Current value of the container name field
 * @property {string} portInput - Current value of the port input field
 * @property {string} envInput - Current value of the env input field
 * @property {Object} creation - The creation hook API (setters and helpers)
 * @property {Object} actions - The actions hook API (helpers to start/stop/remove)
 * @property {Object} logsViewer - The logs viewer hook API
 */
export function useControls(containers = []) {
  const [selected, setSelected] = React.useState(0);
  const [creatingContainer, setCreatingContainer] = React.useState(false);
  const [confirmErase, setConfirmErase] = React.useState(false);
  const total = containers.length;

  // Modular hooks
  const actions = useContainerActions({ containers });
  const creation = useContainerCreation({
    onCreate: async ({ imageName, containerName, portInput, envInput }) => {
      // Build Docker options
      const env = (envInput || "").split(",").map(s => s.trim()).filter(Boolean);
      const ports = (portInput || "").split(",").map(s => s.trim()).filter(Boolean);
      const ExposedPorts = {};
      const PortBindings = {};
      ports.forEach(pair => {
        const [host, cont] = pair.split(":");
        if (!host || !cont) return;
        const key = `${cont}/tcp`;
        ExposedPorts[key] = {};
        PortBindings[key] = PortBindings[key] || [];
        PortBindings[key].push({ HostPort: `${host}` });
      });

      const options = {
        Tty: true,
      };
      if (Object.keys(ExposedPorts).length) options.ExposedPorts = ExposedPorts;
      if (Object.keys(PortBindings).length) options.HostConfig = { PortBindings };
      if (env.length) options.Env = env;
      if (containerName) options.name = containerName;

  actions.setMessage(`Creating container ${imageName}...`);
  actions.setMessageColor("yellow");
      try {
        const id = await svcCreateContainer(imageName, options);
        actions.setMessage(`Created container ${id}`);
        actions.setMessageColor("green");
      } catch (err) {
        actions.setMessage(`Error creating container: ${err.message}`);
        actions.setMessageColor("red");
      } finally {
        setCreatingContainer(false);
      }
    },
    onCancel: () => setCreatingContainer(false),
    dbImages: ["mysql", "mariadb", "postgres", "mongo", "mssql", "redis"]
  });
  const logsViewer = useLogsViewer();

  // Handler to exit logs (delegated to logsViewer)
  const exitLogs = logsViewer.closeLogs;

  useInput((input, key) => {
  // Erase confirmation
    if (confirmErase) {
      if (input === "y" || input === "Y") {
        actions.handleAction({
          actionFn: async (id) => await actions.removeContainer(id),
          actionLabel: "Erasing",
          selected,
        });
        setConfirmErase(false);
        actions.setMessageColor("yellow");
        return;
      } else if (input === "n" || input === "N" || key.escape) {
        setConfirmErase(false);
        actions.setMessage("");
        actions.setMessageColor("");
        return;
      } else {
        actions.setMessage("Are you sure you want to erase this container? (y/n)");
        actions.setMessageColor("yellow");
        return;
      }
    }

    // Logs viewer
    if (logsViewer.showLogs) {
      if (input === "q" || key.escape) {
        logsViewer.closeLogs();
      }
      return;
    }

    // Container creation flow: delegate input to creation hook
    if (creatingContainer) {
      const step = creation.step;
      const appendCharToField = (setter, value, ch) => {
        setter((value || "") + ch);
      };
      // Escape -> cancel
      if (key.escape) {
        creation.cancelCreation();
        setCreatingContainer(false);
        return;
      }
      // Enter -> next step
      if (input === "\r" || input === "\n") {
        creation.nextStep();
        return;
      }
      // Backspace/Delete support
      if (key.backspace || key.delete) {
        if (step === 0) creation.setImageName((v) => (v || "").slice(0, -1));
        if (step === 1) creation.setContainerName((v) => (v || "").slice(0, -1));
        if (step === 2) creation.setPortInput((v) => (v || "").slice(0, -1));
        if (step === 3) creation.setEnvInput((v) => (v || "").slice(0, -1));
        return;
      }
      // Printable character input (append)
      if (input && input.length === 1 && !key.ctrl && !key.meta) {
        if (step === 0) appendCharToField(creation.setImageName, creation.imageName, input);
        if (step === 1) appendCharToField(creation.setContainerName, creation.containerName, input);
        if (step === 2) appendCharToField(creation.setPortInput, creation.portInput, input);
        if (step === 3) appendCharToField(creation.setEnvInput, creation.envInput, input);
        return;
      }
      // Otherwise ignore
      return;
    }

    //==========================================================
    // Menu Navigation
    //==========================================================
    if (key.upArrow && total > 0) setSelected((i) => (i === 0 ? total - 1 : i - 1));
    if (key.downArrow && total > 0) setSelected((i) => (i === total - 1 ? 0 : i + 1));
    if (input === "q") {
      actions.setMessage("Exiting...");
      actions.setMessageColor("yellow");
      setTimeout(() => process.exit(0), 500);
      return;
    }

    //==========================================================
    // Docker commands
    //==========================================================
    if (input === "i") {
      actions.handleAction({
        actionFn: async (id) => await actions.startContainer(id),
        actionLabel: "Starting",
        selected,
        stateCheck: (c) => (c.state === "running" || c.status === "running") && "Container is already running."
      });
    }
    if (input === "p") {
      actions.handleAction({
        actionFn: async (id) => await actions.stopContainer(id),
        actionLabel: "Stopping",
        selected,
        stateCheck: (c) => (c.state === "exited" || c.status === "exited" || c.state === "stopped" || c.status === "stopped") && "Container is already stopped."
      });
    }
    if (input === "r") {
      actions.handleAction({
        actionFn: async (id) => await actions.restartContainer(id),
        actionLabel: "Restarting",
        selected,
      });
    }
    if (input === "e" && containers[selected]) {
      setConfirmErase(true);
      actions.setMessage("Are you sure you want to erase this container? (y/n)");
      actions.setMessageColor("yellow");
      return;
    }
    if (input === "l" && containers[selected]) {
      logsViewer.openLogs();
      getLogsStream(
        containers[selected].id,
        (data) => logsViewer.setLogs((prev) => [...prev, ...data.split("\n").filter(Boolean)]),
        () => {},
        (err) => logsViewer.setLogs((prev) => [...prev, `Error: ${err.message}`])
      );
      return;
    }
    if (input === "c") {
      setCreatingContainer(true);
      creation.setStep(0);
      creation.setImageName("");
      creation.setContainerName("");
      creation.setPortInput("");
      creation.setEnvInput("");
      creation.setMessage("Insert the name of the image to create: ");
      creation.setMessageColor("yellow");
    }
  });

  return {
    selected,
    setSelected,
    // Map messaging to creation when creating, otherwise to actions
    message: creatingContainer ? creation.message : actions.message,
    messageColor: creatingContainer ? creation.messageColor : actions.messageColor,
    showLogs: logsViewer.showLogs,
    logs: logsViewer.logs,
    exitLogs,
    creatingContainer,
    // Expose creation fields in the shape App expects
    creationStep: creation.step,
    imageNameInput: creation.imageName,
    containerNameInput: creation.containerName,
    portInput: creation.portInput,
    envInput: creation.envInput,
    creation,
    actions,
    logsViewer,
    confirmErase,
  };
}
