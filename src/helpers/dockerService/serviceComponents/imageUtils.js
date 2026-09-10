import { docker } from '../dockerService.js';
import { normalizeImageName } from '../../imageNameUtils.js';
import { IMAGE_PROFILES } from '../../constants.js';
import { findAvailablePort } from '../../portUtils.js';

/**
 * Check whether an image exists locally.
 * @param {string} imageName - Image name or tag
 * @returns {Promise<boolean>}
 */
export async function imageExists(imageName) {
  const images = await docker.listImages();
  return images.some(
    (img) =>
      (img.RepoTags || []).includes(imageName) ||
      (img.RepoDigests || []).some((d) => d.includes(imageName))
  );
}

/**
 * Pull an image from the registry.
 * @param {string} imageName - Image name to pull
 * @returns {Promise<void>}
 */
export async function pullImage(imageName) {
  await new Promise((resolve, reject) => {
    docker.pull(imageName, (err, stream) => {
      if (err) return reject(new Error('Error pulling image: ' + err.message));
      docker.modem.followProgress(stream, (pullErr) => {
        if (pullErr) reject(new Error('Error during pull: ' + pullErr.message));
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
  let exists;
  try {
    exists = await imageExists(imageName);
  } catch {
    return null;
  }
  if (!exists) return null;

  try {
    const image = docker.getImage(imageName);
    if (!image || typeof image.inspect !== 'function') return null;

    const inspectData = await image.inspect();
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
      for (const port of container.ports || []) {
        usedHostPorts.add(String(port));
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
