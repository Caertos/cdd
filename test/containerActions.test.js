import { jest } from '@jest/globals';

describe('containerActions service functions (mocked ESM imports)', () => {
  afterEach(() => jest.resetModules());

  test('createContainer returns { id, ports } when image exists', async () => {
    const imageUtilsMock = {
      imageExists: jest.fn().mockResolvedValue(true),
      pullImage: jest.fn()
    };

    const inspectMock = jest.fn().mockResolvedValue({ Config: { ExposedPorts: { '3306/tcp': {} } } });
    const dockerMock = {
      createContainer: jest.fn().mockResolvedValue({ id: 'cid-123' }),
      getImage: jest.fn().mockReturnValue({ inspect: inspectMock }),
      listContainers: jest.fn().mockResolvedValue([])
    };

    await jest.unstable_mockModule('../src/helpers/dockerService/serviceComponents/imageUtils.js', () => ({
      ...imageUtilsMock
    }));

    await jest.unstable_mockModule('../src/helpers/dockerService/dockerService.js', () => ({
      docker: dockerMock
    }));

    const mod = await import('../src/helpers/dockerService/serviceComponents/containerActions.js');

    const result = await mod.createContainer('mysql:8', { Name: 'test' });
    expect(result).toHaveProperty('id', 'cid-123');
    expect(result).toHaveProperty('ports');
    expect(Array.isArray(result.ports)).toBe(true);
  });

  test('createContainer ports contain containerPort, hostPort, protocol, source fields', async () => {
    const imageUtilsMock = {
      imageExists: jest.fn().mockResolvedValue(true),
      pullImage: jest.fn()
    };

    const inspectMock = jest.fn().mockResolvedValue({ Config: { ExposedPorts: { '80/tcp': {} } } });
    const dockerMock = {
      createContainer: jest.fn().mockResolvedValue({ id: 'cid-ports' }),
      getImage: jest.fn().mockReturnValue({ inspect: inspectMock }),
      listContainers: jest.fn().mockResolvedValue([])
    };

    await jest.unstable_mockModule('../src/helpers/dockerService/serviceComponents/imageUtils.js', () => ({
      ...imageUtilsMock
    }));

    await jest.unstable_mockModule('../src/helpers/dockerService/dockerService.js', () => ({
      docker: dockerMock
    }));

    const mod = await import('../src/helpers/dockerService/serviceComponents/containerActions.js');
    const result = await mod.createContainer('nginx:latest', {});
    expect(result.ports.length).toBeGreaterThan(0);
    const port = result.ports[0];
    expect(port).toHaveProperty('containerPort');
    expect(port).toHaveProperty('hostPort');
    expect(port).toHaveProperty('protocol');
    expect(port).toHaveProperty('source');
  });

  test('createContainer uses IMAGE_PROFILES defaultPort as fallback when ExposedPorts empty', async () => {
    const imageUtilsMock = {
      imageExists: jest.fn().mockResolvedValue(true),
      pullImage: jest.fn()
    };

    // inspect returns empty ExposedPorts
    const inspectMock = jest.fn().mockResolvedValue({ Config: { ExposedPorts: {} } });
    const dockerMock = {
      createContainer: jest.fn().mockResolvedValue({ id: 'cid-fallback' }),
      getImage: jest.fn().mockReturnValue({ inspect: inspectMock }),
      listContainers: jest.fn().mockResolvedValue([])
    };

    await jest.unstable_mockModule('../src/helpers/dockerService/serviceComponents/imageUtils.js', () => ({
      ...imageUtilsMock
    }));

    await jest.unstable_mockModule('../src/helpers/dockerService/dockerService.js', () => ({
      docker: dockerMock
    }));

    const { IMAGE_PROFILES } = await import('../src/helpers/constants.js');
    const mod = await import('../src/helpers/dockerService/serviceComponents/containerActions.js');
    const result = await mod.createContainer('mysql:8', {}, IMAGE_PROFILES);

    expect(result.id).toBe('cid-fallback');
    // Should have auto port from defaultPort fallback
    const mysqlDefault = IMAGE_PROFILES.mysql.defaultPort;
    const portEntry = result.ports.find(p => p.containerPort === mysqlDefault);
    expect(portEntry).toBeDefined();
    expect(portEntry.source).toBe('auto');
  });

  test('createContainer returns { id, ports: [] } when no ports and image not in profiles', async () => {
    const imageUtilsMock = {
      imageExists: jest.fn().mockResolvedValue(true),
      pullImage: jest.fn()
    };

    const inspectMock = jest.fn().mockResolvedValue({ Config: { ExposedPorts: {} } });
    const dockerMock = {
      createContainer: jest.fn().mockResolvedValue({ id: 'cid-noport' }),
      getImage: jest.fn().mockReturnValue({ inspect: inspectMock }),
      listContainers: jest.fn().mockResolvedValue([])
    };

    await jest.unstable_mockModule('../src/helpers/dockerService/serviceComponents/imageUtils.js', () => ({
      ...imageUtilsMock
    }));

    await jest.unstable_mockModule('../src/helpers/dockerService/dockerService.js', () => ({
      docker: dockerMock
    }));

    const { IMAGE_PROFILES } = await import('../src/helpers/constants.js');
    const mod = await import('../src/helpers/dockerService/serviceComponents/containerActions.js');
    const result = await mod.createContainer('unknownimage:latest', {}, IMAGE_PROFILES);

    expect(result.id).toBe('cid-noport');
    expect(result.ports).toEqual([]);
  });

  test('createContainer pulls image when not present and returns { id, ports }', async () => {
    const imageUtilsMock = {
      imageExists: jest.fn().mockResolvedValue(false),
      pullImage: jest.fn().mockResolvedValue(true)
    };

    const inspectMock = jest.fn().mockResolvedValue({ Config: { ExposedPorts: {} } });
    const dockerMock = {
      createContainer: jest.fn().mockResolvedValue({ Id: 'CID-456' }),
      getImage: jest.fn().mockReturnValue({ inspect: inspectMock }),
      listContainers: jest.fn().mockResolvedValue([])
    };

    await jest.unstable_mockModule('../src/helpers/dockerService/serviceComponents/imageUtils.js', () => ({
      ...imageUtilsMock
    }));

    await jest.unstable_mockModule('../src/helpers/dockerService/dockerService.js', () => ({
      docker: dockerMock
    }));

    const mod = await import('../src/helpers/dockerService/serviceComponents/containerActions.js');
    const result = await mod.createContainer('busybox:1.0');
    expect(result.id).toBe('CID-456');
    expect(result).toHaveProperty('ports');
    const imageUtils = await import('../src/helpers/dockerService/serviceComponents/imageUtils.js');
    expect(imageUtils.pullImage).toHaveBeenCalledWith('busybox:1.0');
  });

  test('createContainer auto maps exposed ports when ports not provided', async () => {
    const imageUtilsMock = {
      imageExists: jest.fn().mockResolvedValue(true),
      pullImage: jest.fn()
    };

    const inspectMock = jest.fn().mockResolvedValue({ Config: { ExposedPorts: { '80/tcp': {} } } });
    const createContainerMock = jest.fn().mockResolvedValue({ id: 'cid-auto' });
    const dockerMock = {
      createContainer: createContainerMock,
      getImage: jest.fn().mockReturnValue({ inspect: inspectMock }),
      listContainers: jest.fn().mockResolvedValue([
        { Ports: [{ PublicPort: 80, PrivatePort: 80 }] }
      ])
    };

    await jest.unstable_mockModule('../src/helpers/dockerService/serviceComponents/imageUtils.js', () => ({
      ...imageUtilsMock
    }));

    await jest.unstable_mockModule('../src/helpers/dockerService/dockerService.js', () => ({
      docker: dockerMock
    }));

    const mod = await import('../src/helpers/dockerService/serviceComponents/containerActions.js');
    await mod.createContainer('nginx:alpine');

    const [[createArgs]] = createContainerMock.mock.calls;
    expect(createArgs.ExposedPorts).toEqual({ '80/tcp': {} });
    expect(createArgs.HostConfig.PortBindings['80/tcp']).toEqual([{ HostPort: '81' }]);
    expect(dockerMock.listContainers).toHaveBeenCalled();
  });

  test('removeContainer calls docker.remove with force', async () => {
    const removeMock = jest.fn().mockResolvedValue(undefined);
    const dockerMock = {
      getContainer: jest.fn().mockReturnValue({ remove: removeMock })
    };

    await jest.unstable_mockModule('../src/helpers/dockerService/dockerService.js', () => ({ docker: dockerMock }));
    await jest.unstable_mockModule('../src/helpers/dockerService/serviceComponents/imageUtils.js', () => ({ imageExists: jest.fn(), pullImage: jest.fn() }));

    const mod = await import('../src/helpers/dockerService/serviceComponents/containerActions.js');
    await mod.removeContainer('abc');
    const ds = await import('../src/helpers/dockerService/dockerService.js');
    expect(ds.docker.getContainer).toHaveBeenCalledWith('abc');
    expect(removeMock).toHaveBeenCalledWith({ force: true });
  });

  test('start/stop/restart call respective container methods', async () => {
    const startMock = jest.fn().mockResolvedValue(undefined);
    const stopMock = jest.fn().mockResolvedValue(undefined);
    const restartMock = jest.fn().mockResolvedValue(undefined);

    const dockerMock = {
      getContainer: jest.fn().mockReturnValue({ start: startMock, stop: stopMock, restart: restartMock })
    };

    await jest.unstable_mockModule('../src/helpers/dockerService/dockerService.js', () => ({ docker: dockerMock }));
    await jest.unstable_mockModule('../src/helpers/dockerService/serviceComponents/imageUtils.js', () => ({ imageExists: jest.fn(), pullImage: jest.fn() }));

    const mod = await import('../src/helpers/dockerService/serviceComponents/containerActions.js');

    await mod.startContainer('c1');
    await mod.stopContainer('c1');
    await mod.restartContainer('c1');

    expect(startMock).toHaveBeenCalled();
    expect(stopMock).toHaveBeenCalled();
    expect(restartMock).toHaveBeenCalled();
  });

  test('withTimeout leaves no pending timers when the promise wins the race', async () => {
    jest.useFakeTimers();
    try {
      await jest.unstable_mockModule('../src/helpers/dockerService/dockerService.js', () => ({
        docker: {
          getContainer: jest.fn().mockReturnValue({
            start: jest.fn().mockResolvedValue(undefined),
          }),
        },
      }));
      await jest.unstable_mockModule(
        '../src/helpers/dockerService/serviceComponents/imageUtils.js',
        () => ({ imageExists: jest.fn(), pullImage: jest.fn() })
      );
      const mod = await import(
        '../src/helpers/dockerService/serviceComponents/containerActions.js'
      );
      await mod.startContainer('cid-1');
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('containerActions — validation and error paths', () => {
  afterEach(() => jest.resetModules());

  async function loadActions(imageUtilsMock, dockerMock) {
    await jest.unstable_mockModule(
      '../src/helpers/dockerService/serviceComponents/imageUtils.js',
      () => imageUtilsMock
    );
    await jest.unstable_mockModule('../src/helpers/dockerService/dockerService.js', () => ({
      docker: dockerMock,
    }));
    return import('../src/helpers/dockerService/serviceComponents/containerActions.js');
  }

  test('createContainer rejects an invalid image name before touching Docker', async () => {
    const imageUtilsMock = { imageExists: jest.fn(), pullImage: jest.fn() };
    const mod = await loadActions(imageUtilsMock, {
      createContainer: jest.fn(),
      listContainers: jest.fn(),
    });

    await expect(mod.createContainer('--rm')).rejects.toThrow('Invalid image name');
    expect(imageUtilsMock.imageExists).not.toHaveBeenCalled();
  });

  test('createContainer rejects an invalid container name', async () => {
    const imageUtilsMock = { imageExists: jest.fn(), pullImage: jest.fn() };
    const mod = await loadActions(imageUtilsMock, {
      createContainer: jest.fn(),
      listContainers: jest.fn(),
    });

    await expect(
      mod.createContainer('nginx', { name: 'con espacio' })
    ).rejects.toThrow('Invalid container name');
    expect(imageUtilsMock.imageExists).not.toHaveBeenCalled();
  });

  test('failed pull → "Could not pull image"', async () => {
    const imageUtilsMock = {
      imageExists: jest.fn().mockResolvedValue(false),
      pullImage: jest.fn().mockRejectedValue(new Error('denied')),
    };
    const mod = await loadActions(imageUtilsMock, { listContainers: jest.fn() });

    await expect(mod.createContainer('nginx')).rejects.toThrow(
      'Could not pull image: denied'
    );
  });

  test('failed listImages → "Error listing local images"', async () => {
    const imageUtilsMock = {
      imageExists: jest.fn().mockRejectedValue(new Error('boom')),
      pullImage: jest.fn(),
    };
    const mod = await loadActions(imageUtilsMock, { listContainers: jest.fn() });

    await expect(mod.createContainer('nginx')).rejects.toThrow(
      'Error listing local images: boom'
    );
  });

  test('user-defined ports are marked with source "user"', async () => {
    const imageUtilsMock = {
      imageExists: jest.fn().mockResolvedValue(true),
      pullImage: jest.fn(),
    };
    const dockerMock = {
      createContainer: jest.fn().mockResolvedValue({ id: 'cid-user' }),
      getImage: jest.fn(),
      listContainers: jest.fn(),
    };
    const mod = await loadActions(imageUtilsMock, dockerMock);

    const r = await mod.createContainer('nginx', {
      ExposedPorts: { '80/tcp': {} },
      HostConfig: { PortBindings: { '80/tcp': [{ HostPort: '8080' }] } },
    });

    expect(r.ports).toEqual([
      { containerPort: '80', hostPort: '8080', protocol: 'tcp', source: 'user' },
    ]);
    expect(dockerMock.getImage).not.toHaveBeenCalled();
  });

  test.each([
    ['startContainer', 'start'],
    ['stopContainer', 'stop'],
    ['restartContainer', 'restart'],
  ])('%s propagates the daemon error', async (fn, method) => {
    const daemonError = new Error('daemon down');
    const mod = await loadActions(
      { imageExists: jest.fn(), pullImage: jest.fn() },
      {
        getContainer: jest.fn().mockReturnValue({
          [method]: jest.fn().mockRejectedValue(daemonError),
        }),
      }
    );

    await expect(mod[fn]('cid')).rejects.toThrow('daemon down');
  });

  test('removeContainer wraps the error in "Error removing container"', async () => {
    const mod = await loadActions(
      { imageExists: jest.fn(), pullImage: jest.fn() },
      {
        getContainer: jest.fn().mockReturnValue({
          remove: jest.fn().mockRejectedValue(new Error('nope')),
        }),
      }
    );

    await expect(mod.removeContainer('cid')).rejects.toThrow(
      'Error removing container: nope'
    );
  });

  test('env vars are redacted in the log (password not leaked)', async () => {
    const mod = await loadActions(
      {
        imageExists: jest.fn().mockResolvedValue(true),
        pullImage: jest.fn(),
      },
      {
        createContainer: jest.fn().mockResolvedValue({ id: 'cid-redact' }),
        getImage: jest.fn().mockReturnValue({
          inspect: jest.fn().mockResolvedValue({ Config: { ExposedPorts: {} } }),
        }),
        listContainers: jest.fn().mockResolvedValue([]),
      }
    );
    const { logger } = await import('../src/helpers/logger.js');
    const debug = jest.spyOn(logger, 'debug').mockImplementation(() => {});

    try {
      await mod.createContainer('nginx', { Env: ['POSTGRES_PASSWORD=s3cr3t'] });
      const line = debug.mock.calls.flat().join(' ');
      expect(line).not.toContain('s3cr3t');
      expect(line).toContain('***');
    } finally {
      debug.mockRestore();
    }
  });
});
