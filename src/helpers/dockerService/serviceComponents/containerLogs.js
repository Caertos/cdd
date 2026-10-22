import { docker } from '../dockerService.js';
import { safeCall } from '../../safeCall.js';
import { logger } from '../../logger.js';

/** How many lines getLogsTail reads when the caller does not say. */
export const DEFAULT_TAIL_LINES = 50;

/**
 * Frame header of a Docker multiplexed stream: one byte for the channel,
 * three reserved, then a big-endian payload length.
 */
const FRAME_HEADER_BYTES = 8;

const STDOUT = 1;
const STDERR = 2;

/**
 * Split a Docker log payload into its channels.
 *
 * Containers created with `Tty: false` get their output multiplexed: each
 * chunk is an 8-byte header followed by the payload. Read as text, the
 * headers show up as garbage, which is the problem execCommand has noted
 * since §5.1. Containers with `Tty: true` come through as plain text.
 *
 * We do not ask Docker whether the container has a TTY — that would mean an
 * inspect call before every read. Instead the framing is validated and, if it
 * does not hold all the way to the end of the buffer, the payload is treated
 * as plain text. Requiring the frames to consume the buffer exactly is what
 * keeps a TTY container that happens to start with a control character from
 * being mangled.
 *
 * @param {Buffer} buffer
 * @returns {{stdout: string, stderr: string}|null} null when not multiplexed
 */
export function demultiplexLogStream(buffer) {
  const stdout = [];
  const stderr = [];
  let offset = 0;

  while (offset + FRAME_HEADER_BYTES <= buffer.length) {
    const channel = buffer[offset];
    if (channel !== STDOUT && channel !== STDERR) return null;
    if (
      buffer[offset + 1] !== 0 ||
      buffer[offset + 2] !== 0 ||
      buffer[offset + 3] !== 0
    ) {
      return null;
    }
    const size = buffer.readUInt32BE(offset + 4);
    const start = offset + FRAME_HEADER_BYTES;
    if (start + size > buffer.length) return null;
    const payload = buffer.subarray(start, start + size).toString('utf8');
    (channel === STDOUT ? stdout : stderr).push(payload);
    offset = start + size;
  }

  // Trailing bytes that are not a whole frame mean this was never a
  // multiplexed stream.
  if (offset !== buffer.length) return null;

  return { stdout: stdout.join(''), stderr: stderr.join('') };
}

/**
 * Stateful reader for a live Docker log stream. A non-TTY container's stream
 * is multiplexed in frames that can split across chunks, so the header bytes
 * are stripped and a partial frame is held until the rest arrives. A TTY
 * container's stream is plain text: the first bytes that do not look like a
 * frame header switch the reader to pass-through for good.
 *
 * @returns {(chunk: Buffer|string) => string} Text carried by the chunk
 */
export function createLogFrameReader() {
  let raw = false;
  let pending = Buffer.alloc(0);

  const looksLikeHeader = (buf) =>
    (buf[0] === STDOUT || buf[0] === STDERR) &&
    (buf.length < 2 || buf[1] === 0) &&
    (buf.length < 3 || buf[2] === 0) &&
    (buf.length < 4 || buf[3] === 0);

  return (chunk) => {
    const incoming = toBuffer(chunk);
    if (raw) return incoming.toString('utf8');

    pending = Buffer.concat([pending, incoming]);
    let out = '';
    while (pending.length > 0) {
      if (!looksLikeHeader(pending)) {
        raw = true;
        out += pending.toString('utf8');
        pending = Buffer.alloc(0);
        break;
      }
      if (pending.length < FRAME_HEADER_BYTES) break;
      const size = pending.readUInt32BE(4);
      if (pending.length < FRAME_HEADER_BYTES + size) break;
      out += pending
        .subarray(FRAME_HEADER_BYTES, FRAME_HEADER_BYTES + size)
        .toString('utf8');
      pending = pending.subarray(FRAME_HEADER_BYTES + size);
    }
    return out;
  };
}

/**
 * @typedef {Object} LogStreamHandle
 * @property {() => void} stop - Cierra el stream y desconecta los callbacks.
 *                               Idempotente: llamarlo dos veces no falla.
 */

/**
 * Abre un stream de logs en seguimiento y devuelve un mando para cerrarlo.
 *
 * Antes devolvía nada y el stream se quedaba capturado sólo por sus
 * callbacks: nadie podía pararlo (D9). El mando de control no expone el
 * stream crudo — quien lo usa sólo necesita poder cerrarlo.
 *
 * @param {string} containerId - Docker container id
 * @param {Function} [onData] - Called with chunk string when data arrives
 * @param {Function} [onEnd] - Called when stream ends
 * @param {Function} [onError] - Called on error
 * @returns {LogStreamHandle}
 */
