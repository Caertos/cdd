
import React, { useState, useRef } from "react";
import { useInput } from "ink";
import { startContainer, stopContainer, restartContainer, getLogsStream } from "../helpers/dockerService";
import { handleAction } from "../helpers/actionHelpers";
import { exitWithMessage } from "../helpers/exitWithMessage";


export function useControls(containers = []) {
  const [selected, setSelected] = useState(0);
  const [message, setMessage] = useState("");
  const [messageColor, setMessageColor] = useState("yellow");
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState([]);
  const logsStreamRef = useRef(null);
  const total = containers.length;

  // Handler para salir de la vista de logs
  const exitLogs = () => {
    setShowLogs(false);
    setLogs([]);
    if (logsStreamRef.current) {
      logsStreamRef.current.destroy?.();
      logsStreamRef.current = null;
    }
  };

  useInput((input, key) => {
    if (showLogs) {
      if (input === "q" || key.escape) {
        exitLogs();
      }
      return;
    }

    //==========================================================
    // Menu Navigation
    //==========================================================
    if (key.upArrow && total > 0) {
      setSelected((i) => (i === 0 ? total - 1 : i - 1));
    }
    if (key.downArrow && total > 0) {
      setSelected((i) => (i === total - 1 ? 0 : i + 1));
    }
    if (input === "q") {
      exitWithMessage({ setMessage, setMessageColor });
      return;
    }

    //==========================================================
    // Docker commands
    //==========================================================
    if (input === "i") {
      handleAction({
        containers,
        selected,
        actionFn: startContainer,
        actionLabel: "Starting",
        setMessage,
        setMessageColor,
        stateCheck: c => (c.state === "running" || c.status === "running") && "Container is already running."
      });
    }
    if (input === "p") {
      handleAction({
        containers,
        selected,
        actionFn: stopContainer,
        actionLabel: "Stopping",
        setMessage,
        setMessageColor,
        stateCheck: c => ((c.state === "exited" || c.status === "exited" || c.state === "stopped" || c.status === "stopped") && "Container is already stopped.")
      });
    }
    if (input === "r") {
      handleAction({
        containers,
        selected,
        actionFn: restartContainer,
        actionLabel: "Restarting",
        setMessage,
        setMessageColor
      });
    }
    if (input === "l" && containers[selected]) {
      setShowLogs(true);
      setLogs([]);
      getLogsStream(
        containers[selected].id,
        (data) => setLogs((prev) => ([...prev, ...data.split("\n").filter(Boolean)])),
        () => {},
        (err) => setLogs((prev) => ([...prev, `Error: ${err.message}`]))
      );
    }
  });

  return { selected, setSelected, message, messageColor, showLogs, logs, exitLogs };
}
