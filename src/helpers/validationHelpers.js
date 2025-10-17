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
  if (!envInput || !envInput.trim()) return true; // Empty is valid
  
  const vars = envInput.split(",").map(v => v.trim()).filter(Boolean);
  const invalid = vars.find(v => {
    const parts = v.split("=");
    // Must have at least VAR=value format
    if (parts.length < 2) return true;
    const varName = parts[0].trim();
    // Variable names should be alphanumeric with underscores
    if (!/^[A-Z_][A-Z0-9_]*$/i.test(varName)) return true;
    return false;
  });
  
  return !invalid;
}
