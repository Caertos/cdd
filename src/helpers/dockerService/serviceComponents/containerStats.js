import { docker } from "../dockerService.js";
import { logger } from "../../logger.js";

/**
 * Retrieve a snapshot of container resource usage (CPU, memory, network).
 *
 * @param {string} containerId - Docker container id
 * @returns {Promise<Object>} Object with cpuPercent, memPercent and netIO {rx,tx}
 */
export async function getStats(containerId) {
  const container = docker.getContainer(containerId);
  logger.debug("Fetching stats for container %s", containerId);
  let stream;
  try {
    stream = await container.stats({ stream: false });
  } catch (err) {
    logger.error("Failed to fetch stats for container %s", containerId, err);
    throw err;
  }

  const cpuDelta =
    stream.cpu_stats.cpu_usage.total_usage -
    stream.precpu_stats.cpu_usage.total_usage;
  const systemDelta =
    stream.cpu_stats.system_cpu_usage - stream.precpu_stats.system_cpu_usage;
  
  // Get number of CPUs for proper normalization
  let numCpus = 1;
  if (typeof stream.cpu_stats.online_cpus === 'number' && stream.cpu_stats.online_cpus > 0) {
    numCpus = stream.cpu_stats.online_cpus;
  } else if (
    stream.cpu_stats.cpu_usage &&
    Array.isArray(stream.cpu_stats.cpu_usage.percpu_usage) &&
    stream.cpu_stats.cpu_usage.percpu_usage.length > 0
  ) {
    numCpus = stream.cpu_stats.cpu_usage.percpu_usage.length;
  }
  
  // Calculate normalized CPU percentage
  const cpuPercent = systemDelta > 0 
    ? ((cpuDelta / systemDelta) * numCpus * 100) 
    : 0;

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

  const snapshot = {
    cpuPercent: cpuPercent.toFixed(1),
    memPercent: memPercent.toFixed(1),
    netIO: { rx, tx },
  };

  logger.debug("Stats fetched for container %s", containerId, snapshot);
  return snapshot;
}
