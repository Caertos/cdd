/**
 * @jest-environment node
 */
import { jest } from '@jest/globals';
import { EventEmitter } from 'events';

afterEach(() => jest.resetModules());

async function loadLogs(logsImpl) {
  await jest.unstable_mockModule('../src/helpers/dockerService/dockerService.js', () => ({
    docker: { getContainer: jest.fn().mockReturnValue({ logs: logsImpl }) },
  }));
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
    const { getLogsStream } = await loadLogs((opts, cb) => cb(new Error('404')));
    const onError = jest.fn();
    const onData = jest.fn();

    getLogsStream('cid', onData, jest.fn(), onError);

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect(onData).not.toHaveBeenCalled();
  });

  test('sync exception (getContainer throws) → onError', async () => {
    await jest.unstable_mockModule('../src/helpers/dockerService/dockerService.js', () => ({
      docker: {
        getContainer: jest.fn(() => {
          throw new Error('socket closed');
        }),
      },
    }));
    const { getLogsStream } = await import(
      '../src/helpers/dockerService/serviceComponents/containerLogs.js'
    );
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
