import { docker } from '../dockerService.js';
import { imageExists, pullImage } from './imageUtils.js';
import { TIMEOUTS, IMAGE_PROFILES } from '../../constants.js';
import { logger } from '../../logger.js';
import { normalizeImageName } from '../../imageNameUtils.js';
import { findAvailablePort, hostPortsOf } from '../../portUtils.js';
import { redactForLog } from '../../secrets.js';
import {
  validateImageName,
  validateContainerName,
} from '../../validationHelpers.js';

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
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Operation timed out')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Remove (delete) a container by id. Force removal so running containers are stopped first.
 *
 * @param {string} containerId - Docker container id
 * @returns {Promise<void>} Resolves when removal completes
 * @throws {Error} If Docker reports an error
 */
export async function removeContainer(containerId) {
  logger.debug('Removing container %s', containerId);
  const container = docker.getContainer(containerId);
  try {
    await withTimeout(container.remove({ force: true }), TIMEOUTS.CONTAINER_OP);
    logger.info('Removed container %s', containerId);
  } catch (err) {
    logger.error('Failed to remove container %s', containerId, err);
    throw new Error(`Error removing container: ${err.message}`);
  }
}

/**
 * @typedef {{containerPort: string, hostPort: string, protocol: string, source: string}} AssignedPort
 */

/**
 * Validate the image name and the optional container name.
 * @param {string} imageName
 * @param {Object} options
 * @throws {Error} If either name is invalid
 */
function validateCreateInput(imageName, options) {
  const imgValidation = validateImageName(imageName);
  if (!imgValidation.valid) {
    throw new Error(`Invalid image name: ${imgValidation.error}`);
  }
  if (options.name) {
    const nameValidation = validateContainerName(options.name);
    if (!nameValidation.valid) {
      throw new Error(`Invalid container name: ${nameValidation.error}`);
    }
  }
}

/**
 * Make sure the image is available locally, pulling it when missing.
 * @param {string} imageName
 * @throws {Error} If the check or the pull fails
 */
async function ensureImageAvailable(imageName) {
  let exists;
  try {
    exists = await withTimeout(imageExists(imageName), 10000);
  } catch (err) {
    logger.error('Could not check local images for %s', imageName, err);
    throw new Error(`Error checking local images: ${err.message}`);
  }
  if (exists) return;
  logger.info('Image %s not found locally, pulling', imageName);
  try {
    await withTimeout(pullImage(imageName), TIMEOUTS.PULL_IMAGE);
    logger.info('Pulled image %s', imageName);
  } catch (err) {
    logger.error('Failed to pull image %s', imageName, err);
    throw new Error(`Could not pull image: ${err.message}`);
  }
}

/**
 * Collect the host ports already published by existing containers.
 * @returns {Promise<Set<*>>}
 */
async function collectUsedHostPorts() {
  const usedHostPorts = new Set();
  if (typeof docker.listContainers !== 'function') return usedHostPorts;
  try {
    const containers = await withTimeout(
      docker.listContainers({ all: true }),
      TIMEOUTS.CONTAINER_OP
    );
    containers.forEach((container) => {
      hostPortsOf(container).forEach((port) => {
        usedHostPorts.add(port);
      });
    });
  } catch (err) {
    logger.warn('Could not inspect existing containers to auto-map ports', err);
  }
  return usedHostPorts;
}

/**
 * Ports the image exposes, falling back to the IMAGE_PROFILES defaultPort.
 * @param {Object} image - Docker image handle
 * @param {string} imageName
 * @param {Object} imageProfiles
 * @returns {Promise<{exposed: Object, exposedKeys: string[]}>}
 */
async function resolveExposedPorts(image, imageName, imageProfiles) {
  const inspectData = await withTimeout(image.inspect(), TIMEOUTS.CONTAINER_OP);
  let exposed =
    inspectData?.Config?.ExposedPorts ||
    inspectData?.ContainerConfig?.ExposedPorts ||
    {};
  let exposedKeys = Object.keys(exposed || {});

  // If no ExposedPorts in image, fall back to IMAGE_PROFILES defaultPort
  if (!exposedKeys.length) {
    const baseName = normalizeImageName(imageName);
    const profile = imageProfiles[baseName];
    if (profile?.defaultPort) {
      const fallbackKey = `${profile.defaultPort}/tcp`;
      exposed = { [fallbackKey]: {} };
      exposedKeys = [fallbackKey];
    }
  }
  return { exposed, exposedKeys };
}

/**
 * Publish one exposed port on the next free host port, when it has no binding.
 * @param {Object} createOpts - Mutated with the new binding
 * @param {string} portKey - e.g. '80/tcp'
 * @param {Object} exposed
 * @param {Set<*>} usedHostPorts
 * @param {AssignedPort[]} assignedPorts - Receives the auto-assigned port
 */
function bindExposedPort(
  createOpts,
  portKey,
  exposed,
  usedHostPorts,
  assignedPorts
) {
  if (!createOpts.ExposedPorts[portKey]) {
    createOpts.ExposedPorts[portKey] = exposed[portKey] || {};
  }
  if (createOpts.HostConfig.PortBindings[portKey]?.length) return;
  const parts = portKey.split('/');
  const containerPort = parts[0];
  const protocol = parts[1] || 'tcp';
  const hostPort = findAvailablePort(containerPort, usedHostPorts);
  if (hostPort === null) {
    // No free host port left. Leave the port unpublished rather
    // than binding something Docker would reject.
    logger.warn(
      'No free host port at or above %s for %s',
      containerPort,
      portKey
    );
    return;
  }
  createOpts.HostConfig.PortBindings[portKey] = [{ HostPort: hostPort }];
  assignedPorts.push({
    containerPort,
    hostPort,
    protocol,
    source: 'auto',
  });
}

