/**
 * @jest-environment node
 */
import { jest } from '@jest/globals';
import { C0_BEFORE_TAB, controlCharsIn } from './support/controlChars.js';
import { EventEmitter } from 'node:events';

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
    const { getLogsStream } = await loadLogs((_opts, cb) => cb(null, stream));
    const onData = jest.fn();

    getLogsStream('cid', onData, jest.fn(), jest.fn());
    stream.emit('data', Buffer.from('hola'));

    expect(onData).toHaveBeenCalledWith('hola');
  });

  test('end event → onEnd', async () => {
    const stream = new EventEmitter();
    const { getLogsStream } = await loadLogs((_opts, cb) => cb(null, stream));
    const onEnd = jest.fn();

    getLogsStream('cid', jest.fn(), onEnd, jest.fn());
    stream.emit('end');

    expect(onEnd).toHaveBeenCalled();
  });

  test('stream error event → onError', async () => {
    const stream = new EventEmitter();
    const { getLogsStream } = await loadLogs((_opts, cb) => cb(null, stream));
    const onError = jest.fn();
    const boom = new Error('broken pipe');

    getLogsStream('cid', jest.fn(), jest.fn(), onError);
    stream.emit('error', boom);

    expect(onError).toHaveBeenCalledWith(boom);
  });

  test('error in logs callback → onError and no stream subscription', async () => {
    const { getLogsStream } = await loadLogs((_opts, cb) =>
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
    const { getLogsStream } = await loadLogs((_opts, cb) => cb(null, stream));

    expect(() => {
      getLogsStream('cid');
      stream.emit('data', Buffer.from('x'));
      stream.emit('end');
      stream.emit('error', new Error('x'));
    }).not.toThrow();
  });

  test('requests follow, stdout, stderr and tail=100', async () => {
    const logs = jest.fn((_opts, cb) => cb(null, new EventEmitter()));
    const { getLogsStream } = await loadLogs(logs);

    getLogsStream('cid', jest.fn());

    expect(logs).toHaveBeenCalledWith(
      { follow: true, stdout: true, stderr: true, tail: 100 },
      expect.any(Function)
    );
  });
});

