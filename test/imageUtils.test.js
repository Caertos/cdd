/**
 * @jest-environment node
 */
import { jest } from '@jest/globals';

afterEach(() => jest.resetModules());

/** Load imageUtils with a mocked docker client. */
async function loadImageUtils(dockerMock) {
  await jest.unstable_mockModule('../src/helpers/dockerService/dockerService.js', () => ({
    docker: dockerMock,
  }));
  return import('../src/helpers/dockerService/serviceComponents/imageUtils.js');
}

describe('imageExists', () => {
  test('match in RepoTags → true', async () => {
    const { imageExists } = await loadImageUtils({
      listImages: jest.fn().mockResolvedValue([{ RepoTags: ['nginx:alpine'] }]),
    });
    expect(await imageExists('nginx:alpine')).toBe(true);
  });

  test('match in RepoDigests → true', async () => {
    const { imageExists } = await loadImageUtils({
      listImages: jest
        .fn()
        .mockResolvedValue([{ RepoDigests: ['nginx@sha256:abc'] }]),
    });
    expect(await imageExists('nginx')).toBe(true);
  });

  test('no match → false', async () => {
    const { imageExists } = await loadImageUtils({
      listImages: jest.fn().mockResolvedValue([{ RepoTags: ['redis:7'] }]),
    });
    expect(await imageExists('nginx:alpine')).toBe(false);
  });

  test('missing RepoTags/RepoDigests → does not throw', async () => {
    const { imageExists } = await loadImageUtils({
      listImages: jest.fn().mockResolvedValue([{}]),
    });
    await expect(imageExists('nginx')).resolves.toBe(false);
  });
});

describe('pullImage', () => {
  test('successful pull → resolves', async () => {
    const { pullImage } = await loadImageUtils({
      pull: jest.fn((name, cb) => cb(null, 'stream')),
      modem: { followProgress: jest.fn((stream, done) => done(null)) },
    });
    await expect(pullImage('nginx')).resolves.toBeUndefined();
  });

  test('pull error → rejects with "Error pulling image"', async () => {
    const { pullImage } = await loadImageUtils({
      pull: jest.fn((name, cb) => cb(new Error('denied'))),
      modem: { followProgress: jest.fn() },
    });
    await expect(pullImage('nginx')).rejects.toThrow('Error pulling image: denied');
  });

  test('error during stream → rejects with "Error during pull"', async () => {
    const { pullImage } = await loadImageUtils({
      pull: jest.fn((name, cb) => cb(null, 'stream')),
      modem: { followProgress: jest.fn((s, done) => done(new Error('eof'))) },
    });
    await expect(pullImage('nginx')).rejects.toThrow('Error during pull: eof');
  });
});

describe('previewAutoPorts', () => {
  const withImage = (exposed, extra = {}) => ({
    listImages: jest.fn().mockResolvedValue([{ RepoTags: ['nginx:alpine'] }]),
    getImage: jest.fn().mockReturnValue({
      inspect: jest.fn().mockResolvedValue({ Config: { ExposedPorts: exposed } }),
    }),
    ...extra,
  });

  test('local image with ExposedPorts → returns the mapping', async () => {
    const { previewAutoPorts } = await loadImageUtils(withImage({ '80/tcp': {} }));
    expect(await previewAutoPorts('nginx:alpine', [])).toEqual([
      { containerPort: '80', hostPort: '80', protocol: 'tcp' },
    ]);
  });

  test('no ExposedPorts but profile → uses defaultPort', async () => {
    const { previewAutoPorts } = await loadImageUtils({
      listImages: jest.fn().mockResolvedValue([{ RepoTags: ['redis:7-alpine'] }]),
      getImage: jest.fn().mockReturnValue({
        inspect: jest.fn().mockResolvedValue({ Config: {} }),
      }),
    });
    expect(await previewAutoPorts('redis:7-alpine', [])).toEqual([
      { containerPort: '6379', hostPort: '6379', protocol: 'tcp' },
    ]);
  });

  test('no ExposedPorts and no profile → null', async () => {
    const { previewAutoPorts } = await loadImageUtils({
      listImages: jest.fn().mockResolvedValue([{ RepoTags: ['raro:1'] }]),
      getImage: jest.fn().mockReturnValue({
        inspect: jest.fn().mockResolvedValue({ Config: {} }),
      }),
    });
    expect(await previewAutoPorts('raro:1', [])).toBeNull();
  });

  test('image not local → null', async () => {
    const { previewAutoPorts } = await loadImageUtils({
      listImages: jest.fn().mockResolvedValue([]),
    });
    expect(await previewAutoPorts('nginx:alpine', [])).toBeNull();
  });

  test('listImages fails → null', async () => {
    const { previewAutoPorts } = await loadImageUtils({
      listImages: jest.fn().mockRejectedValue(new Error('down')),
    });
    expect(await previewAutoPorts('nginx:alpine', [])).toBeNull();
  });

  test('inspect fails → null', async () => {
    const { previewAutoPorts } = await loadImageUtils({
      listImages: jest.fn().mockResolvedValue([{ RepoTags: ['nginx:alpine'] }]),
      getImage: jest.fn().mockReturnValue({
        inspect: jest.fn().mockRejectedValue(new Error('no such image')),
      }),
    });
    expect(await previewAutoPorts('nginx:alpine', [])).toBeNull();
  });

  test('udp protocol is preserved', async () => {
    const { previewAutoPorts } = await loadImageUtils(withImage({ '53/udp': {} }));
    expect(await previewAutoPorts('nginx:alpine', [])).toEqual([
      { containerPort: '53', hostPort: '53', protocol: 'udp' },
    ]);
  });

  test('container with ports undefined → ignored without breaking', async () => {
    const { previewAutoPorts } = await loadImageUtils(withImage({ '80/tcp': {} }));
    await expect(previewAutoPorts('nginx:alpine', [{}])).resolves.toHaveLength(1);
  });

  // Deferred with §5.3 (previewAutoPorts collision avoidance): the test
  // 'avoids an already-used port when given normalized containers' fails
  // today and must land together with that fix.
});
