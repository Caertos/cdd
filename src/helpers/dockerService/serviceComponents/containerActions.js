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
    await container.remove({ force: true });
  } catch (err) {
    throw new Error('Error removing container: ' + err.message);
  }
}
import { docker } from "../dockerService";
import { imageExists, pullImage } from "./imageUtils.js";

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
    exists = await imageExists(imageName);
  } catch (err) {
    throw new Error('Error listing local images: ' + err.message);
  }
  if (!exists) {
    try {
      await pullImage(imageName);
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
    const container = await docker.createContainer(createOpts);
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
  await container.start();
}

/**
 * Stop a container by id.
 * @param {string} containerId - Docker container id
 * @returns {Promise<void>}
 */
export async function stopContainer(containerId) {
  const container = docker.getContainer(containerId);
  await container.stop();
}

/**
 * Restart a container by id.
 * @param {string} containerId - Docker container id
 * @returns {Promise<void>}
 */
export async function restartContainer(containerId) {
  const container = docker.getContainer(containerId);
  await container.restart();
}
