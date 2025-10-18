import { logger } from "./logger.js";

/**
 * Call a function safely: if it's a function call it with provided args and
 * catch any errors so they don't bubble to the host application.
 *
 * @param {Function} fn
 * @param  {...any} args
 */
export function safeCall(fn, ...args) {
  if (typeof fn === 'function') {
    try {
      return fn(...args);
    } catch (e) {
      logger.error("safeCall caught error", e);
    }
  }
}
