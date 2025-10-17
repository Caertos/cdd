import Docker from "dockerode";

// Use default dockerode configuration which automatically handles:
// - /var/run/docker.sock on Linux/Mac
// - //./pipe/docker_engine on Windows
// - Environment variables DOCKER_HOST, DOCKER_CERT_PATH, etc.

/**
 * Typedef for the docker client used in this project.
 * Use a generic object shape so JSDoc can render a meaningful type.
 *
 * @typedef {Object} DockerClient
 * @property {Function} listContainers
 * @property {Function} getContainer
 * @property {Function} listImages
 * @property {Function} createContainer
 * @property {Function} pull
 */

/**
 * Shared Docker client instance (dockerode). Consumers import { docker }
 * and use it to list/create/start/stop containers and images.
 *
 * @type {DockerClient}
 */
const docker = new Docker();

export { docker };
