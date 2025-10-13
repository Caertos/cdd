/**
 * Utility to interact with Docker CLI.
 * Utilidad para interactuar con el CLI de Docker.
 *
 * @param {string} cmd - Docker command / Comando Docker
 * @returns {Promise<string>} Output from Docker / Salida de Docker
 * @throws {Error} If command fails / Si el comando falla
 * @example
 * // EN: Run a Docker command
 * // ES: Ejecutar un comando Docker
 * await dockerService('ps -a');
 */

import Docker from "dockerode";
const docker = new Docker({ socketPath: "/var/run/docker.sock" });

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

export async function startContainer(containerId) {
  const container = docker.getContainer(containerId);
  await container.start();
}

export async function stopContainer(containerId) {
  const container = docker.getContainer(containerId);
  await container.stop();
}

export async function restartContainer(containerId) {
  const container = docker.getContainer(containerId);
  await container.restart();
}

export async function getContainers() {
  const containers = await docker.listContainers({ all: true });
  return containers.map((container) => ({
    id: container.Id,
    name: container.Names[0].replace("/", ""),
    image: container.Image,
    state: container.State,
    status: container.Status,
    ports:
      [
        ...new Set(
          container.Ports.filter((port) => port.PublicPort).map(
            (port) => `${port.PublicPort}:${port.PrivatePort}`
          )
        ),
      ]
  }));
}

export async function getStats(containerId) {
  const container = docker.getContainer(containerId);
  const stream = await container.stats({ stream: false });

  const cpuDelta =
    stream.cpu_stats.cpu_usage.total_usage -
    stream.precpu_stats.cpu_usage.total_usage;
  const systemDelta =
    stream.cpu_stats.system_cpu_usage - stream.precpu_stats.system_cpu_usage;
  const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * 100 : 0;

  const memUsage = stream.memory_stats.usage || 0;
  const memLimit = stream.memory_stats.limit || 1;
  const memPercent = (memUsage / memLimit) * 100;

  const rx = stream.networks
    ? Object.values(stream.networks)
        .map((n) => n.rx_bytes)
        .reduce((a, b) => a + b, 0)
    : 0;
  const tx = stream.networks
    ? Object.values(stream.networks)
        .map((n) => n.tx_bytes)
        .reduce((a, b) => a + b, 0)
    : 0;

  return {
    cpuPercent: cpuPercent.toFixed(1),
    memPercent: memPercent.toFixed(1),
    netIO: { rx, tx },
  };
}
