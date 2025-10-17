import { docker } from "../dockerService";

/**
 * Return a list of containers with normalized fields for the UI.
 * @returns {Promise<Array<Object>>}
 */
export async function getContainers() {
  const containers = await docker.listContainers({ all: true });
  return containers.map((container) => ({
    id: container.Id,
    name: (container.Names && container.Names[0] || 'Unknown').replace("/", ""),
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
  // If there are no public ports, show private exposed ports
        const privatePorts = container.Ports.filter((port) => port.PrivatePort).map(
          (port) => `:${port.PrivatePort}`
        );
        return [...new Set(privatePorts)];
      })()
  }));
}
