/**
 * Supported log levels in ascending verbosity.
 * Lower numeric values represent higher severity.
 */
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

function parseLevel(value) {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized in LOG_LEVELS) {
    return LOG_LEVELS[normalized];
  }
  return null;
}

const envLevel =
  parseLevel(process.env.CDD_LOG_LEVEL) ??
  parseLevel(process.env.LOG_LEVEL) ??
  LOG_LEVELS.info;

const currentLevel = typeof envLevel === "number" ? envLevel : LOG_LEVELS.info;

const listeners = new Set();

function shouldLog(level) {
  const target = LOG_LEVELS[level];
  return typeof target === "number" && target <= currentLevel;
}

function log(level, message, ...args) {
  if (!shouldLog(level)) {
    return;
  }

  const timestamp = new Date().toISOString();
  const upperLevel = level.toUpperCase();
  const formatted = `[${timestamp}] [${upperLevel}] ${message}`;
  const entry = { level, message, args, timestamp, formatted };

  const shouldWriteToConsole =
    listeners.size === 0 || level === "error" || level === "warn";

  if (shouldWriteToConsole) {
    const method = level === "debug" ? "log" : level;
    if (typeof console[method] === "function") {
      console[method](formatted, ...args);
    } else {
      console.log(formatted, ...args);
    }
  }

  listeners.forEach((listener) => {
    try {
      listener(entry);
    } catch (err) {
      // Ignore listener errors so logging remains resilient.
    }
  });
}

/**
 * Shared logger instance with leveled output and in-memory subscriptions.
 * Consumers can import `{ logger }` to emit messages or to listen for
 * log entries (used by the CLI debug panel).
 */
export const logger = {
  debug(message, ...args) {
    log("debug", message, ...args);
  },
  info(message, ...args) {
    log("info", message, ...args);
  },
  warn(message, ...args) {
    log("warn", message, ...args);
  },
  error(message, ...args) {
    log("error", message, ...args);
  },
  /**
   * Subscribe to log events.
   *
   * @param {(entry: { level: string, message: string, args: any[], timestamp: string, formatted: string }) => void} listener
   * Listener invoked for every log entry that passes the current level filter.
   * @returns {Function} Cleanup function that removes the listener when called.
   */
  subscribe(listener) {
    if (typeof listener !== "function") {
      return () => {};
    }
    listeners.add(listener);
    return () => listeners.delete(listener);
  }
};
