import { jest } from '@jest/globals';

describe('containerList.getContainers', () => {
  afterEach(() => jest.resetModules());

  const baseContainer = {
    Id: 'abc123',
    Image: 'nginx:latest',
    State: 'running',
    Status: 'Up 5 minutes',
    Ports: []
  };

  test('falls back to container.Name when Names array is missing', async () => {
    const dockerMock = {
      listContainers: jest.fn().mockResolvedValue([
        {
          ...baseContainer,
          Names: undefined,
          Name: '/custom-container'
        }
      ])
    };

    await jest.unstable_mockModule('../src/helpers/dockerService/dockerService.js', () => ({
      docker: dockerMock
    }));

    const mod = await import('../src/helpers/dockerService/serviceComponents/containerList.js');
    const containers = await mod.getContainers();

    expect(containers).toHaveLength(1);
    expect(containers[0].name).toBe('custom-container');
  });

  test('returns Unknown when no usable name data is present', async () => {
    const dockerMock = {
      listContainers: jest.fn().mockResolvedValue([
        {
          ...baseContainer,
          Names: [],
          Name: '',
          Id: 'def456'
        }
      ])
    };

    await jest.unstable_mockModule('../src/helpers/dockerService/dockerService.js', () => ({
      docker: dockerMock
    }));

    const mod = await import('../src/helpers/dockerService/serviceComponents/containerList.js');
    const containers = await mod.getContainers();

    expect(containers).toHaveLength(1);
    expect(containers[0].name).toBe('Unknown');
  });

  test('normalizes first entry in Names array', async () => {
    const dockerMock = {
      listContainers: jest.fn().mockResolvedValue([
        {
          ...baseContainer,
          Names: ['///leading/slash', '/ignored-second']
        }
      ])
    };

    await jest.unstable_mockModule('../src/helpers/dockerService/dockerService.js', () => ({
      docker: dockerMock
    }));

    const mod = await import('../src/helpers/dockerService/serviceComponents/containerList.js');
    const containers = await mod.getContainers();

    expect(containers).toHaveLength(1);
    expect(containers[0].name).toBe('leading/slash');
  });
});
