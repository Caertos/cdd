import { docker } from "../dockerService";

export async function getContainers() {
  const containers = await docker.listContainers({ all: true });
  return containers.map((container) => ({
    id: container.Id,
    name: container.Names[0].replace("/", ""),
    image: container.Image,
    state: container.State,
    status: container.Status,
    ports:
      [
        ...new Set(
          container.Ports.filter((port) => port.PublicPort).map(
            (port) => `${port.PublicPort}:${port.PrivatePort}`
          )
        ),
      ]
  }));
}
