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
 * @property {string[]} env           - Config.Env, image defaults included
 * @property {string[]} cmd           - Config.Cmd, image defaults included
 * @property {string[]} entrypoint    - Config.Entrypoint, image defaults included
 * @property {string|null} imageRef    - Config.Image as the image was named at create time
 */

/** Read an array-of-strings field from a Config, tolerating anything. */
function strArray(value) {
  return Array.isArray(value) ? value.filter((v) => typeof v === 'string') : [];
}

/**
 * Reduce a dockerode inspect payload to the fields CDD cares about.
 *
 * `env`, `cmd` and `entrypoint` are here for the creation wizard's prefill
 * (TASK-8), which rebuilds a container's configuration from an existing one.
 * They carry the image's own defaults as well as the user's, so whoever
 * consumes them has to subtract the image's — see getImageEnv.
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
    env: strArray(config.Env),
    cmd: strArray(config.Cmd),
    entrypoint: strArray(config.Entrypoint),
    imageRef: typeof config.Image === 'string' ? config.Image : null,
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
 * The environment variables an image itself sets (PATH, PG_VERSION, LANG…).
 *
 * A container's Config.Env is the image's variables merged with whatever the
 * user added, so the wizard's prefill has to subtract this list to show only
 * what the person actually set. Hence this second read.
 *
 * Returns null when the image cannot be inspected — a dangling image, a
 * registry-only reference, a Docker that will not answer. Null means "we do
 * not know", and the caller must not treat it as "the image sets nothing":
 * dropping every variable would destroy real configuration.
 *
 * @param {string} imageRef - Image name, tag or id
 * @returns {Promise<string[]|null>}
 */
export async function getImageEnv(imageRef) {
  if (!imageRef || typeof imageRef !== 'string') return null;
  try {
    const image = docker.getImage(imageRef);
    if (!image || typeof image.inspect !== 'function') return null;
    const data = await image.inspect();
    const env =
      data?.Config?.Env ?? data?.ContainerConfig?.Env ?? data?.config?.Env;
    return Array.isArray(env) ? env.filter((v) => typeof v === 'string') : [];
  } catch (err) {
    logger.debug('Could not inspect image env for %s: %s', imageRef, err);
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
