/**
 * Builds Docker container creation options from raw user inputs.
 *
 * This is a pure function — it has no side effects and calls no services.
 * It mirrors exactly the option-building logic in useControls.js onCreate callback.
 *
 * @param {object} params
 * @param {string} params.imageName          - Docker image name (e.g. "nginx:alpine")
 * @param {string} [params.containerName]    - Optional container name
 * @param {string} [params.portInput]        - Comma-separated host:container port pairs
 *                                            (e.g. "8080:80,3000:3000")
 * @param {string} [params.envInput]         - Comma-separated KEY=VALUE pairs
 *                                            (e.g. "NODE_ENV=production,PORT=3000")
 * @returns {object} Docker container options ready to pass to createContainer
 */
export function buildContainerOptions({
  imageName: _imageName,
  containerName,
  portInput,
  envInput,
}) {
  const env = (envInput || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const ports = (portInput || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const ExposedPorts = {};
  const PortBindings = {};

  ports.forEach((pair) => {
    const [host, cont] = pair.split(':');
    if (!host || !cont) return;
    const key = `${cont}/tcp`;
    ExposedPorts[key] = {};
    PortBindings[key] = PortBindings[key] || [];
    PortBindings[key].push({ HostPort: `${host}` });
  });

  const options = {
    Tty: true,
  };

  if (Object.keys(ExposedPorts).length) options.ExposedPorts = ExposedPorts;
  if (Object.keys(PortBindings).length) options.HostConfig = { PortBindings };
  if (env.length) options.Env = env;
  if (containerName) options.name = containerName;

  return options;
}
