import { docker } from "../dockerService.js";
import { safeCall } from "../../safeCall.js";
import { logger } from "../../logger.js";

/**
 * Return a stream of logs from a container and call callbacks for events.
 *
 * @param {string} containerId - Docker container id
 * @param {Function} onData - Called with chunk string when data arrives
 * @param {Function} onEnd - Called when stream ends
 * @param {Function} onError - Called on error
 */
export function getLogsStream(containerId, onData, onEnd, onError) {
  // Use shared safeCall util to call optional callbacks safely

  try {
    const container = docker.getContainer(containerId);
    logger.debug("Opening logs stream for container %s", containerId);
    container.logs({
      follow: true,
      stdout: true,
      stderr: true,
      tail: 100
    }, (err, stream) => {
      if (err) {
        logger.error("Failed to open logs stream for container %s", containerId, err);
        safeCall(onError, err);
        return;
      }
      logger.info("Logs stream established for container %s", containerId);
      stream.on('data', chunk => safeCall(onData, chunk.toString()));
      stream.on('end', () => {
        logger.debug("Logs stream ended for container %s", containerId);
        safeCall(onEnd);
      });
      stream.on('error', streamErr => {
        logger.error("Logs stream error for container %s", containerId, streamErr);
        safeCall(onError, streamErr);
      });
    });
  } catch (err) {
    logger.error("Unexpected error while opening logs stream for container %s", containerId, err);
    safeCall(onError, err);
  }
}
