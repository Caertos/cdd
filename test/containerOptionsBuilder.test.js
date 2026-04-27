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
