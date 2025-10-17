import { jest } from '@jest/globals';

describe('containerActions service functions (mocked ESM imports)', () => {
  afterEach(() => jest.resetModules());

  test('createContainer returns id when image exists', async () => {
    // mock imageUtils and dockerService before importing the module under test
    const imageUtilsMock = {
      imageExists: jest.fn().mockResolvedValue(true),
      pullImage: jest.fn()
    };

    const inspectMock = jest.fn().mockResolvedValue({ Config: { ExposedPorts: {} } });
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

    const id = await mod.createContainer('nginx:latest', { Name: 'test' });
    expect(id).toBe('cid-123');
    const imageUtils = await import('../src/helpers/dockerService/serviceComponents/imageUtils.js');
    expect(imageUtils.imageExists).toHaveBeenCalledWith('nginx:latest');
    const ds = await import('../src/helpers/dockerService/dockerService.js');
    expect(ds.docker.createContainer).toHaveBeenCalled();
    expect(ds.docker.getImage).toHaveBeenCalledWith('nginx:latest');
  });

  test('createContainer pulls image when not present and returns Id', async () => {
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
    const id = await mod.createContainer('busybox:1.0');
    expect(id).toBe('CID-456');
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
