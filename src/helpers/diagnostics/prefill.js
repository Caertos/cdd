/**
 * Rebuild a wizard form from an existing container, then apply a fix on top.
 *
 * This is the inverse of buildContainerOptions. It is pure: it reads data that
 * has already been fetched and returns wizard values. No Docker, no clock, no
 * side effects — which is what makes "recreate with the fix" testable without
 * a daemon.
 */
import { findAvailablePort } from '../portUtils.js';
import { splitEnvEntries, formatEnvEntries } from '../envInput.js';

/**
 * @typedef {Object} ContainerConfig
 * @property {string[]} env  - Config.Env from the container's inspect
 * @property {string[]} [cmd] - Config.Cmd from the container's inspect
 */

/**
 * @typedef {Object} CreationValues
 * @property {string} imageName
 * @property {string} containerName
 * @property {string} portInput  - "HOST:CONTAINER" pairs, comma separated
 * @property {string} envInput   - "KEY=VALUE" pairs, comma separated
 */

/**
 * The env field is a comma-separated list of `KEY=VALUE` entries, and Docker
 * allows a comma inside a value (e.g. Kafka's
 * `KAFKA_LISTENERS=PLAINTEXT://0.0.0.0:9092,CONTROLLER://0.0.0.0:9093`). Values
 * therefore escape their own commas and backslashes (`\,`, `\\`) and every
 * reader goes through `envInput.js`; `containerToCreationValues` re-escapes on
 * the way in and `applyFix` re-escapes on the way out.
 *
 * @see ownEnvOf
 * @see applyFix
 */

/** The wizard's step each field belongs to, so the review can point at it. */
export const FIELD_STEPS = {
  imageName: 0,
  containerName: 1,
  portInput: 2,
  envInput: 3,
};

/**
 * The variables the person set, as opposed to the ones the image ships.
 *
 * A container's Config.Env is the image's variables merged with the user's, so
 * reading it raw would put PATH, LANG and PG_VERSION into the form.
 *
 * When `imageEnv` is null we could not inspect the image, so we cannot tell
 * which is which. Returning the container's variables unfiltered is the
 * untidy-but-honest answer; returning nothing would silently delete real
 * configuration.
 *
 * @param {string[]|null} containerEnv
 * @param {string[]|null} imageEnv
 * @returns {string[]}
 */
export function ownEnvOf(containerEnv, imageEnv) {
  const all = Array.isArray(containerEnv) ? containerEnv : [];
  if (!Array.isArray(imageEnv)) return [...all];
  const fromImage = new Set(imageEnv);
  return all.filter((entry) => !fromImage.has(entry));
}

/**
 * The wizard's port field from a container's published ports.
 *
 * Only published bindings are mapped: `ports: ['8080:80']` becomes `8080:80`,
 * while a bare `80` is an exposed-but-unpublished port that has no host side
 * and would ask the user for a mapping that does not exist yet.
 *
 * Known limitation: the protocol is not carried. getContainers() reduces
 * `Ports[]` to `PublicPort:PrivatePort` and drops `Type`, and
 * buildContainerOptions hardcodes `/tcp`. Recreating a container with a
 * published UDP port therefore turns it into TCP. Fixing it means changing
 * both ends, which reaches the wizard summary and the port-conflict
 * detection — too wide to fold in here, and half-fixing it would be worse.
 *
 * @param {string[]} ports
 * @returns {string}
 */
export function portInputOf(ports) {
  const list = Array.isArray(ports) ? ports : [];
  return list.filter((p) => typeof p === 'string' && p.includes(':')).join(',');
}

/**
 * Rebuild the wizard's values from a container that failed.
 *
 * @param {Object} container - Row from getContainers(): { name, image, ports }
 * @param {ContainerConfig|null} config - Config.Env/Cmd from inspect
 * @param {string[]|null} [imageEnv] - The image's own env, to subtract
 * @returns {CreationValues}
 */
