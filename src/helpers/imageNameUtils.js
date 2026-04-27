/**
 * Utility for normalizing Docker image names.
 * Extracted from validationHelpers.js and containerActions.js — both had
 * identical implementations; consolidated here to avoid duplication.
 */

/**
 * Normalize an image name to its base name (strips registry prefix and tag).
 *
 * Examples:
 *   "docker.io/library/postgres:16-alpine" → "postgres"
 *   "nginx:alpine"                         → "nginx"
 *   "myregistry.io/myorg/myapp:latest"     → "myapp"
 *
 * @param {string} imageName - Raw image name (from user input or Docker API)
 * @returns {string} Base image name in lowercase, empty string if input is falsy
 */
export function normalizeImageName(imageName) {
  if (!imageName) return '';
  // Remove registry prefix (everything up to and including the last '/')
  let name = imageName;
  const slashIdx = name.lastIndexOf('/');
  if (slashIdx !== -1) {
    name = name.slice(slashIdx + 1);
  }
  // Remove tag (everything from the first ':' onward)
  const colonIdx = name.indexOf(':');
  if (colonIdx !== -1) {
    name = name.slice(0, colonIdx);
  }
  return name.toLowerCase();
}
