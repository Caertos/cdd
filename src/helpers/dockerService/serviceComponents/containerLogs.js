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
 * Return a stream of logs from a container and call callbacks for events.
 *
 * @param {string} containerId - Docker container id
 * @param {Function} onData - Called with chunk string when data arrives
 * @param {Function} onEnd - Called when stream ends
 * @param {Function} onError - Called on error
 */
export function getLogsStream(containerId, onData, onEnd, onError) {
  // Use shared safeCall util to call optional callbacks safely

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
      (err, stream) => {
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
        stream.on('data', (chunk) => safeCall(onData, chunk.toString()));
        stream.on('end', () => {
          logger.debug('Logs stream ended for container %s', containerId);
          safeCall(onEnd);
        });
        stream.on('error', (streamErr) => {
          logger.error(
            'Logs stream error for container %s',
            containerId,
            streamErr
          );
          safeCall(onError, streamErr);
        });
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
