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
      (() => {
        const publicPorts = container.Ports.filter((port) => port.PublicPort).map(
          (port) => `${port.PublicPort}:${port.PrivatePort}`
        );
        if (publicPorts.length > 0) {
          return [...new Set(publicPorts)];
        }
        // Si no hay puertos públicos, mostrar los privados expuestos
        const privatePorts = container.Ports.filter((port) => port.PrivatePort).map(
          (port) => `:${port.PrivatePort}`
        );
        return [...new Set(privatePorts)];
      })()
  }));
}
