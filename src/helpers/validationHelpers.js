// Reusable validations for ports, environment variables, and Docker identifiers
import { normalizeImageName } from './imageNameUtils.js';

/**
 * Validates that a value looks like a Docker container/image ID (hex, 64 chars)
 * or a valid container name (alphanumeric, hyphens, underscores, dots, slashes).
 * @param {string} id
 * @returns {boolean}
 */
export function isValidContainerId(id) {
  if (!id || typeof id !== 'string') return false;
  // Docker ID: 64 hex chars (sha256)
  if (/^[a-f0-9]{64}$/.test(id)) return true;
  // Docker also allows short IDs (12+ chars)
  if (/^[a-f0-9]{12,63}$/.test(id)) return true;
  // Container names: alphanumeric, hyphens, underscores, dots, slashes
  if (/^[a-zA-Z0-9][a-zA-Z0-9_.\-/]{0,127}$/.test(id)) return true;
  return false;
}

/**
 * Validates a Docker container name.
 * Docker names must match: /[a-zA-Z0-9][a-zA-Z0-9_.-]+/
 * Max 128 characters.
 * @param {string} name
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateContainerName(name) {
  if (!name || !name.trim()) return { valid: true }; // Optional
  const trimmed = name.trim();
  if (trimmed.length > 128) {
    return { valid: false, error: 'Container name too long (max 128 chars)' };
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(trimmed)) {
    return {
      valid: false,
      error:
        'Container name can only contain letters, numbers, underscores, dots, and hyphens',
    };
  }
  return { valid: true };
}

/**
 * Validates a Docker image name format.
 * Allows: [registry/]name[:tag]
 * Rejects shell metacharacters and injection patterns.
 * @param {string} name
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateImageName(name) {
  if (!name || !name.trim()) {
    return { valid: false, error: 'Image name is required' };
  }
  const trimmed = name.trim();
  // Reject shell metacharacters
  if (/[;&|`$(){}!<>]/.test(trimmed)) {
    return {
      valid: false,
      error: 'Image name contains invalid characters',
    };
  }
  // Reject docker CLI flags disguised as image names
  if (/^--/.test(trimmed)) {
    return {
      valid: false,
      error: 'Image name cannot start with --',
    };
  }
  // Basic format: name[:tag] or registry/name[:tag]
  if (
    !/^[a-zA-Z0-9_-]+([.:/][a-zA-Z0-9_-]+)*(:[a-zA-Z0-9._-]+)?$/.test(trimmed)
  ) {
    return {
      valid: false,
      error: 'Invalid image name format',
    };
  }
  return { valid: true };
}

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
    if (!host || !cont) return true;
    const hostNum = Number(host);
    const contNum = Number(cont);
    if (isNaN(hostNum) || isNaN(contNum)) return true;
    if (hostNum < 1 || hostNum > 65535) return true;
    if (contNum < 1 || contNum > 65535) return true;
    return false;
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
