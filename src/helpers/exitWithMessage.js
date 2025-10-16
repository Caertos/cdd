import { spawn } from "child_process";

/**
 * Show an exit message using provided setters, clear the terminal and exit after a delay.
 *
 * @param {Object} params
 * @param {Function} params.setMessage - Setter for message text
 * @param {Function} params.setMessageColor - Setter for message color
 * @param {string} [params.message] - Message to display
 * @param {string} [params.color] - Color for the message
 * @param {number} [params.delay] - Delay in milliseconds before exiting
 */
export function exitWithMessage({ setMessage, setMessageColor, message = "Exiting...", color = "yellow", delay = 1500 }) {
  setMessage(message);
  setMessageColor(color);
  setTimeout(() => {
    setMessage("");
    if (process.platform === "win32") {
      spawn("cmd", ["/c", "cls"], { stdio: "inherit" });
    } else {
      spawn("clear", [], { stdio: "inherit" });
    }
    process.exit();
  }, delay);
}
