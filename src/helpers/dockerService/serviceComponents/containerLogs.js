import { docker } from "../dockerService";

/**
 * Return a stream of logs from a container and call callbacks for events.
 *
 * @param {string} containerId - Docker container id
 * @param {Function} onData - Called with chunk string when data arrives
 * @param {Function} onEnd - Called when stream ends
 * @param {Function} onError - Called on error
 */
export function getLogsStream(containerId, onData, onEnd, onError) {
  const container = docker.getContainer(containerId);
  container.logs({
    follow: true,
    stdout: true,
    stderr: true,
    tail: 100
  }, (err, stream) => {
    if (err) {
      onError?.(err);
      return;
    }
    stream.on('data', chunk => onData?.(chunk.toString()));
    stream.on('end', () => onEnd?.());
    stream.on('error', err => onError?.(err));
  });
}
