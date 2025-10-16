// Reusable validations for ports and environment variables

export function validatePorts(portInput) {
  const ports = portInput.split(",").map(p => p.trim()).filter(Boolean);
  if (ports.length === 0) return false;
  const invalid = ports.find(pair => {
    const [host, cont] = pair.split(":");
    return !host || !cont || isNaN(Number(host)) || isNaN(Number(cont));
  });
  return !invalid;
}

export function validateEnvVars(envInput) {
  // Future specific validations
  return true;
}
