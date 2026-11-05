import { LOG_RETENTION } from './constants.js';

/** How far back the drops count towards the "noisy container" warning. */
export const HIGH_VOLUME_WINDOW_MS = 60_000;

const KB = 1024;
const MB = 1024 * 1024;

/**
 * @typedef {Object} LogBuffer
 * @property {string[]} lines
 * @property {number} bytes - Approximate size of the lines (UTF-8 bytes)
 * @property {number} droppedLines - Lines thrown away by the ceilings
 * @property {boolean} reachedStart - The first line held is the log's real first line
 * @property {boolean} truncatedAtStart - The top of the buffer is not the start of the log
 * @property {boolean} isComplete - The buffer holds the whole log
 * @property {number} lastDropAt - Timestamp of the last drop (0 = never)
 * @property {Array<{at: number, bytes: number}>} recentDrops - Drops inside the window
 * @property {{maxBytes: number, maxLines: number, maxLineBytes: number}} limits
 */

/**
 * Derived flags kept in one place so they can never disagree.
 *
 * @param {Omit<LogBuffer, 'truncatedAtStart' | 'isComplete'>} fields
 * @returns {LogBuffer}
 */
function withFlags(fields) {
  const complete = fields.reachedStart && fields.droppedLines === 0;
  return { ...fields, truncatedAtStart: !complete, isComplete: complete };
}

/**
 * Creates an empty buffer.
 *
 * `reachedStart` says whether what gets appended begins at the log's first
 * line (the whole log was asked for). It defaults to false so the buffer never
 * claims a start it was not given.
 *
 * @param {Object} [options]
 * @param {number} [options.maxBytes]
 * @param {number} [options.maxLines]
 * @param {number} [options.maxLineBytes]
 * @param {boolean} [options.reachedStart=false]
 * @returns {LogBuffer}
 */
export function createLogBuffer(options = {}) {
  return withFlags({
    lines: [],
    bytes: 0,
    droppedLines: 0,
    reachedStart: options.reachedStart ?? false,
    lastDropAt: 0,
    recentDrops: [],
    limits: {
      maxBytes: options.maxBytes ?? LOG_RETENTION.BUFFER_BYTES,
      maxLines: options.maxLines ?? LOG_RETENTION.MAX_LINES,
      maxLineBytes: options.maxLineBytes ?? LOG_RETENTION.MAX_LINE_BYTES,
    },
  });
}

