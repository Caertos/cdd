/**
 * Shared port utilities for previewing and assigning host ports.
 * Extracted from containerActions.js so both preview and creation
 * use the same logic and cannot diverge.
 */

/** Highest valid TCP port. */
export const MAX_PORT = 65535;

/**
 * Find the next available host port starting from a numeric base.
 * Mutates usedPorts by adding the chosen port.
 *
 * Returns null when the numeric range is exhausted — a port above 65535 is
 * never handed out. Callers decide what to do with that; we never invent one.
 *
 * @param {string} base - Base port string (e.g. '5432')
 * @param {Set<string>} usedPorts - Set of already-used host ports (mutated)
 * @returns {string|null} The next available port, or null when there is none
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
  while (candidate <= MAX_PORT && usedPorts.has(String(candidate))) {
    candidate += 1;
  }
  if (candidate > MAX_PORT) {
    return null;
  }
  usedPorts.add(String(candidate));
  return String(candidate);
}
