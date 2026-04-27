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
});
