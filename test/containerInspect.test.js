/**
 * @jest-environment node
 */
import { jest } from '@jest/globals';

const inspectPayload = {
  Id: 'abc123',
  State: {
    Status: 'running',
    ExitCode: 0,
    StartedAt: '2026-01-01T11:00:00.000Z',
    FinishedAt: '0001-01-01T00:00:00Z',
    Restarting: false,
    RestartCount: 2,
    Health: { Status: 'healthy' },
    OOMKilled: false,
  },
  Config: {
    Labels: { 'com.example': 'yes' },
    Env: ['PATH=/usr/local/bin', 'POSTGRES_PASSWORD=secret'],
    Cmd: ['postgres'],
    Entrypoint: ['docker-entrypoint.sh'],
    Image: 'postgres:17-alpine',
  },
};

async function load(mock) {
  await jest.unstable_mockModule(
    '../src/helpers/dockerService/dockerService.js',
    () => ({ docker: mock })
  );
  return import(
    '../src/helpers/dockerService/serviceComponents/containerInspect.js'
  );
}

describe('getContainerDetails', () => {
  afterEach(() => jest.resetModules());

  test('maps the dockerode inspect payload to the fields CDD needs', async () => {
    const mod = await load({
      getContainer: jest.fn(() => ({
        inspect: jest.fn().mockResolvedValue(inspectPayload),
      })),
    });

    const details = await mod.getContainerDetails('abc123');

    expect(details).toEqual({
      id: 'abc123',
      state: 'running',
      exitCode: 0,
      startedAt: '2026-01-01T11:00:00.000Z',
      finishedAt: '0001-01-01T00:00:00Z',
      restarting: false,
      restartCount: 2,
      healthStatus: 'healthy',
      oomKilled: false,
      labels: { 'com.example': 'yes' },
      env: ['PATH=/usr/local/bin', 'POSTGRES_PASSWORD=secret'],
      cmd: ['postgres'],
      entrypoint: ['docker-entrypoint.sh'],
      imageRef: 'postgres:17-alpine',
    });
  });

  test('defaults missing inspect fields without throwing', async () => {
    const mod = await load({
      getContainer: jest.fn(() => ({
        inspect: jest.fn().mockResolvedValue({ Id: 'bare' }),
      })),
    });

    const details = await mod.getContainerDetails('bare');

    expect(details.state).toBeNull();
    expect(details.exitCode).toBeNull();
    expect(details.restartCount).toBe(0);
    expect(details.healthStatus).toBeNull();
    expect(details.restarting).toBe(false);
    expect(details.labels).toEqual({});
  });

  test('returns null (does not throw) when the container is gone', async () => {
    const mod = await load({
      getContainer: jest.fn(() => ({
        inspect: jest.fn().mockRejectedValue(new Error('No such container')),
      })),
    });

    await expect(mod.getContainerDetails('gone')).resolves.toBeNull();
  });
});

describe('getManyContainerDetails', () => {
  afterEach(() => jest.resetModules());

  test('returns only the ids that were inspected successfully', async () => {
    const mod = await load({
      getContainer: jest.fn((id) => ({
        inspect: jest.fn(() =>
          id === 'bad'
            ? Promise.reject(new Error('gone'))
            : Promise.resolve({ ...inspectPayload, Id: id })
        ),
      })),
    });

    const map = await mod.getManyContainerDetails(['a', 'bad', 'b']);

    expect([...map.keys()].sort()).toEqual(['a', 'b']);
    expect(map.get('a').id).toBe('a');
  });

  test('never exceeds the concurrency limit', async () => {
    let active = 0;
    let peak = 0;

    const mod = await load({
      getContainer: jest.fn(() => ({
        inspect: jest.fn(
          () =>
            new Promise((resolve) => {
              active += 1;
              peak = Math.max(peak, active);
              setTimeout(() => {
                active -= 1;
                resolve(inspectPayload);
              }, 5);
            })
        ),
      })),
    });

    await mod.getManyContainerDetails(['1', '2', '3', '4', '5', '6'], {
      concurrency: 2,
    });

    expect(peak).toBeLessThanOrEqual(2);
    expect(peak).toBeGreaterThan(1);
  });

  test('empty list → empty map', async () => {
    const mod = await load({ getContainer: jest.fn() });
    const map = await mod.getManyContainerDetails([]);
    expect(map.size).toBe(0);
  });

  test('non-array ids → empty map (no throw)', async () => {
    const mod = await load({ getContainer: jest.fn() });
    const map = await mod.getManyContainerDetails(null);
    expect(map.size).toBe(0);
  });

  test('a concurrency of 0 is floored to 1', async () => {
    const mod = await load({
      getContainer: jest.fn(() => ({
        inspect: jest.fn().mockResolvedValue(inspectPayload),
      })),
    });
    const map = await mod.getManyContainerDetails(['x'], { concurrency: 0 });
    expect(map.size).toBe(1);
  });
});