/** "3.0 MB", "4.9 KB", "20 B". */
function formatSize(bytes) {
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`;
  if (bytes >= KB) return `${(bytes / KB).toFixed(1)} KB`;
  return `${bytes} B`;
}

/**
 * Cuts a single line that is too big, leaving a mark that says so.
 * The cut never lands inside a multi-byte character.
 *
 * @param {string} line
 * @param {number} maxBytes
 * @returns {string}
 */
export function truncateLine(line, maxBytes) {
  const size = Buffer.byteLength(line, 'utf8');
  if (size <= maxBytes) return line;
  // toString replaces a half-cut character with U+FFFD, which is dropped.
  const head = Buffer.from(line, 'utf8')
    .subarray(0, maxBytes)
    .toString('utf8')
    .replace(/�+$/u, '');
  return `${head}… [line cut: ${formatSize(size)}]`;
}

/**
 * Drops the oldest lines until the buffer fits its ceilings. The newest line
 * always stays, even if it alone is over the byte ceiling.
 *
 * @param {LogBuffer} buffer
 * @param {number} now
 * @returns {LogBuffer}
 */
function enforceLimits(buffer, now) {
  const { maxBytes, maxLines } = buffer.limits;
  const { lines } = buffer;
  let bytes = buffer.bytes;
  let drop = 0;
  let droppedBytes = 0;
  while (
    lines.length - drop > 1 &&
    (bytes > maxBytes || lines.length - drop > maxLines)
  ) {
    const size = Buffer.byteLength(lines[drop], 'utf8');
    bytes -= size;
    droppedBytes += size;
    drop += 1;
  }
  // `reachedStart` may have changed (prependLines), so the flags are rebuilt
  // even when nothing was dropped.
  if (drop === 0) return withFlags(buffer);

  const recentDrops = [
    ...buffer.recentDrops.filter((d) => now - d.at <= HIGH_VOLUME_WINDOW_MS),
    { at: now, bytes: droppedBytes },
  ];
  return withFlags({
    ...buffer,
    lines: lines.slice(drop),
    bytes,
    droppedLines: buffer.droppedLines + drop,
    lastDropAt: now,
    recentDrops,
  });
}

/**
 * Cuts the lines that are too big and sums their bytes.
 *
 * @param {string[]} lines
 * @param {number} maxLineBytes
 * @returns {{ lines: string[], bytes: number }}
 */
function measured(lines, maxLineBytes) {
  let bytes = 0;
  const cut = lines.map((line) => {
    const safe = truncateLine(line, maxLineBytes);
    bytes += Buffer.byteLength(safe, 'utf8');
    return safe;
  });
  return { lines: cut, bytes };
}

/**
 * Adds lines at the end and applies the retention policy. Returns a new
 * buffer; the one passed in is not touched.
 *
 * @param {LogBuffer} buffer
 * @param {string[]} newLines
 * @param {number} now - Timestamp, in ms
 * @returns {LogBuffer}
 */
export function appendLines(buffer, newLines, now) {
  if (newLines.length === 0) return buffer;
  const added = measured(newLines, buffer.limits.maxLineBytes);
  return enforceLimits(
    {
      ...buffer,
      lines: [...buffer.lines, ...added.lines],
      bytes: buffer.bytes + added.bytes,
    },
    now
  );
}

/**
 * Adds older lines at the front ("load earlier lines"). `reachedStart` says
 * whether this chunk reached the log's first line.
 *
 * @param {LogBuffer} buffer
 * @param {string[]} olderLines
 * @param {boolean} reachedStart
 * @param {number} [now=Date.now()]
 * @returns {LogBuffer}
 */
export function prependLines(
  buffer,
  olderLines,
  reachedStart,
  now = Date.now()
) {
  const added = measured(olderLines, buffer.limits.maxLineBytes);
  return enforceLimits(
    {
      ...buffer,
      lines: [...added.lines, ...buffer.lines],
      bytes: buffer.bytes + added.bytes,
      reachedStart,
    },
    now
  );
}

/**
 * Whether "load earlier lines" can help: the start was never asked for and
 * nothing was thrown away. After a memory drop, loading more would only be
 * dropped again.
 *
 * @param {LogBuffer} buffer
 * @returns {boolean}
 */
export function canLoadMore(buffer) {
  return !buffer.reachedStart && buffer.droppedLines === 0;
}

/**
 * The mark shown above the first line, so the reader always knows whether the
 * top of the buffer is the top of the log.
 *
 * @param {LogBuffer} buffer
 * @returns {{ text: string, kind: 'empty'|'complete'|'dropped'|'partial' }}
 */
export function bufferHeadNotice(buffer) {
  if (buffer.lines.length === 0) return { text: '', kind: 'empty' };
  if (buffer.droppedLines > 0) {
    const count = buffer.droppedLines.toLocaleString('en-US');
    return {
      text: `⋯ ${count} earlier lines dropped (memory limit)`,
      kind: 'dropped',
    };
  }
  if (buffer.isComplete) {
    return { text: '─── start of log ───', kind: 'complete' };
  }
  return { text: '↑ [Ctrl+U] load earlier lines', kind: 'partial' };
}

/**
 * Whether the buffer has been renewed more than once over inside the window:
 * a container writing so fast that the problem is the container, not the
 * viewer.
 *
 * @param {LogBuffer} buffer
 * @param {number} now
 * @returns {boolean}
 */
export function isHighVolume(buffer, now) {
  const dropped = buffer.recentDrops
    .filter((d) => now - d.at <= HIGH_VOLUME_WINDOW_MS)
    .reduce((sum, d) => sum + d.bytes, 0);
  return dropped > buffer.limits.maxBytes;
}

/**
 * From a chunk read with a bigger tail, the lines the buffer does not have.
 *
 * Lines streamed in during the read are already held and also sit at the end
 * of the chunk, so what comes before them is what is new. More than one
 * chunk of new lines is cut to the newest `chunkSize`; the cut lines are not
 * loaded, so the start cannot be claimed.
 *
 * @param {{ lines: string[], reachedStart: boolean }} result
 * @param {number} held - Lines the buffer holds now
 * @param {number} chunkSize
 * @returns {{ older: string[], reachedStart: boolean }}
 */
export function newerThanHeld(result, held, chunkSize) {
  const older = result.lines.slice(0, Math.max(0, result.lines.length - held));
  const trimmed = older.length > chunkSize;
  return {
    older: trimmed ? older.slice(-chunkSize) : older,
    reachedStart: result.reachedStart && !trimmed,
  };
}

/** States in which a container's log is finite: nothing is writing to it. */
const STOPPED_STATES = new Set(['exited', 'created', 'dead', 'removing']);

/**
 * What to ask Docker for when the viewer opens, and whether what comes back
 * starts at the log's first line.
 *
 * A stopped container's log is finite and is exactly the one read to
 * diagnose it, so it is read whole. A live one gets its last lines. An
 * unknown state is treated as live: asking for less and claiming less is the
 * safe side. Only the states Docker names as stopped read the whole log.
 *
 * @param {string|undefined} state - Docker container state
 * @returns {{ tail: number|'all', reachedStart: boolean }}
 */
export function initialLogRequest(state) {
  if (STOPPED_STATES.has(state)) {
    return { tail: LOG_RETENTION.INITIAL_TAIL_STOPPED, reachedStart: true };
  }
  return { tail: LOG_RETENTION.INITIAL_TAIL_RUNNING, reachedStart: false };
}
