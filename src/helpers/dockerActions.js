/**
 * Run a Docker action by name (start, stop, remove).
 * Ejecuta una acción Docker por nombre (start, stop, remove).
 *
 * @param {string} action - Action to perform / Acción a realizar
 * @param {string} container - Container name / Nombre del contenedor
 * @returns {Promise<boolean>} True if successful / True si es exitoso
 * @throws {Error} If Docker is not running / Si Docker no está corriendo
 * @example
 * // EN: Start a container
 * // ES: Iniciar un contenedor
 * await runDockerAction('start', 'my_container');
 */
import { spawn } from "child_process";

/**
 * Ejecuta una acción de Docker sobre un contenedor y maneja feedback visual.
 * @param {Object} params
 * @param {Array} params.containers - Lista de contenedores.
 * @param {number} params.selected - Índice del contenedor seleccionado.
 * @param {string} params.action - Acción docker (start, stop, restart).
 * @param {string} params.actionLabel - Texto para feedback (Starting, Stopping, etc).
 * @param {Function} params.setMessage - Setter de mensaje visual.
 * @param {Function} params.setMessageColor - Setter de color del mensaje.
 */
export function handleDockerAction({ containers, selected, action, actionLabel, setMessage, setMessageColor }) {
  if (containers[selected]) {
    const c = containers[selected];
    const id = c.id || c.name;
    // Validación de estado
    if (action === "start" && (c.state === "running" || c.status === "running")) {
      setMessage("Container is already running.");
      setMessageColor("red");
      setTimeout(() => setMessage(""), 2000);
      return;
    }
    if (action === "stop" && (c.state === "exited" || c.status === "exited" || c.state === "stopped" || c.status === "stopped")) {
      setMessage("Container is already stopped.");
      setMessageColor("red");
      setTimeout(() => setMessage(""), 2000);
      return;
    }
    setMessage(`${actionLabel} container...`);
    setMessageColor("green");
    const child = spawn("docker", [action, id]);
    child.on("close", () => {
      setMessage(`${actionLabel} container...`);
      setMessageColor("green");
      setTimeout(() => setMessage(""), 3000);
    });
  }
}