describe('getContainerDetails — config for the prefill', () => {
  afterEach(() => jest.resetModules());

  test('a bare payload yields empty config arrays rather than undefined', async () => {
    const mod = await load({
      getContainer: jest.fn(() => ({
        inspect: jest.fn().mockResolvedValue({ Id: 'bare' }),
      })),
    });
    const details = await mod.getContainerDetails('bare');
    expect(details.env).toEqual([]);
    expect(details.cmd).toEqual([]);
    expect(details.entrypoint).toEqual([]);
    expect(details.imageRef).toBeNull();
  });

  test('non-string entries in Env are dropped', async () => {
    const mod = await load({
      getContainer: jest.fn(() => ({
        inspect: jest
          .fn()
          .mockResolvedValue({ Id: 'x', Config: { Env: ['A=1', 42, null] } }),
      })),
    });
    await expect(mod.getContainerDetails('x')).resolves.toMatchObject({
      env: ['A=1'],
    });
  });

  test('an Env that is not an array is ignored', async () => {
    const mod = await load({
      getContainer: jest.fn(() => ({
        inspect: jest
          .fn()
          .mockResolvedValue({ Id: 'x', Config: { Env: 'PATH=/bin' } }),
      })),
    });
    await expect(mod.getContainerDetails('x')).resolves.toMatchObject({
      env: [],
    });
  });
});

describe('getImageEnv', () => {
  afterEach(() => jest.resetModules());

  test('reads the env an image sets for itself', async () => {
    const mod = await load({
      getImage: jest.fn(() => ({
        inspect: jest
          .fn()
          .mockResolvedValue({ Config: { Env: ['PATH=/usr/bin', 'PG_VERSION=17'] } }),
      })),
    });
    await expect(mod.getImageEnv('postgres:17-alpine')).resolves.toEqual([
      'PATH=/usr/bin',
      'PG_VERSION=17',
    ]);
  });

  test('falls back to ContainerConfig and config, as older payloads do', async () => {
    const asContainerConfig = await load({
      getImage: jest.fn(() => ({
        inspect: jest
          .fn()
          .mockResolvedValue({ ContainerConfig: { Env: ['A=1'] } }),
      })),
    });
    await expect(asContainerConfig.getImageEnv('x')).resolves.toEqual(['A=1']);

    jest.resetModules();
    const asConfig = await load({
      getImage: jest.fn(() => ({
        inspect: jest.fn().mockResolvedValue({ config: { Env: ['B=2'] } }),
      })),
    });
    await expect(asConfig.getImageEnv('x')).resolves.toEqual(['B=2']);
  });

  test('an image with no ENV at all is an empty list, not null', async () => {
    const mod = await load({
      getImage: jest.fn(() => ({
        inspect: jest.fn().mockResolvedValue({ Config: {} }),
      })),
    });
    // null means "we could not find out"; this one we did find out.
    await expect(mod.getImageEnv('scratch')).resolves.toEqual([]);
  });

  test('a dangling image resolves null, not a rejection', async () => {
    const mod = await load({
      getImage: jest.fn(() => {
        throw new Error('no such image');
      }),
    });
    await expect(mod.getImageEnv('gone:1')).resolves.toBeNull();
  });

  test('a rejected inspect resolves null', async () => {
    const mod = await load({
      getImage: jest.fn(() => ({
        inspect: jest.fn().mockRejectedValue(new Error('daemon gone')),
      })),
    });
    await expect(mod.getImageEnv('x')).resolves.toBeNull();
  });

  test('an unusable reference is null rather than a throw', async () => {
    const mod = await load({
      getImage: jest.fn(() => ({})),
    });
    await expect(mod.getImageEnv('')).resolves.toBeNull();
    await expect(mod.getImageEnv(null)).resolves.toBeNull();
    await expect(mod.getImageEnv('x')).resolves.toBeNull();
  });

  test('a non-array Env is treated as none', async () => {
    const mod = await load({
      getImage: jest.fn(() => ({
        inspect: jest.fn().mockResolvedValue({ Config: { Env: 'PATH=/bin' } }),
      })),
    });
    await expect(mod.getImageEnv('x')).resolves.toEqual([]);
  });
});
