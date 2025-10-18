import { docker } from "../dockerService.js";
import { logger } from "../../logger.js";

const DEFAULT_CONTAINER_NAME = "Unknown";

/**
 * Produce a safe, display-friendly container name from the raw Docker payload.
 *
 * @param {Object} container Docker container summary as returned by dockerode.
 * @returns {string} Normalized name without leading slashes and with a fallback applied.
 */
function normalizeContainerName(container) {
  const names = container?.Names;

  let rawName;
  if (Array.isArray(names) && names.length > 0 && typeof names[0] === "string") {
    rawName = names[0];
  } else if (typeof names === "string" && names.trim().length > 0) {
    rawName = names;
  } else if (typeof container?.Name === "string" && container.Name.trim().length > 0) {
    rawName = container.Name;
  } else {
    rawName = DEFAULT_CONTAINER_NAME;
  }

  if (typeof rawName !== "string") {
    return DEFAULT_CONTAINER_NAME;
  }

  const cleanedName = rawName.replace(/^\/+/u, "").trim();
  return cleanedName.length > 0 ? cleanedName : DEFAULT_CONTAINER_NAME;
}

/**
 * Return a list of containers with normalized fields for the UI.
 * @returns {Promise<Array<Object>>}
 */
export async function getContainers() {
  logger.debug("Listing containers");
  try {
    const containers = await docker.listContainers({ all: true });
    logger.debug("Retrieved %d containers", containers.length);
    return containers.map((container) => ({
      id: container.Id,
      name: normalizeContainerName(container),
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
          // Fall back to exposed private ports when there are no bindings.
          const privatePorts = container.Ports.filter((port) => port.PrivatePort).map(
            (port) => `${port.PrivatePort}`
          );
          return [...new Set(privatePorts)];
        })()
    }));
  } catch (err) {
    logger.error("Failed to list containers", err);
    throw err;
  }
}
