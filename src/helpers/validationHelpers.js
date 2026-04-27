// Reusable validations for ports and environment variables
import { normalizeImageName } from './imageNameUtils.js';

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
  const ports = portInput
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (ports.length === 0) return true;
  const invalid = ports.find((pair) => {
    const [host, cont] = pair.split(':');
    return !host || !cont || isNaN(Number(host)) || isNaN(Number(cont));
  });
  return !invalid;
}

/**
 * Validate environment variable input as comma-separated VAR=value pairs.
 *
 * When called with 3 arguments (envInput, imageName, imageProfiles), performs
 * contextual validation: checks that all required env vars for the given image
 * are present and non-empty. Returns an object { valid, errors, parsedEnv }.
 *
 * When called with 1 argument (legacy), returns a boolean for backward compatibility.
 *
 * @param {string} envInput - Comma-separated environment variable assignments
 * @param {string} [imageName] - Optional Docker image name for contextual validation
 * @param {Object} [imageProfiles] - Optional map of image profiles (from constants.js)
 * @returns {boolean|{valid: boolean, errors: string[], parsedEnv: Record<string,string>}}
 */
export function validateEnvVars(envInput, imageName, imageProfiles) {
  const contextual = imageName !== undefined && imageProfiles !== undefined;

  // Parse: split on FIRST '=' only
  const parsedEnv = {};
  const syntaxErrors = [];

  if (envInput && envInput.trim()) {
    const vars = envInput
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    for (const v of vars) {
      const eqIdx = v.indexOf('=');
      if (eqIdx === -1) {
        syntaxErrors.push(`"${v}" is missing an '=' sign`);
        continue;
      }
      const varName = v.slice(0, eqIdx).trim();
      const varValue = v.slice(eqIdx + 1);
      if (!/^[A-Z_][A-Z0-9_]*$/i.test(varName)) {
        syntaxErrors.push(`"${varName}" is not a valid variable name`);
        continue;
      }
      parsedEnv[varName] = varValue;
    }
  }

  if (!contextual) {
    // Legacy: return boolean
    return syntaxErrors.length === 0;
  }

  // Contextual: also check required env vars from the profile
  const errors = [...syntaxErrors];
  const baseName = normalizeImageName(imageName);
  const profile = imageProfiles[baseName];

  if (profile && profile.requiredEnv && profile.requiredEnv.length) {
    for (const required of profile.requiredEnv) {
      if (!parsedEnv[required] || parsedEnv[required].trim() === '') {
        errors.push(`Missing required env var: ${required}`);
      }
    }
  }

  return { valid: errors.length === 0, errors, parsedEnv };
}
