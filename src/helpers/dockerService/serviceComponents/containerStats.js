import { docker } from "../dockerService";

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
