import { spawn } from "child_process";

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
