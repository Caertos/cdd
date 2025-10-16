import { docker } from "../dockerService";
import { imageExists, pullImage } from "./imageUtils";

export async function createContainer(imageName, options = {}) {
  let exists;
  try {
    exists = await imageExists(imageName);
  } catch (err) {
    throw new Error('Error al listar imágenes locales: ' + err.message);
  }
  if (!exists) {
    try {
      await pullImage(imageName);
    } catch (err) {
      throw new Error('No se pudo descargar la imagen: ' + err.message);
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
    throw new Error('Error al crear el contenedor: ' + err.message);
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
