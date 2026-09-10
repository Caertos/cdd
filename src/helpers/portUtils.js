/**
 * Shared port utilities for previewing and assigning host ports.
 * Extracted from containerActions.js so both preview and creation
 * use the same logic and cannot diverge.
 */

/**
 * Find the next available host port starting from a numeric base.
 * Mutates usedPorts by adding the chosen port.
 *
 * @param {string} base - Base port string (e.g. '5432')
 * @param {Set<string>} usedPorts - Set of already-used host ports (mutated)
 * @returns {string} The next available port
 */
export function findAvailablePort(base, usedPorts) {
  const numericBase = Number.parseInt(base, 10);
  if (Number.isNaN(numericBase)) {
    if (!usedPorts.has(base)) {
      usedPorts.add(base);
      return base;
    }
    let counter = 1;
    let candidate = `${base}-${counter}`;
    while (usedPorts.has(candidate)) {
      counter += 1;
      candidate = `${base}-${counter}`;
    }
    usedPorts.add(candidate);
    return candidate;
  }
  let candidate = numericBase;
  while (usedPorts.has(String(candidate))) {
    candidate += 1;
  }
  usedPorts.add(String(candidate));
  return String(candidate);
}
