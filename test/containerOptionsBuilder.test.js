let buildContainerOptions;

beforeAll(async () => {
  const mod = await import('../src/helpers/containerOptionsBuilder.js');
  buildContainerOptions = mod.buildContainerOptions;
});

describe('buildContainerOptions', () => {
  test('basic image only sets Tty', () => {
    const opts = buildContainerOptions({ imageName: 'nginx' });
    expect(opts.Tty).toBe(true);
    expect(opts.Env).toBeUndefined();
  });

  test('env var with value containing = is preserved intact', () => {
    const opts = buildContainerOptions({ imageName: 'nginx', envInput: 'TOKEN=a=b' });
    expect(opts.Env).toEqual(['TOKEN=a=b']);
  });

  test('multiple env vars with = in values are all preserved', () => {
    const opts = buildContainerOptions({ imageName: 'nginx', envInput: 'TOKEN=a=b,DSN=user:pass@host/db?opt=1' });
    expect(opts.Env).toContain('TOKEN=a=b');
    expect(opts.Env).toContain('DSN=user:pass@host/db?opt=1');
  });

  test('port input builds ExposedPorts and PortBindings', () => {
    const opts = buildContainerOptions({ imageName: 'nginx', portInput: '8080:80' });
    expect(opts.ExposedPorts).toEqual({ '80/tcp': {} });
    expect(opts.HostConfig.PortBindings['80/tcp']).toEqual([{ HostPort: '8080' }]);
  });

  test('container name is included when provided', () => {
    const opts = buildContainerOptions({ imageName: 'nginx', containerName: 'my-nginx' });
    expect(opts.name).toBe('my-nginx');
  });
});

describe('buildContainerOptions — port edge cases', () => {
  test('multiple ports → two ExposedPorts entries', () => {
    const o = buildContainerOptions({ imageName: 'x', portInput: '8080:80,443:443' });
    expect(Object.keys(o.ExposedPorts)).toEqual(['80/tcp', '443/tcp']);
    expect(o.HostConfig.PortBindings['443/tcp']).toEqual([{ HostPort: '443' }]);
  });

  test('spaces around commas are trimmed', () => {
    const o = buildContainerOptions({ imageName: 'x', portInput: '8080:80, 443:443' });
    expect(Object.keys(o.ExposedPorts)).toHaveLength(2);
  });

  test('two hosts to the same container port accumulate', () => {
    const o = buildContainerOptions({ imageName: 'x', portInput: '8080:80,9090:80' });
    expect(o.HostConfig.PortBindings['80/tcp']).toEqual([
      { HostPort: '8080' },
      { HostPort: '9090' },
    ]);
  });

  test.each([[undefined], ['']])('portInput %p → no ports', (portInput) => {
    const o = buildContainerOptions({ imageName: 'x', portInput });
    expect(o.ExposedPorts).toBeUndefined();
    expect(o.HostConfig).toBeUndefined();
  });

  test.each([['8080:'], [':80'], ['8080']])('incomplete pair %p → ignored', (p) => {
    const o = buildContainerOptions({ imageName: 'x', portInput: p });
    expect(o.ExposedPorts).toBeUndefined();
  });

  test.each([[undefined], ['']])('envInput %p → no Env', (envInput) => {
    expect(buildContainerOptions({ imageName: 'x', envInput }).Env).toBeUndefined();
  });

  test('only containerName → { Tty, name }', () => {
    expect(buildContainerOptions({ imageName: 'x', containerName: 'web' })).toEqual({
      Tty: true,
      name: 'web',
    });
  });

  test('imageName is not copied into options (createContainer sets Image)', () => {
    expect(buildContainerOptions({ imageName: 'nginx' }).Image).toBeUndefined();
  });
});
