// Reusable validations for ports and environment variables

/**
 * Validate a comma-separated list of port mappings in the form "host:container".
 * Examples of valid input: "8080:80, 3000:3000"
 *
 * @param {string} portInput - Comma-separated port mappings
 * @returns {boolean} True when all mappings are valid, false otherwise
 */
export function validatePorts(portInput) {
  // Empty or whitespace-only input is considered valid (ports are optional)
  if (!portInput || !portInput.trim()) return true;
  const ports = portInput.split(",").map(p => p.trim()).filter(Boolean);
  if (ports.length === 0) return true;
  const invalid = ports.find(pair => {
    const [host, cont] = pair.split(":");
    return !host || !cont || isNaN(Number(host)) || isNaN(Number(cont));
  });
  return !invalid;
}

/**
 * Validate environment variable input as comma-separated VAR=value pairs.
 * Empty or whitespace-only input is considered valid (no env vars).
 * Variable names must start with a letter or underscore and contain only
 * alphanumeric characters and underscores.
 *
 * @param {string} envInput - Comma-separated environment variable assignments
 * @returns {boolean} True when all env var assignments are valid, false otherwise
 */
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
