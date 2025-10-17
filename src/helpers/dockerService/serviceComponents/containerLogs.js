import { docker } from "../dockerService";
import { safeCall } from "../../../../src/helpers/safeCall.js";

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
    container.logs({
      follow: true,
      stdout: true,
      stderr: true,
      tail: 100
    }, (err, stream) => {
      if (err) {
        safeCall(onError, err);
        return;
      }
      stream.on('data', chunk => safeCall(onData, chunk.toString()));
      stream.on('end', () => safeCall(onEnd));
      stream.on('error', err => safeCall(onError, err));
    });
  } catch (err) {
    safeCall(onError, err);
  }
}
