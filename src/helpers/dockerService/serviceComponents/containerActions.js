import { docker } from '../dockerService.js';
import { imageExists, pullImage } from './imageUtils.js';
import { TIMEOUTS, IMAGE_PROFILES } from '../../constants.js';
import { logger } from '../../logger.js';
import { normalizeImageName } from '../../imageNameUtils.js';

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
    ),
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
  logger.debug('Removing container %s', containerId);
  const container = docker.getContainer(containerId);
  try {
    await withTimeout(container.remove({ force: true }), TIMEOUTS.CONTAINER_OP);
    logger.info('Removed container %s', containerId);
  } catch (err) {
    logger.error('Failed to remove container %s', containerId, err);
    throw new Error('Error removing container: ' + err.message);
  }
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
  logger.info('Creating container from image %s', imageName);
  let exists;
  try {
    exists = await withTimeout(imageExists(imageName), 10000);
  } catch (err) {
    logger.error('Could not check local images for %s', imageName, err);
    throw new Error('Error listing local images: ' + err.message);
  }
  if (!exists) {
    logger.info('Image %s not found locally, pulling', imageName);
    try {
      await withTimeout(pullImage(imageName), TIMEOUTS.PULL_IMAGE);
      logger.info('Pulled image %s', imageName);
    } catch (err) {
      logger.error('Failed to pull image %s', imageName, err);
      throw new Error('Could not pull image: ' + err.message);
    }
  }
  const createOpts = {
    Image: imageName,
    Tty: true,
    ...options,
  };

  const hasUserDefinedPorts = Boolean(
    createOpts.ExposedPorts && Object.keys(createOpts.ExposedPorts).length
  );

  /** @type {Array<{containerPort: string, hostPort: string, protocol: string, source: string}>} */
  const assignedPorts = [];

  if (!hasUserDefinedPorts) {
    try {
      const image = docker.getImage(imageName);
      if (image && typeof image.inspect === 'function') {
        let usedHostPorts = new Set();
        if (typeof docker.listContainers === 'function') {
          try {
            const containers = await withTimeout(
              docker.listContainers({ all: true }),
              TIMEOUTS.CONTAINER_OP
            );
            containers.forEach((container) => {
              (container.Ports || []).forEach((portInfo) => {
                if (portInfo && portInfo.PublicPort) {
                  usedHostPorts.add(String(portInfo.PublicPort));
                }
              });
            });
          } catch (err) {
            logger.warn(
              'Could not inspect existing containers to auto-map ports',
              err
            );
          }
        }
        const reservePort = (port) => {
          const portStr = String(port);
          usedHostPorts.add(portStr);
        };
        const pickNextAvailablePort = (base) => {
          const numericBase = Number.parseInt(base, 10);
          if (Number.isNaN(numericBase)) {
            if (!usedHostPorts.has(base)) {
              usedHostPorts.add(base);
              return base;
            }
            let counter = 1;
            let candidate = `${base}-${counter}`;
            while (usedHostPorts.has(candidate)) {
              counter += 1;
              candidate = `${base}-${counter}`;
            }
            usedHostPorts.add(candidate);
            return candidate;
          }
          let candidate = numericBase;
          while (usedHostPorts.has(String(candidate))) {
            candidate += 1;
          }
          reservePort(candidate);
          return String(candidate);
        };

        const inspectData = await withTimeout(
          image.inspect(),
          TIMEOUTS.CONTAINER_OP
        );
        let exposed =
          inspectData?.Config?.ExposedPorts ||
          inspectData?.ContainerConfig?.ExposedPorts ||
          {};
        let exposedKeys = Object.keys(exposed || {});

        // If no ExposedPorts in image, fall back to IMAGE_PROFILES defaultPort
        if (!exposedKeys.length) {
          const baseName = normalizeImageName(imageName);
          const profile = imageProfiles[baseName];
          if (profile && profile.defaultPort) {
            const fallbackKey = `${profile.defaultPort}/tcp`;
            exposed = { [fallbackKey]: {} };
            exposedKeys = [fallbackKey];
          }
        }

        if (exposedKeys.length) {
          createOpts.ExposedPorts = createOpts.ExposedPorts || {};
          createOpts.HostConfig = { ...(createOpts.HostConfig || {}) };
          createOpts.HostConfig.PortBindings = {
            ...(createOpts.HostConfig.PortBindings || {}),
          };
          exposedKeys.forEach((portKey) => {
            if (!createOpts.ExposedPorts[portKey]) {
              createOpts.ExposedPorts[portKey] = exposed[portKey] || {};
            }
            if (
              !createOpts.HostConfig.PortBindings[portKey] ||
              !createOpts.HostConfig.PortBindings[portKey].length
            ) {
              const parts = portKey.split('/');
              const containerPort = parts[0];
              const protocol = parts[1] || 'tcp';
              const hostPort = pickNextAvailablePort(containerPort);
              createOpts.HostConfig.PortBindings[portKey] = [
                { HostPort: hostPort },
              ];
              assignedPorts.push({
                containerPort,
                hostPort,
                protocol,
                source: 'auto',
              });
            }
          });
        }
      }
    } catch (err) {
      logger.warn(
        'Could not inspect image %s for default ports',
        imageName,
        err
      );
    }
  } else {
    // User-defined ports: collect them with source: "user"
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
