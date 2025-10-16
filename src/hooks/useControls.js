import React, { useState, useRef } from "react";
import { useInput } from "ink";
import {
  startContainer,
  stopContainer,
  restartContainer,
  createContainer,
} from "../helpers/dockerService/serviceComponents/containerActions";
import { getLogsStream } from "../helpers/dockerService/serviceComponents/containerLogs";
import { handleAction } from "../helpers/actionHelpers";
import { exitWithMessage } from "../helpers/exitWithMessage";

export function useControls(containers = []) {
  const [selected, setSelected] = useState(0);
  const [message, setMessage] = useState("");
  const [messageColor, setMessageColor] = useState("yellow");
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState([]);
  const [creatingContainer, setCreatingContainer] = useState(false);
  const [imageNameInput, setImageNameInput] = useState("");
  const [containerNameInput, setContainerNameInput] = useState("");
  const [portInput, setPortInput] = useState("");
  const [envInput, setEnvInput] = useState("");
  const [creationStep, setCreationStep] = useState(0); // 0: imagen, 1: nombre, 2: puertos, 3: env
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


  useInput(async (input, key) => {
    if (showLogs) {
      if (input === "q" || key.escape) {
        exitLogs();
      }
      return;
    }

    // Flujo interactivo de creación de contenedor
    if (creatingContainer) {
      if (key.escape) {
        setCreatingContainer(false);
        setImageNameInput("");
        setContainerNameInput("");
        setPortInput("");
        setEnvInput("");
        setCreationStep(0);
        setMessage("Creación cancelada");
        setMessageColor("yellow");
        return;
      }
      if (input === "\r") {
        if (creationStep === 0) {
          if (!imageNameInput.trim()) {
            setMessage("El nombre de la imagen no puede estar vacío.");
            setMessageColor("red");
            return;
          }
          setCreationStep(1);
          setMessage("Opcional: Ingresa el nombre del contenedor o deja vacío y presiona Enter");
          setMessageColor("yellow");
          return;
        }
        if (creationStep === 1) {
          setCreationStep(2);
          setMessage("Opcional: Ingresa puertos (formato 8080:80,443:443) o deja vacío y presiona Enter");
          setMessageColor("yellow");
          return;
        }
        if (creationStep === 2) {
          setCreationStep(3);
          setMessage("Opcional: Ingresa variables de entorno (formato VAR1=val1,VAR2=val2) o deja vacío y presiona Enter");
          setMessageColor("yellow");
          return;
        }
        if (creationStep === 3) {
          // Procesar opciones
          let options = {};
          // Nombre del contenedor
          if (containerNameInput.trim()) {
            options.name = containerNameInput.trim();
          }
          // Puertos
          if (portInput.trim()) {
            const ports = portInput.split(",").map(p => p.trim()).filter(Boolean);
            options.ExposedPorts = {};
            options.HostConfig = { PortBindings: {} };
            ports.forEach(pair => {
              const [host, cont] = pair.split(":");
              if (host && cont) {
                options.ExposedPorts[`${cont}/tcp`] = {};
                options.HostConfig.PortBindings[`${cont}/tcp`] = [{ HostPort: host }];
              }
            });
          }
          // Variables de entorno
          if (envInput.trim()) {
            options.Env = envInput.split(",").map(e => e.trim()).filter(Boolean);
          }
          setMessage("Creando contenedor...");
          setMessageColor("yellow");
          try {
            const id = await createContainer(imageNameInput.trim(), options);
            setMessage(`Contenedor creado con ID: ${id}`);
            setMessageColor("green");
          } catch (err) {
            setMessage(`Error: ${err.message}`);
            setMessageColor("red");
          }
          setTimeout(() => {
            setCreatingContainer(false);
            setImageNameInput("");
            setContainerNameInput("");
            setPortInput("");
            setEnvInput("");
            setCreationStep(0);
          }, 2500);
          return;
        }
      } else if (input === "\u007F") { // Backspace
        if (creationStep === 0) setImageNameInput(prev => prev.slice(0, -1));
        if (creationStep === 1) setContainerNameInput(prev => prev.slice(0, -1));
        if (creationStep === 2) setPortInput(prev => prev.slice(0, -1));
        if (creationStep === 3) setEnvInput(prev => prev.slice(0, -1));
      } else {
        if (creationStep === 0) setImageNameInput(prev => prev + input);
        if (creationStep === 1) setContainerNameInput(prev => prev + input);
        if (creationStep === 2) setPortInput(prev => prev + input);
        if (creationStep === 3) setEnvInput(prev => prev + input);
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
        stateCheck: (c) =>
          (c.state === "running" || c.status === "running") &&
          "Container is already running.",
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
        stateCheck: (c) =>
          (c.state === "exited" ||
            c.status === "exited" ||
            c.state === "stopped" ||
            c.status === "stopped") &&
          "Container is already stopped.",
      });
    }
    if (input === "r") {
      handleAction({
        containers,
        selected,
        actionFn: restartContainer,
        actionLabel: "Restarting",
        setMessage,
        setMessageColor,
      });
    }
    if (input === "l" && containers[selected]) {
      setShowLogs(true);
      setLogs([]);
      getLogsStream(
        containers[selected].id,
        (data) =>
          setLogs((prev) => [...prev, ...data.split("\n").filter(Boolean)]),
        () => {},
        (err) => setLogs((prev) => [...prev, `Error: ${err.message}`])
      );
      return {
        selected,
        setSelected,
        message,
        messageColor,
        showLogs,
        logs,
        exitLogs,
      };
    }

    if (input === "c") {
      setCreatingContainer(true);
      setImageNameInput("");
      setPortInput("");
      setEnvInput("");
      setCreationStep(0);
      setMessage("Ingresa el nombre de la imagen Docker y presiona Enter");
      setMessageColor("yellow");
    }
  });

  return {
    selected,
    setSelected,
    message,
    messageColor,
    showLogs,
    logs,
    exitLogs,
    creatingContainer,
    imageNameInput,
    containerNameInput,
    portInput,
    envInput,
    creationStep,
  };
}
