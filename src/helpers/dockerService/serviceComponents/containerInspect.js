import { docker } from '../dockerService.js';
import { logger } from '../../logger.js';

/**
 * @typedef {Object} ContainerDetails
 * @property {string} id
 * @property {string|null} state
 * @property {number|null} exitCode
 * @property {string|null} startedAt   - ISO
 * @property {string|null} finishedAt  - ISO
 * @property {boolean} restarting
 * @property {number} restartCount
 * @property {string|null} healthStatus - 'healthy'|'unhealthy'|'starting'|null
 * @property {boolean} oomKilled
 * @property {Record<string,string>} labels
 */

/**
 * Reduce a dockerode inspect payload to the fields CDD cares about.
 *
 * @param {Object} data - Raw `container.inspect()` response
 * @returns {ContainerDetails}
 */
function mapInspect(data) {
  const state = data?.State ?? {};
  const config = data?.Config ?? {};

  return {
    id: data?.Id ?? '',
    state: state.Status ?? null,
    exitCode: typeof state.ExitCode === 'number' ? state.ExitCode : null,
    startedAt: state.StartedAt ?? null,
    finishedAt: state.FinishedAt ?? null,
    restarting: state.Restarting === true,
    restartCount:
      typeof state.RestartCount === 'number' ? state.RestartCount : 0,
    healthStatus: state.Health?.Status ?? null,
    oomKilled: state.OOMKilled === true,
    labels: config.Labels || {},
  };
}

/**
 * Inspect a container and return only the fields CDD needs.
 * Never throws: on error it logs and returns null.
 *
 * @param {string} containerId
 * @returns {Promise<ContainerDetails|null>}
 */
export async function getContainerDetails(containerId) {
  try {
    const container = docker.getContainer(containerId);
    const data = await container.inspect();
    return mapInspect(data);
  } catch (err) {
    logger.error('Failed to inspect container %s', containerId, err);
    return null;
  }
}

/**
 * Inspect several containers with a bounded concurrency.
 * Ids whose inspect fails (gone, transient error) are simply absent
 * from the returned map.
 *
 * @param {string[]} ids
 * @param {Object} [options]
 * @param {number} [options.concurrency=5]
 * @returns {Promise<Map<string, ContainerDetails>>}
 */
export async function getManyContainerDetails(ids, options = {}) {
  const { concurrency = 5 } = options;
  const list = Array.isArray(ids) ? ids : [];
  const results = new Map();

  const limit = Math.max(
    1,
    Math.min(Math.floor(concurrency) || 1, list.length)
  );
  let cursor = 0;

  async function worker() {
    while (cursor < list.length) {
      const id = list[cursor];
      cursor += 1;
      // Sequential per worker by design: this is what bounds concurrency.
      // eslint-disable-next-line no-await-in-loop
      const details = await getContainerDetails(id);
      if (details) {
        results.set(id, details);
      }
    }
  }

  await Promise.all(Array.from({ length: limit }, () => worker()));
  return results;
}