describe('getLogsStream — D9: the handle closes the stream', () => {
  function spyStream() {
    const stream = new EventEmitter();
    stream.destroy = jest.fn();
    return stream;
  }

  test('the handle exposes stop() and it destroys the stream', async () => {
    const stream = spyStream();
    const { getLogsStream } = await loadLogs((_opts, cb) => cb(null, stream));
    const handle = getLogsStream('cid', jest.fn(), jest.fn(), jest.fn());

    expect(typeof handle.stop).toBe('function');
    handle.stop();
    expect(stream.destroy).toHaveBeenCalledTimes(1);
  });

  test('after stop() a late chunk never reaches onData', async () => {
    const stream = spyStream();
    const { getLogsStream } = await loadLogs((_opts, cb) => cb(null, stream));
    const onData = jest.fn();
    const onEnd = jest.fn();
    const handle = getLogsStream('cid', onData, onEnd, jest.fn());

    handle.stop();
    stream.emit('data', Buffer.from('late'));
    stream.emit('end');

    expect(onData).not.toHaveBeenCalled();
    expect(onEnd).not.toHaveBeenCalled();
  });

  test('stop() is idempotent and destroys only once', async () => {
    const stream = spyStream();
    const { getLogsStream } = await loadLogs((_opts, cb) => cb(null, stream));
    const handle = getLogsStream('cid');

    handle.stop();
    expect(() => handle.stop()).not.toThrow();
    expect(stream.destroy).toHaveBeenCalledTimes(1);
  });

  test('stop() detaches the listeners and a late error cannot crash', async () => {
    const stream = spyStream();
    const { getLogsStream } = await loadLogs((_opts, cb) => cb(null, stream));
    const onError = jest.fn();
    const handle = getLogsStream('cid', jest.fn(), jest.fn(), onError);
    expect(stream.listenerCount('data')).toBe(1);

    handle.stop();
    expect(stream.listenerCount('data')).toBe(0);
    expect(stream.listenerCount('end')).toBe(0);
    // Emitting 'error' with zero listeners throws in Node; the handle parks
    // a no-op so a socket error during teardown cannot take the process down.
    expect(() => stream.emit('error', new Error('late'))).not.toThrow();
    expect(onError).not.toHaveBeenCalled();
  });

  test('a stream handed over after stop() is destroyed on arrival', async () => {
    let handOver = null;
    const { getLogsStream } = await loadLogs((_opts, cb) => {
      handOver = cb;
    });
    const onData = jest.fn();
    const handle = getLogsStream('cid', onData);

    handle.stop();
    const stream = spyStream();
    handOver(null, stream);

    expect(stream.destroy).toHaveBeenCalledTimes(1);
    stream.emit('data', Buffer.from('late'));
    expect(onData).not.toHaveBeenCalled();
  });

  test('stop() before the daemon reports an error stays silent', async () => {
    let handOver = null;
    const { getLogsStream } = await loadLogs((_opts, cb) => {
      handOver = cb;
    });
    const onError = jest.fn();
    const handle = getLogsStream('cid', jest.fn(), jest.fn(), onError);

    handle.stop();
    handOver(new Error('404'));

    expect(onError).not.toHaveBeenCalled();
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

describe('createLogFrameReader', () => {
  const frame = (channel, text) => {
    const payload = Buffer.from(text);
    const header = Buffer.alloc(8);
    header[0] = channel;
    header.writeUInt32BE(payload.length, 4);
    return Buffer.concat([header, payload]);
  };

  test('strips the header of a multiplexed frame', async () => {
    const { createLogFrameReader } = await loadLogs(jest.fn());
    const read = createLogFrameReader();
    expect(read(frame(1, 'hello\n'))).toBe('hello\n');
  });

  test('joins a frame split across chunks', async () => {
    const { createLogFrameReader } = await loadLogs(jest.fn());
    const read = createLogFrameReader();
    const whole = frame(1, 'split line\n');
    expect(read(whole.subarray(0, 5))).toBe('');
    expect(read(whole.subarray(5, 12))).toBe('');
    expect(read(whole.subarray(12))).toBe('split line\n');
  });

  test('reads several frames in one chunk, both channels', async () => {
    const { createLogFrameReader } = await loadLogs(jest.fn());
    const read = createLogFrameReader();
    expect(read(Buffer.concat([frame(1, 'out\n'), frame(2, 'err\n')]))).toBe(
      'out\nerr\n'
    );
  });

  test('passes a TTY stream through untouched', async () => {
    const { createLogFrameReader } = await loadLogs(jest.fn());
    const read = createLogFrameReader();
    expect(read(Buffer.from('plain text\n'))).toBe('plain text\n');
    expect(read('more\n')).toBe('more\n');
  });
});

describe('getLogsStream — frames', () => {
  test('onData receives the text without the frame header', async () => {
    const stream = new EventEmitter();
    const { getLogsStream } = await loadLogs(jest.fn((_opts, cb) => cb(null, stream)));
    const onData = jest.fn();
    getLogsStream('cid', onData, jest.fn(), jest.fn());
    const header = Buffer.from([1, 0, 0, 0, 0, 0, 0, 3]);
    stream.emit('data', Buffer.concat([header, Buffer.from('hey')]));
    expect(onData).toHaveBeenCalledWith('hey');
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
      expect(controlCharsIn(line, C0_BEFORE_TAB)).toEqual([]);
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
    const { getLogsTail } = await loadLogs((_opts, cb) => cb(new Error('404')));
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
    const { getLogsTail } = await loadLogs((_opts, cb) => cb(null, stream));
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
    const { getLogsTail } = await loadLogs((_opts, cb) =>
      cb(null, Buffer.from('from a buffer\n'))
    );
    await expect(getLogsTail('cid')).resolves.toEqual(['from a buffer']);
  });

  test('a payload that docker-modem parsed as JSON is stringified back', async () => {
    // docker-modem sniffs the body for JSON before deciding what to pass on,
    // so a single JSON log line arrives as an object.
    const { getLogsTail } = await loadLogs((_opts, cb) =>
      cb(null, { level: 'info', msg: 'started' })
    );
    const lines = await getLogsTail('cid');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('started');
  });

  test('a null payload is an empty log, not a crash', async () => {
    const { getLogsTail } = await loadLogs((_opts, cb) => cb(null, null));
    await expect(getLogsTail('cid')).resolves.toEqual([]);
  });

  test('a payload that is already a string is read as text', async () => {
    const { getLogsTail } = await loadLogs((_opts, cb) =>
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
