import { docker } from '../dockerService.js';
import { normalizeImageName } from '../../imageNameUtils.js';
import { IMAGE_PROFILES } from '../../constants.js';
import { findAvailablePort, hostPortsOf } from '../../portUtils.js';

/**
 * Inspect the image in the daemon.
 * Returns the inspect data, or null when the daemon says the image does not
 * exist locally. Any other error (daemon down, permission) is thrown: saying
 * "it does not exist" there would trigger a pointless pull.
 *
 * @param {string} imageName - Image name or tag
 * @returns {Promise<Object|null>} Inspect data, or null when not found locally
 * @throws {Error} If the daemon fails for any reason other than "no such image"
 */
export async function inspectLocalImage(imageName) {
  try {
    const image = docker.getImage(imageName);
    if (!image || typeof image.inspect !== 'function') {
      throw new Error(
        'Image inspection is not supported by this docker client'
      );
    }
    return await image.inspect();
  } catch (err) {
    if (err?.statusCode === 404 || err?.reason === 'no such image') return null;
    throw err;
  }
}

/**
 * Check whether an image exists locally.
 * @param {string} imageName - Image name or tag
 * @returns {Promise<boolean>}
 * @throws {Error} If the daemon cannot be queried
 */
export async function imageExists(imageName) {
  const inspectData = await inspectLocalImage(imageName);
  return Boolean(inspectData);
}

/**
 * Pull an image from the registry.
 * @param {string} imageName - Image name to pull
 * @returns {Promise<void>}
 */
export async function pullImage(imageName) {
  await new Promise((resolve, reject) => {
    docker.pull(imageName, (err, stream) => {
      if (err) return reject(new Error(`Error pulling image: ${err.message}`));
      docker.modem.followProgress(stream, (pullErr) => {
        if (pullErr) reject(new Error(`Error during pull: ${pullErr.message}`));
        else resolve();
      });
    });
  });
}

/**
 * Preview the host ports CDD would auto-assign if the user left ports empty.
 * Returns null when the answer cannot be known (image not local, inspect failed).
 *
 * @param {string} imageName
 * @param {Array<{ports: string[]}>} containers
 * @param {Object} [imageProfiles]
 * @returns {Promise<Array<{containerPort:string, hostPort:string, protocol:string}>|null>}
 */
export async function previewAutoPorts(
  imageName,
  containers,
  imageProfiles = IMAGE_PROFILES
) {
  try {
    const inspectData = await inspectLocalImage(imageName);
    if (!inspectData) return null;

    let exposed =
      inspectData?.Config?.ExposedPorts ||
      inspectData?.ContainerConfig?.ExposedPorts ||
      {};
    let exposedKeys = Object.keys(exposed || {});

    if (!exposedKeys.length) {
      const baseName = normalizeImageName(imageName);
      const profile = imageProfiles[baseName];
      if (profile?.defaultPort) {
        const fallbackKey = `${profile.defaultPort}/tcp`;
        exposed = { [fallbackKey]: {} };
        exposedKeys = [fallbackKey];
      }
    }

    if (!exposedKeys.length) return null;

    const usedHostPorts = new Set();
    for (const container of containers || []) {
      for (const port of hostPortsOf(container)) {
        usedHostPorts.add(port);
      }
    }

    return exposedKeys.map((portKey) => {
      const parts = portKey.split('/');
      const containerPort = parts[0];
      const protocol = parts[1] || 'tcp';
      const hostPort = findAvailablePort(containerPort, usedHostPorts);
      return { containerPort, hostPort, protocol };
    });
  } catch {
    return null;
  }
}
