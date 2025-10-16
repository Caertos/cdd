import { docker } from "../dockerService";

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