/**
 * Auto-map the ports the image exposes. Failures only log a warning.
 * @param {string} imageName
 * @param {Object} createOpts - Mutated with ExposedPorts and HostConfig
 * @param {Object} imageProfiles
 * @param {AssignedPort[]} assignedPorts - Receives the auto-assigned ports
 */
async function autoMapPorts(
  imageName,
  createOpts,
  imageProfiles,
  assignedPorts
) {
  try {
    const image = docker.getImage(imageName);
    if (!image || typeof image.inspect !== 'function') return;
    const usedHostPorts = await collectUsedHostPorts();
    const { exposed, exposedKeys } = await resolveExposedPorts(
      image,
      imageName,
      imageProfiles
    );
    if (!exposedKeys.length) return;
    createOpts.ExposedPorts = createOpts.ExposedPorts || {};
    createOpts.HostConfig = { ...(createOpts.HostConfig || {}) };
    createOpts.HostConfig.PortBindings = {
      ...(createOpts.HostConfig.PortBindings || {}),
    };
    exposedKeys.forEach((portKey) => {
      bindExposedPort(
        createOpts,
        portKey,
        exposed,
        usedHostPorts,
        assignedPorts
      );
    });
  } catch (err) {
    logger.warn('Could not inspect image %s for default ports', imageName, err);
  }
}

/**
 * Collect the ports the user defined, with source: "user".
 * @param {Object} createOpts
 * @param {AssignedPort[]} assignedPorts - Receives the user ports
 */
function collectUserPorts(createOpts, assignedPorts) {
  const portBindings = createOpts.HostConfig?.PortBindings || {};
  Object.entries(portBindings).forEach(([portKey, bindings]) => {
    const parts = portKey.split('/');
    const containerPort = parts[0];
    const protocol = parts[1] || 'tcp';
    (bindings || []).forEach((b) => {
      assignedPorts.push({
        containerPort,
        hostPort: b.HostPort,
        protocol,
        source: 'user',
      });
    });
  });
}

/**
 * Create a new container from an image. If the image is missing locally, it will be pulled.
 *
 * @param {string} imageName - Image name (e.g. 'nginx:alpine')
 * @param {Object} [options] - Docker create options (Env, ExposedPorts, HostConfig, name, etc.)
 * @param {Object} [imageProfiles] - Image profiles map for defaultPort fallback
 * @returns {Promise<{id: string, ports: Array<{containerPort: string, hostPort: string, protocol: string, source: string}>}>}
 * @throws {Error} If image listing/pull or creation fails
 */
export async function createContainer(
  imageName,
  options = {},
  imageProfiles = IMAGE_PROFILES
) {
  validateCreateInput(imageName, options);

  logger.info('Creating container from image %s', imageName);
  if (options.Env?.length) {
    logger.debug('Env vars: %s', redactForLog(options.Env));
  }
  await ensureImageAvailable(imageName);
  const createOpts = {
    Image: imageName,
    Tty: true,
    ...options,
  };

  const hasUserDefinedPorts = Boolean(
    createOpts.ExposedPorts && Object.keys(createOpts.ExposedPorts).length
  );

  /** @type {AssignedPort[]} */
  const assignedPorts = [];

  if (hasUserDefinedPorts) {
    collectUserPorts(createOpts, assignedPorts);
  } else {
    await autoMapPorts(imageName, createOpts, imageProfiles, assignedPorts);
  }

  try {
    const container = await withTimeout(
      docker.createContainer(createOpts),
      TIMEOUTS.CONTAINER_OP
    );
    const containerId = container.id || container.Id;
    logger.info('Created container %s from image %s', containerId, imageName);
    return { id: containerId, ports: assignedPorts };
  } catch (err) {
    logger.error('Failed to create container from image %s', imageName, err);
    throw new Error(`Error creating container: ${err.message}`);
  }
}

/**
 * Start a container by id.
 * @param {string} containerId - Docker container id
 * @returns {Promise<void>}
 */
export async function startContainer(containerId) {
  const container = docker.getContainer(containerId);
  logger.debug('Starting container %s', containerId);
  try {
    await withTimeout(container.start(), TIMEOUTS.CONTAINER_OP);
    logger.info('Started container %s', containerId);
  } catch (err) {
    logger.error('Failed to start container %s', containerId, err);
    throw err;
  }
}

/**
 * Stop a container by id.
 * @param {string} containerId - Docker container id
 * @returns {Promise<void>}
 */
export async function stopContainer(containerId) {
  const container = docker.getContainer(containerId);
  logger.debug('Stopping container %s', containerId);
  try {
    await withTimeout(container.stop(), TIMEOUTS.CONTAINER_OP);
    logger.info('Stopped container %s', containerId);
  } catch (err) {
    logger.error('Failed to stop container %s', containerId, err);
    throw err;
  }
}

/**
 * Restart a container by id.
 * @param {string} containerId - Docker container id
 * @returns {Promise<void>}
 */
export async function restartContainer(containerId) {
  const container = docker.getContainer(containerId);
  logger.debug('Restarting container %s', containerId);
  try {
    await withTimeout(container.restart(), TIMEOUTS.CONTAINER_OP);
    logger.info('Restarted container %s', containerId);
  } catch (err) {
    logger.error('Failed to restart container %s', containerId, err);
    throw err;
  }
}
