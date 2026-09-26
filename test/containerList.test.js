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

describe('containerList — port formatting and errors', () => {
  afterEach(() => jest.resetModules());

  async function listWith(rawContainers) {
    await jest.unstable_mockModule('../src/helpers/dockerService/dockerService.js', () => ({
      docker: { listContainers: jest.fn().mockResolvedValue(rawContainers) },
    }));
    const mod = await import(
      '../src/helpers/dockerService/serviceComponents/containerList.js'
    );
    return mod.getContainers();
  }

  const baseContainer = {
    Id: 'abc123',
    Image: 'nginx:latest',
    State: 'running',
    Status: 'Up 5 minutes',
    Ports: [],
  };

  test('published ports are formatted as "public:private"', async () => {
    const list = await listWith([
      { ...baseContainer, Ports: [{ PublicPort: 8080, PrivatePort: 80 }] },
    ]);
    expect(list[0].ports).toEqual(['8080:80']);
  });

  test('without bindings falls back to private ports', async () => {
    const list = await listWith([
      { ...baseContainer, Ports: [{ PrivatePort: 80 }] },
    ]);
    expect(list[0].ports).toEqual(['80']);
  });

  test('removes duplicates (IPv4 + IPv6 of the same binding)', async () => {
    const list = await listWith([
      {
        ...baseContainer,
        Ports: [
          { PublicPort: 8080, PrivatePort: 80 },
          { PublicPort: 8080, PrivatePort: 80 },
        ],
      },
    ]);
    expect(list[0].ports).toEqual(['8080:80']);
  });

  test('empty Ports → empty array', async () => {
    const list = await listWith([{ ...baseContainer, Ports: [] }]);
    expect(list[0].ports).toEqual([]);
  });

  test('listContainers error is propagated after logging', async () => {
    await jest.unstable_mockModule('../src/helpers/dockerService/dockerService.js', () => ({
      docker: {
        listContainers: jest.fn().mockRejectedValue(new Error('daemon down')),
      },
    }));
    const mod = await import(
      '../src/helpers/dockerService/serviceComponents/containerList.js'
    );

    await expect(mod.getContainers()).rejects.toThrow('daemon down');
  });
});