export function containerToCreationValues(container, config, imageEnv = null) {
  const row = container ?? {};
  return {
    imageName: row.image ?? '',
    containerName: row.name ?? '',
    portInput: portInputOf(row.ports),
    // The container's real Env may carry commas inside a value; escape them so
    // the field round-trips through buildContainerOptions unchanged.
    envInput: formatEnvEntries(ownEnvOf(config?.env ?? null, imageEnv)),
  };
}

/** Split the wizard's comma-separated env field back into entries. */
function envEntries(envInput) {
  return splitEnvEntries(envInput)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** The key of a `KEY=VALUE` entry, or the whole thing when there is no `=`. */
function envKey(entry) {
  const at = entry.indexOf('=');
  return at === -1 ? entry : entry.slice(0, at);
}

/**
 * A name that nothing is using: `web`, then `web-2`, `web-3`…
 *
 * Docker keeps a container's name after it stops, so recreating a failed
 * container under its own name always collides. TASK-8 proposes keeping the
 * old one and moving aside rather than deleting anything the person has not
 * looked at yet.
 *
 * @param {string} name
 * @param {Iterable<string>} takenNames
 * @returns {string}
 */
export function withFreeName(name, takenNames) {
  const base = (name || '').trim();
  if (!base) return base;
  const taken = new Set(takenNames ?? []);
  if (!taken.has(base)) return base;
  let counter = 2;
  while (taken.has(`${base}-${counter}`)) {
    counter += 1;
  }
  return `${base}-${counter}`;
}

/**
 * Apply a diagnosis's fix to a set of wizard values.
 *
 * Never applies the fix directly: the result goes back through the review
 * screen, where the user sees what changed and confirms. That is principle 2
 * of the roadmap, and it also protects against a diagnosis being wrong.
 *
 * @param {CreationValues} values
 * @param {import('./rules.js').FixSuggestion|null} fix
 * @param {Object} [ctx]
 * @param {Iterable<string>} [ctx.takenNames] - Container names already in use
 * @param {Iterable<string>} [ctx.usedHostPorts] - Host ports already published
 * @returns {{values: CreationValues, changedFields: string[]}}
 */
export function applyFix(values, fix, ctx = {}) {
  const next = { ...(values ?? {}) };
  const changedFields = [];

  if (fix && fix.kind === 'add-env') {
    const additions = Object.entries(fix.patch?.env ?? {});
    const entries = envEntries(next.envInput);
    const present = new Set(entries.map(envKey));
    for (const [key, value] of additions) {
      if (present.has(key)) continue;
      // Always with the '=' sign. A bare "KEY" made validateEnvVars report a
      // syntax error for something the diagnosis itself had written, and left
      // Docker receiving a valueless variable.
      entries.push(`${key}=${value}`);
      present.add(key);
      changedFields.push('envInput');
    }
    if (changedFields.length > 0) {
      // Re-escape the values so a comma inside one of them stays part of that
      // entry instead of splitting the list.
      next.envInput = formatEnvEntries(entries);
    }
  }

  if (fix && fix.kind === 'change-port') {
    const used = new Set(ctx.usedHostPorts ?? []);
    for (const [hostPort] of Object.entries(fix.patch?.ports ?? {})) {
      const replacement = findAvailablePort(hostPort, used);
      if (replacement === null) continue;
      const pairs = (next.portInput || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const at = pairs.findIndex((pair) => pair.split(':')[0] === hostPort);
      if (at === -1) continue;
      pairs[at] = `${replacement}:${pairs[at].split(':')[1]}`;
      next.portInput = pairs.join(',');
      changedFields.push('portInput');
    }
  }

  // A failed container still owns its name, so recreating needs a free one.
  const freed = withFreeName(next.containerName, ctx.takenNames);
  if (freed !== next.containerName) {
    next.containerName = freed;
    changedFields.push('containerName');
  }

  return { values: next, changedFields: [...new Set(changedFields)] };
}
