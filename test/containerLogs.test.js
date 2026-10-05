/**
 * @jest-environment node
 */
import { jest } from '@jest/globals';
import { EventEmitter } from 'events';

afterEach(() => jest.resetModules());

async function loadLogs(logsImpl) {
  await jest.unstable_mockModule(
    '../src/helpers/dockerService/dockerService.js',
    () => ({
      docker: { getContainer: jest.fn().mockReturnValue({ logs: logsImpl }) },
    })
  );
  return import('../src/helpers/dockerService/serviceComponents/containerLogs.js');
}

describe('getLogsStream', () => {
  test('data event → onData with chunk as string', async () => {
    const stream = new EventEmitter();
    const { getLogsStream } = await loadLogs((opts, cb) => cb(null, stream));
    const onData = jest.fn();

    getLogsStream('cid', onData, jest.fn(), jest.fn());
    stream.emit('data', Buffer.from('hola'));

    expect(onData).toHaveBeenCalledWith('hola');
  });

  test('end event → onEnd', async () => {
    const stream = new EventEmitter();
    const { getLogsStream } = await loadLogs((opts, cb) => cb(null, stream));
    const onEnd = jest.fn();

    getLogsStream('cid', jest.fn(), onEnd, jest.fn());
    stream.emit('end');

    expect(onEnd).toHaveBeenCalled();
  });

  test('stream error event → onError', async () => {
    const stream = new EventEmitter();
    const { getLogsStream } = await loadLogs((opts, cb) => cb(null, stream));
    const onError = jest.fn();
    const boom = new Error('broken pipe');

    getLogsStream('cid', jest.fn(), jest.fn(), onError);
    stream.emit('error', boom);

    expect(onError).toHaveBeenCalledWith(boom);
  });

  test('error in logs callback → onError and no stream subscription', async () => {
    const { getLogsStream } = await loadLogs((opts, cb) =>
      cb(new Error('404'))
    );
    const onError = jest.fn();
    const onData = jest.fn();

    getLogsStream('cid', onData, jest.fn(), onError);

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect(onData).not.toHaveBeenCalled();
  });

  test('sync exception (getContainer throws) → onError', async () => {
    await jest.unstable_mockModule(
      '../src/helpers/dockerService/dockerService.js',
      () => ({
        docker: {
          getContainer: jest.fn(() => {
            throw new Error('socket closed');
          }),
        },
      })
    );
    const { getLogsStream } =
      await import('../src/helpers/dockerService/serviceComponents/containerLogs.js');
    const onError = jest.fn();

    getLogsStream('cid', jest.fn(), jest.fn(), onError);

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  test('omitted callbacks → does not throw (safeCall)', async () => {
    const stream = new EventEmitter();
    const { getLogsStream } = await loadLogs((opts, cb) => cb(null, stream));

    expect(() => {
      getLogsStream('cid');
      stream.emit('data', Buffer.from('x'));
      stream.emit('end');
      stream.emit('error', new Error('x'));
    }).not.toThrow();
  });

  test('requests follow, stdout, stderr and tail=100', async () => {
    const logs = jest.fn((opts, cb) => cb(null, new EventEmitter()));
    const { getLogsStream } = await loadLogs(logs);

    getLogsStream('cid', jest.fn());

    expect(logs).toHaveBeenCalledWith(
      { follow: true, stdout: true, stderr: true, tail: 100 },
      expect.any(Function)
    );
  });
});

/**
 * Build one frame of a Docker multiplexed stream: 1 byte channel, 3 reserved,
 * 4 bytes of big-endian payload length, then the payload.
 */
function frame(channel, payload) {
  const body = Buffer.from(payload, 'utf8');
  const header = Buffer.alloc(8);
  header.writeUInt8(channel, 0);
  header.writeUInt32BE(body.length, 4);
  return Buffer.concat([header, body]);
}

const OUT = 1;
const ERR = 2;

describe('demultiplexLogStream', () => {
  let demultiplexLogStream;

  beforeAll(async () => {
    ({ demultiplexLogStream } = await loadLogs(jest.fn()));
  });

  test('a plain-text payload is not multiplexed', () => {
    expect(demultiplexLogStream(Buffer.from('hello\nworld\n'))).toBeNull();
  });

  test('an empty buffer yields two empty channels', () => {
    expect(demultiplexLogStream(Buffer.alloc(0))).toEqual({
      stdout: '',
      stderr: '',
    });
  });

  test('a single frame is split from its header', () => {
    expect(demultiplexLogStream(frame(OUT, 'starting\n'))).toEqual({
      stdout: 'starting\n',
      stderr: '',
    });
  });

  test('several frames on both channels keep their payloads', () => {
    const buffer = Buffer.concat([
      frame(OUT, 'one\n'),
      frame(ERR, 'problem\n'),
      frame(OUT, 'two\n'),
    ]);
    expect(demultiplexLogStream(buffer)).toEqual({
      stdout: 'one\ntwo\n',
      stderr: 'problem\n',
    });
  });

  test('a payload split across frames is rejoined', () => {
    const buffer = Buffer.concat([frame(OUT, 'hel'), frame(OUT, 'lo\n')]);
    expect(demultiplexLogStream(buffer).stdout).toBe('hello\n');
  });

  test('a truncated frame is not treated as multiplexed', () => {
    const full = frame(OUT, 'hello there');
    expect(demultiplexLogStream(full.subarray(0, full.length - 3))).toBeNull();
  });

  test('trailing bytes that are not a frame are rejected', () => {
    const buffer = Buffer.concat([frame(OUT, 'ok\n'), Buffer.from('junk')]);
    expect(demultiplexLogStream(buffer)).toBeNull();
  });

  test('an unknown channel byte is rejected', () => {
    expect(demultiplexLogStream(frame(0, 'stdin-ish\n'))).toBeNull();
  });

  test('reserved bytes that are not zero are rejected', () => {
    const bad = Buffer.alloc(8);
    bad.writeUInt8(OUT, 0);
    bad.writeUInt8(1, 1); // reserved byte must stay zero
    bad.writeUInt32BE(3, 4);
    expect(
      demultiplexLogStream(Buffer.concat([bad, Buffer.from('abc')]))
    ).toBeNull();
  });

  test('text that starts with a control character is left alone', () => {
    // A TTY container whose first byte is 0x01 must not be mangled into a
    // bogus frame: the reserved-byte check has to reject it.
    expect(
      demultiplexLogStream(Buffer.from('\u0001staying alive\n'))
    ).toBeNull();
  });
});

describe('getLogsTail', () => {
  /** Load containerLogs with a container whose logs() yields `chunks`. */
  async function withTail(chunks, onRequested) {
    const stream = new EventEmitter();
    const logs = jest.fn((opts, cb) => {
      if (onRequested) onRequested(opts);
      cb(null, stream);
      // Deliver after the subscriber is attached, like a real socket.
      setImmediate(() => {
        for (const chunk of chunks) stream.emit('data', chunk);
        stream.emit('end');
      });
    });
    return loadLogs(logs);
  }

  test('reads without following and asks for the line count', async () => {
    let seen = null;
    const { getLogsTail } = await withTail([Buffer.from('a\n')], (opts) => {
      seen = opts;
    });
    await getLogsTail('cid', 10);
    expect(seen).toEqual({
      follow: false,
      stdout: true,
      stderr: true,
      tail: 10,
    });
  });

  test('defaults to 50 lines', async () => {
    let seen = null;
    const { getLogsTail } = await withTail([Buffer.from('a\n')], (opts) => {
      seen = opts;
    });
    await getLogsTail('cid');
    expect(seen.tail).toBe(50);
  });

  test('returns the last N lines', async () => {
    const { getLogsTail } = await withTail([Buffer.from('1\n2\n3\n4\n5\n')]);
    await expect(getLogsTail('cid', 2)).resolves.toEqual(['4', '5']);
  });

  test('returns everything when there are fewer lines than asked', async () => {
    const { getLogsTail } = await withTail([Buffer.from('only\n')]);
    await expect(getLogsTail('cid', 50)).resolves.toEqual(['only']);
  });

  test('strips the 8-byte headers of a Tty:false container', async () => {
    const { getLogsTail } = await withTail([
      Buffer.concat([
        frame(OUT, 'Error: Database is uninitialized and\n'),
        frame(ERR, 'superuser password is not specified.\n'),
      ]),
    ]);
    const lines = await getLogsTail('cid');
    expect(lines).toEqual([
      'Error: Database is uninitialized and',
      'superuser password is not specified.',
    ]);
    for (const line of lines) {
      expect(line).not.toMatch(/[\u0000-\u0008]/);
    }
  });

  test('reassembles a container whose frames arrive in chunks', async () => {
    const whole = frame(OUT, 'hello there\n');
    const { getLogsTail } = await withTail([
      whole.subarray(0, 6),
      whole.subarray(6),
    ]);
    await expect(getLogsTail('cid')).resolves.toEqual(['hello there']);
  });

  test('a container with no output resolves empty', async () => {
    const { getLogsTail } = await withTail([]);
    await expect(getLogsTail('cid')).resolves.toEqual([]);
  });

  test('a trailing newline does not produce a last empty line', async () => {
    const { getLogsTail } = await withTail([Buffer.from('a\nb\n')]);
    await expect(getLogsTail('cid')).resolves.toEqual(['a', 'b']);
  });

  test('windows line endings are normalised', async () => {
    const { getLogsTail } = await withTail([Buffer.from('a\r\nb\r\n')]);
    await expect(getLogsTail('cid')).resolves.toEqual(['a', 'b']);
  });

  test('blank lines in the middle are kept', async () => {
    const { getLogsTail } = await withTail([Buffer.from('a\n\nb\n')]);
    await expect(getLogsTail('cid')).resolves.toEqual(['a', '', 'b']);
  });

  test('a docker error resolves empty instead of rejecting', async () => {
    const { getLogsTail } = await loadLogs((opts, cb) => cb(new Error('404')));
    await expect(getLogsTail('cid')).resolves.toEqual([]);
  });

  test('a socket that throws resolves empty', async () => {
    await jest.unstable_mockModule(
      '../src/helpers/dockerService/dockerService.js',
      () => ({
        docker: {
          getContainer: jest.fn(() => {
            throw new Error('socket closed');
          }),
        },
      })
    );
    const { getLogsTail } =
      await import('../src/helpers/dockerService/serviceComponents/containerLogs.js');
    await expect(getLogsTail('cid')).resolves.toEqual([]);
  });

  test('a stream that breaks keeps what already arrived', async () => {
    const stream = new EventEmitter();
    const { getLogsTail } = await loadLogs((opts, cb) => cb(null, stream));
    setImmediate(() => {
      stream.emit('data', Buffer.from('partial\n'));
      stream.emit('error', new Error('ECONNRESET'));
    });
    await expect(getLogsTail('cid')).resolves.toEqual(['partial']);
  });

  test('docker-modem hands us a buffered payload, not a stream', async () => {
    // follow:false makes docker-modem collect the whole response and pass a
    // Buffer. Reading it as a stream threw "stream.on is not a function",
    // which only a real Docker daemon could have told us.
    const { getLogsTail } = await loadLogs((opts, cb) =>
      cb(null, Buffer.from('from a buffer\n'))
    );
    await expect(getLogsTail('cid')).resolves.toEqual(['from a buffer']);
  });

  test('a payload that docker-modem parsed as JSON is stringified back', async () => {
    // docker-modem sniffs the body for JSON before deciding what to pass on,
    // so a single JSON log line arrives as an object.
    const { getLogsTail } = await loadLogs((opts, cb) =>
      cb(null, { level: 'info', msg: 'started' })
    );
    const lines = await getLogsTail('cid');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('started');
  });

  test('a null payload is an empty log, not a crash', async () => {
    const { getLogsTail } = await loadLogs((opts, cb) => cb(null, null));
    await expect(getLogsTail('cid')).resolves.toEqual([]);
  });

  test('a payload that is already a string is read as text', async () => {
    const { getLogsTail } = await loadLogs((opts, cb) =>
      cb(null, 'plain string payload\n')
    );
    await expect(getLogsTail('cid')).resolves.toEqual(['plain string payload']);
  });

  test('a nonsense line count falls back to the default', async () => {
    let seen = null;
    const { getLogsTail } = await withTail([Buffer.from('a\n')], (opts) => {
      seen = opts;
    });
    await getLogsTail('cid', -5);
    expect(seen.tail).toBe(50);
  });
});
