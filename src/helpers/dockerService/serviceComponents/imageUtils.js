import { docker } from "../dockerService";

export async function imageExists(imageName) {
  const images = await docker.listImages();
  return images.some(img =>
    (img.RepoTags || []).includes(imageName) ||
    (img.RepoDigests || []).some(d => d.includes(imageName))
  );
}

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
