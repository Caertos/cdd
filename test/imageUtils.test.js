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

/** Error shape the docker daemon returns for a missing image. */
function noSuchImageError() {
  const err = new Error('(HTTP code 404) no such image - No such image: pg');
  err.statusCode = 404;
  err.reason = 'no such image';
  return err;
}

describe('imageExists', () => {
  test('image present in the daemon → true', async () => {
    const { imageExists } = await loadImageUtils({
      getImage: jest.fn().mockReturnValue({
        inspect: jest.fn().mockResolvedValue({ Id: 'sha256:abc' }),
      }),
    });
    expect(await imageExists('nginx:alpine')).toBe(true);
  });

  test('image missing (404) → false', async () => {
    const { imageExists } = await loadImageUtils({
      getImage: jest.fn().mockReturnValue({
        inspect: jest.fn().mockRejectedValue(noSuchImageError()),
      }),
    });
    expect(await imageExists('nginx:alpine')).toBe(false);
  });

  // Regression: the old listImages() check matched by substring, so a digest
  // containing the requested name made any prefix look local.
  test('a digest containing the name as substring does not make it local → false', async () => {
    const dockerMock = {
      getImage: jest.fn((name) => ({
        inspect: jest.fn(async () => {
          if (name === 'pg') throw noSuchImageError();
          return {
            Id: 'sha256:abc',
            RepoDigests: ['dpage/pgadmin4@sha256:abc'],
          };
        }),
      })),
    };
    const { imageExists } = await loadImageUtils(dockerMock);
    expect(await imageExists('pg')).toBe(false);
  });

  test('daemon error that is not a 404 → rejects (unknown, not "missing")', async () => {
    const { imageExists } = await loadImageUtils({
      getImage: jest.fn().mockReturnValue({
        inspect: jest
          .fn()
          .mockRejectedValue(new Error('Cannot connect to the Docker daemon')),
      }),
    });
    await expect(imageExists('nginx:alpine')).rejects.toThrow(
      'Cannot connect to the Docker daemon'
    );
  });

  test('"no such image" reason without statusCode → false', async () => {
    const err = new Error('no such image');
    err.reason = 'no such image';
    const { imageExists } = await loadImageUtils({
      getImage: jest.fn().mockReturnValue({
        inspect: jest.fn().mockRejectedValue(err),
      }),
    });
    expect(await imageExists('nginx:alpine')).toBe(false);
  });

  test('empty image name → the daemon decides: 404 means not local → false', async () => {
    const { imageExists } = await loadImageUtils({
      getImage: jest.fn().mockReturnValue({
        inspect: jest.fn().mockRejectedValue(noSuchImageError()),
      }),
    });
    expect(await imageExists('')).toBe(false);
  });

  test('image without tag is queried verbatim → the daemon resolves it', async () => {
    const dockerMock = {
      getImage: jest.fn().mockReturnValue({
        inspect: jest.fn().mockResolvedValue({ Id: 'sha256:abc' }),
      }),
    };
    const { imageExists } = await loadImageUtils(dockerMock);
    expect(await imageExists('nginx')).toBe(true);
    expect(dockerMock.getImage).toHaveBeenCalledWith('nginx');
  });
});

describe('pullImage', () => {
  test('successful pull → resolves', async () => {
    const { pullImage } = await loadImageUtils({
      pull: jest.fn((_name, cb) => cb(null, 'stream')),
      modem: { followProgress: jest.fn((_stream, done) => done(null)) },
    });
    await expect(pullImage('nginx')).resolves.toBeUndefined();
  });

  test('pull error → rejects with "Error pulling image"', async () => {
    const { pullImage } = await loadImageUtils({
      pull: jest.fn((_name, cb) => cb(new Error('denied'))),
      modem: { followProgress: jest.fn() },
    });
    await expect(pullImage('nginx')).rejects.toThrow('Error pulling image: denied');
  });

  test('error during stream → rejects with "Error during pull"', async () => {
    const { pullImage } = await loadImageUtils({
      pull: jest.fn((_name, cb) => cb(null, 'stream')),
      modem: { followProgress: jest.fn((_s, done) => done(new Error('eof'))) },
    });
    await expect(pullImage('nginx')).rejects.toThrow('Error during pull: eof');
  });
});

describe('previewAutoPorts', () => {
  const withImage = (exposed, extra = {}) => ({
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
      getImage: jest.fn().mockReturnValue({
        inspect: jest.fn().mockResolvedValue({ Config: {} }),
      }),
    });
    expect(await previewAutoPorts('raro:1', [])).toBeNull();
  });

  test('image not local (404) → null', async () => {
    const { previewAutoPorts } = await loadImageUtils({
      getImage: jest.fn().mockReturnValue({
        inspect: jest.fn().mockRejectedValue(noSuchImageError()),
      }),
    });
    expect(await previewAutoPorts('nginx:alpine', [])).toBeNull();
  });

  test('inspect fails (daemon error) → null', async () => {
    const { previewAutoPorts } = await loadImageUtils({
      getImage: jest.fn().mockReturnValue({
        inspect: jest.fn().mockRejectedValue(new Error('down')),
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

  test('a container with ports undefined → ignored without breaking', async () => {
    const { previewAutoPorts } = await loadImageUtils(withImage({ '80/tcp': {} }));
    await expect(previewAutoPorts('nginx:alpine', [{}])).resolves.toHaveLength(1);
  });

  test('queries the daemon only once', async () => {
    const dockerMock = withImage({ '80/tcp': {} });
    const { previewAutoPorts } = await loadImageUtils(dockerMock);
    expect(await previewAutoPorts('nginx:alpine', [])).toHaveLength(1);
    expect(dockerMock.getImage).toHaveBeenCalledTimes(1);
    expect(dockerMock.getImage.mock.results[0].value.inspect).toHaveBeenCalledTimes(
      1
    );
  });

  // §5.3 (D15). prepareReview() passes raw listContainers().
  test('avoids a host port used by a raw API container', async () => {
    const { previewAutoPorts } = await loadImageUtils(withImage({ '80/tcp': {} }));
    const raw = [{ Ports: [{ PublicPort: 80, PrivatePort: 80, Type: 'tcp' }] }];
    const [row] = await previewAutoPorts('nginx:alpine', raw);
    expect(row.hostPort).toBe('81');
  });

  // §5.3 (D15)
  test('avoids a host port used by a normalized "host:container" entry', async () => {
    const { previewAutoPorts } = await loadImageUtils(withImage({ '80/tcp': {} }));
    const [row] = await previewAutoPorts('nginx:alpine', [{ ports: ['80:80'] }]);
    expect(row.hostPort).toBe('81');
  });

  test('reports hostPort null when the whole range is taken', async () => {
    const { previewAutoPorts } = await loadImageUtils(
      withImage({ '65535/tcp': {} })
    );
    const [row] = await previewAutoPorts('nginx:alpine', [
      { ports: ['65535:65535'] },
    ]);
    expect(row.hostPort).toBeNull();
  });
});
