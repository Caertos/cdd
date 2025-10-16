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

export async function startContainer(containerId) {
  const container = docker.getContainer(containerId);
  await container.start();
}

export async function stopContainer(containerId) {
  const container = docker.getContainer(containerId);
  await container.stop();
}

export async function restartContainer(containerId) {
  const container = docker.getContainer(containerId);
  await container.restart();
}
