import { docker } from "../dockerService";
import { imageExists, pullImage } from "./imageUtils.js";
import { TIMEOUTS } from "../../constants";

/**
 * Helper to add timeout to promises. If the provided promise does not settle
 * within `ms` milliseconds it will reject with an Error.
 *
 * @template T
 * @param {Promise<T>} promise - Promise to wrap
 * @param {number} [ms=TIMEOUTS.CONTAINER_OP] - Timeout in milliseconds
 * @returns {Promise<T>} The original promise result or a rejection on timeout
 */
function withTimeout(promise, ms = TIMEOUTS.CONTAINER_OP) {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Operation timed out')), ms)
    )
  ]);
}

/**
 * Remove (delete) a container by id. Force removal so running containers are stopped first.
 *
 * @param {string} containerId - Docker container id
 * @returns {Promise<void>} Resolves when removal completes
 * @throws {Error} If Docker reports an error
 */
export async function removeContainer(containerId) {
  const container = docker.getContainer(containerId);
  try {
  await withTimeout(container.remove({ force: true }), TIMEOUTS.CONTAINER_OP);
  } catch (err) {
    throw new Error('Error removing container: ' + err.message);
  }
}

/**
 * Create a new container from an image. If the image is missing locally, it will be pulled.
 *
 * @param {string} imageName - Image name (e.g. 'nginx:alpine')
 * @param {Object} [options] - Docker create options (Env, ExposedPorts, HostConfig, name, etc.)
 * @returns {Promise<string>} The created container id
 * @throws {Error} If image listing/pull or creation fails
 */
export async function createContainer(imageName, options = {}) {
  let exists;
  try {
    exists = await withTimeout(imageExists(imageName), 10000);
  } catch (err) {
    throw new Error('Error listing local images: ' + err.message);
  }
  if (!exists) {
    try {
    await withTimeout(pullImage(imageName), TIMEOUTS.PULL_IMAGE); // 5 minutes for pull
    } catch (err) {
      throw new Error('Could not pull image: ' + err.message);
    }
  }
  const createOpts = {
    Image: imageName,
    Tty: true,
    ...options,
  };
  try {
  const container = await withTimeout(docker.createContainer(createOpts), TIMEOUTS.CONTAINER_OP);
    return container.id || container.Id;
  } catch (err) {
    throw new Error('Error creating container: ' + err.message);
  }
}

/**
 * Start a container by id.
 * @param {string} containerId - Docker container id
 * @returns {Promise<void>}
 */
export async function startContainer(containerId) {
  const container = docker.getContainer(containerId);
  await withTimeout(container.start(), TIMEOUTS.CONTAINER_OP);
}

/**
 * Stop a container by id.
 * @param {string} containerId - Docker container id
 * @returns {Promise<void>}
 */
export async function stopContainer(containerId) {
  const container = docker.getContainer(containerId);
  await withTimeout(container.stop(), TIMEOUTS.CONTAINER_OP);
}

/**
 * Restart a container by id.
 * @param {string} containerId - Docker container id
 * @returns {Promise<void>}
 */
export async function restartContainer(containerId) {
  const container = docker.getContainer(containerId);
  await withTimeout(container.restart(), TIMEOUTS.CONTAINER_OP);
}
