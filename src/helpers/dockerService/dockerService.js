import Docker from "dockerode";

// Use default dockerode configuration which automatically handles:
// - /var/run/docker.sock on Linux/Mac
// - //./pipe/docker_engine on Windows
// - Environment variables DOCKER_HOST, DOCKER_CERT_PATH, etc.
const docker = new Docker();

export { docker };