export function getLogsStream(containerId, onData, onEnd, onError) {
  let stream = null;
  let stopped = false;
  let detach = null;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (detach) {
      detach();
      detach = null;
    }
    if (stream) {
      const current = stream;
      stream = null;
      safeCall(current.destroy?.bind(current));
    }
  };

  try {
    const container = docker.getContainer(containerId);
    logger.debug('Opening logs stream for container %s', containerId);
    container.logs(
      {
        follow: true,
        stdout: true,
        stderr: true,
        tail: 100,
      },
      (err, currentStream) => {
        if (stopped) {
          // stop() ran before the daemon handed the stream over. Destroy it
          // now so it never becomes a zombie nobody can reach (D9). The
          // parked no-op error listener keeps a late socket error from
          // throwing: emitting 'error' with zero listeners does.
          if (currentStream) {
            currentStream.on?.('error', () => {});
            safeCall(currentStream.destroy?.bind(currentStream));
          }
          return;
        }
        if (err) {
          logger.error(
            'Failed to open logs stream for container %s',
            containerId,
            err
          );
          safeCall(onError, err);
          return;
        }
        logger.info('Logs stream established for container %s', containerId);
        stream = currentStream;
        // The guard inside each listener is belt and braces on top of
        // removeListener: a chunk already in flight when stop() ran must not
        // reach setState on a viewer that is gone.
        const readFrames = createLogFrameReader();
        const onDataChunk = (chunk) => {
          if (stopped) return;
          const text = readFrames(chunk);
          if (text) safeCall(onData, text);
        };
        const onStreamEnd = () => {
          if (stopped) return;
          logger.debug('Logs stream ended for container %s', containerId);
          safeCall(onEnd);
        };
        const onStreamError = (streamErr) => {
          if (stopped) return;
          logger.error(
            'Logs stream error for container %s',
            containerId,
            streamErr
          );
          safeCall(onError, streamErr);
        };
        stream.on('data', onDataChunk);
        stream.on('end', onStreamEnd);
        stream.on('error', onStreamError);
        detach = () => {
          currentStream.removeListener?.('data', onDataChunk);
          currentStream.removeListener?.('end', onStreamEnd);
          currentStream.removeListener?.('error', onStreamError);
          // A stream being torn down can still emit 'error', and emitting it
          // with zero listeners throws. Park a no-op so the shutdown cannot
          // take the process down.
          currentStream.on?.('error', () => {});
        };
      }
    );
  } catch (err) {
    logger.error(
      'Unexpected error while opening logs stream for container %s',
      containerId,
      err
    );
    safeCall(onError, err);
  }

  return { stop };
}

/**
 * Read the last lines of a container's log without following it.
 *
 * Unlike getLogsStream this asks, collects, resolves and closes: it leaves no
 * stream alive. That matters because the diagnosis panel reads the log of
 * every failing container the user moves over, and D9 is exactly this bug in
 * the logs viewer.
 *
 * `follow: false` is what keeps this bounded. A followed stream on a
 * `restarting` container never ends, and the panel diagnoses those too, so
 * following would hang rather than return.
 *
 * Never rejects. A container with no output, a vanished container or a broken
 * socket all resolve to an empty array, which the panel renders as "nothing to
 * show" instead of crashing. Same contract as getContainerDetails.
 *
 * @param {string} containerId - Docker container id
 * @param {number} [lines=50] - How many lines to read
 * @returns {Promise<string[]>}
 */
/**
 * Normalise whatever docker-modem handed us into bytes.
 *
 * With `follow: false` and a callback, docker-modem does not give us a stream:
 * it collects the whole response, sniffs it for JSON, and passes either the
 * parsed value or the raw Buffer. The sniff means a container whose last log
 * line happens to be a single JSON document arrives as an object, so
 * stringifying it back is what keeps that case readable.
 *
 * A real stream is still accepted, in case a future version streams instead.
 *
 * @param {unknown} payload
 * @returns {Buffer}
 */
function toBuffer(payload) {
  if (Buffer.isBuffer(payload)) return payload;
  if (typeof payload === 'string') return Buffer.from(payload, 'utf8');
  if (payload === null || payload === undefined) return Buffer.alloc(0);
  return Buffer.from(JSON.stringify(payload) ?? '', 'utf8');
}

export function getLogsTail(containerId, lines = DEFAULT_TAIL_LINES) {
  return new Promise((resolve) => {
    const wanted =
      Number.isFinite(lines) && lines > 0
        ? Math.floor(lines)
        : DEFAULT_TAIL_LINES;

    function finish(combined) {
      const demuxed = demultiplexLogStream(combined);
      const text = demuxed
        ? `${demuxed.stdout}${demuxed.stderr}`
        : combined.toString('utf8');
      const all = text.split('\n').map((l) => l.replace(/\r$/, ''));
      // A trailing newline yields a final empty element; it is not a line.
      if (all.length > 0 && all[all.length - 1] === '') all.pop();
      resolve(all.slice(-wanted));
    }

    try {
      const container = docker.getContainer(containerId);
      logger.debug(
        'Reading last %d log line(s) for container %s',
        wanted,
        containerId
      );
      container.logs(
        { follow: false, stdout: true, stderr: true, tail: wanted },
        (err, payload) => {
          if (err) {
            logger.error(
              'Failed to read logs for container %s',
              containerId,
              err
            );
            resolve([]);
            return;
          }
          if (payload && typeof payload.on === 'function') {
            const chunks = [];
            const collect = () => finish(Buffer.concat(chunks));
            payload.on('data', (chunk) => chunks.push(toBuffer(chunk)));
            payload.on('end', collect);
            payload.on('error', (streamErr) => {
              // Keep whatever arrived before the break.
              logger.error(
                'Log read for container %s ended early',
                containerId,
                streamErr
              );
              collect();
            });
            return;
          }
          finish(toBuffer(payload));
        }
      );
    } catch (err) {
      logger.error('Unexpected error reading logs for %s', containerId, err);
      resolve([]);
    }
  });
}
