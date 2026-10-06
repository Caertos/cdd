import Docker from 'dockerode';

/** Unique prefix: every test container carries it in `name` (not Hostname). */
export const PREFIX = 'cdd-e2e-';

/** Default image: small, starts fast, exposes port 80. */
export const TEST_IMAGE = 'nginx:1.27-alpine';
/** Minimal image with no exposed ports, for testing the pull path. */
export const TINY_IMAGE = 'busybox:1.36';

export const docker = new Docker();

export const delay = (ms) => new Promise((r) => setTimeout(r, ms));

/** Is a Docker daemon reachable? */
export async function dockerAvailable() {
  try {
    await docker.ping();
    return true;
  } catch {
    return false;
  }
}

/** Downloads the image only if it is not local (avoids needless CI pulls). */
export async function ensureImage(image) {
  const images = await docker.listImages();
  const present = images.some((img) => (img.RepoTags || []).includes(image));
  if (present) return;

  await new Promise((resolve, reject) => {
    docker.pull(image, (err, stream) => {
      if (err) return reject(err);
      docker.modem.followProgress(stream, (e) => (e ? reject(e) : resolve()));
    });
  });
}

/** Removes the local image if present (to force the pull path). */
export async function removeImageIfPresent(image) {
  try {
    await docker.getImage(image).remove({ force: true });
  } catch {
    /* not present, or in use: either is fine */
  }
}

/**
 * Creates (and optionally starts) a test container.
 * IMPORTANT: uses `name`, not `Hostname` — cleanup filters by `Names`.
 *
 * @param {string} suffix - concatenated to PREFIX
 * @param {object} [opts]
 * @param {string} [opts.image=TEST_IMAGE]
 * @param {boolean} [opts.start=true]
 * @param {object} [opts.create] - extra options for createContainer
 * @returns {Promise<{id: string, name: string, container: object}>}
 */
export async function createTestContainer(suffix, opts = {}) {
  const { image = TEST_IMAGE, start = true, create = {} } = opts;
  const name = `${PREFIX}${suffix}`;

  await ensureImage(image);
  const container = await docker.createContainer({
    Image: image,
    name,
    Tty: true,
    ...create,
  });
  if (start) await container.start();
  return { id: container.id, name, container };
}

/**
 * A container that dies immediately with a non-zero code, so the dashboard
 * has something real to explain. Uses a tiny image: no ports, no pull weight.
 *
 * @param {string} suffix
 * @param {Object} [opts]
 * @param {string} [opts.image]
 * @param {string[]} [opts.cmd]
 * @param {boolean} [opts.withOutput] - Emit a line before dying
 */
export async function createExitedContainer(suffix, opts = {}) {
  const {
    image = TINY_IMAGE,
    cmd = ['sh', '-c', 'exit 1'],
    withOutput = false,
  } = opts;
  const script = withOutput
    ? 'echo "boom: something went wrong" >&2; exit 1'
    : cmd[2];
  return createTestContainer(suffix, {
    image,
    create: { Cmd: ['sh', '-c', script] },
  });
}

export async function removeTestContainer(id) {
  try {
    await docker.getContainer(id).remove({ force: true });
  } catch {
    /* already gone */
  }
}

/** Removes EVERY container whose name starts with the test prefix. */
export async function cleanupAll() {
  const list = await docker.listContainers({ all: true });
  const mine = list.filter((c) =>
    (c.Names || []).some((n) => n.replace(/^\//, '').startsWith(PREFIX))
  );
  await Promise.all(mine.map((c) => removeTestContainer(c.Id)));
}

/** inspect() that returns null instead of throwing if the container is gone. */
export async function inspectSafe(id) {
  try {
    return await docker.getContainer(id).inspect();
  } catch {
    return null;
  }
}

/** Finds a container by exact name (without the leading slash). */
export async function findByName(name) {
  const list = await docker.listContainers({ all: true });
  return (
    list.find((c) =>
      (c.Names || []).some((n) => n.replace(/^\//, '') === name)
    ) ?? null
  );
}

/** Waits for the container to reach a state ('running' | 'exited' | 'paused'). */
export async function waitForState(id, state, timeout = 20000) {
  const deadline = Date.now() + timeout;
  let last = 'unknown';
  while (Date.now() < deadline) {
    const info = await inspectSafe(id);
    last = info?.State?.Status ?? 'missing';
    if (last === state) return info;
    await delay(200);
  }
  throw new Error(
    `Container ${id} stayed in "${last}" instead of "${state}" after ${timeout} ms`
  );
}

/** Waits for the container to stop existing. */
export async function waitForGone(id, timeout = 20000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if ((await inspectSafe(id)) === null) return;
    await delay(200);
  }
  throw new Error(`Container ${id} still existed after ${timeout} ms`);
}

/** Returns the published-port mapping, e.g. { '80/tcp': '8081' }. */
export async function publishedPorts(id) {
  const info = await inspectSafe(id);
  const bindings = info?.HostConfig?.PortBindings ?? {};
  return Object.fromEntries(
    Object.entries(bindings).map(([key, arr]) => [key, arr?.[0]?.HostPort])
  );
}
