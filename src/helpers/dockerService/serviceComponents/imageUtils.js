import { docker } from "../dockerService";

/**
 * Check whether an image exists locally.
 * @param {string} imageName - Image name or tag
 * @returns {Promise<boolean>}
 */
export async function imageExists(imageName) {
  const images = await docker.listImages();
  return images.some(img =>
    (img.RepoTags || []).includes(imageName) ||
    (img.RepoDigests || []).some(d => d.includes(imageName))
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
