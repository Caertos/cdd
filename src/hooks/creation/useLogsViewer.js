import { useState, useRef, useEffect, useMemo } from 'react';
import { safeCall } from '../../helpers/safeCall.js';
import { LOG_VIEW_LINES } from '../../helpers/reservedRows.js';
import { sanitizeTerminalText } from '../../helpers/sanitizeTerminalText.js';
import { searchLogLines, lineMatches } from '../../helpers/logSearch.js';
import { applyKeyToText, textStateOf } from '../../helpers/textEditing.js';
import {
  createLogBuffer,
  appendLines,
  prependLines,
  newerThanHeld,
  canLoadMore,
  bufferHeadNotice,
  isHighVolume,
} from '../../helpers/logBuffer.js';
import { LOG_RETENTION } from '../../helpers/constants.js';

/** What the head of the buffer says while an older chunk is loading or failed. */
function earlierNotice(state) {
  if (state === 'loading') {
    return { text: '⋯ loading earlier lines…', kind: 'loading' };
  }
  if (state === 'failed') {
    return {
      text: '⋯ could not load earlier lines — [Ctrl+U] to retry',
      kind: 'failed',
    };
  }
  return null;
}

/** How often an active noisy-container warning is checked against the clock. */
const RECHECK_MS = 10_000;

/** Larger than any buffer: scrolling this far lands on the first line. */
const TO_THE_TOP = Number.MAX_SAFE_INTEGER;

/**
 * Custom hook to manage the logs viewer state and stream reference.
 * Handles showing/hiding logs, the scroll window, follow/pause and search.
 *
 * `scrollOffset` counts lines up from the newest line of what is *shown*:
 * every line, or only the matching ones while the filter is on.
 *
 * @returns {Object} Logs viewer state and helpers
 * @property {boolean} showLogs - Whether the logs viewer is open
 * @property {function} setShowLogs - Setter for showLogs
 * @property {Array<string>} logs - Every line the buffer still holds
 * @property {Array<string>} shownLogs - The lines the viewer draws (filtered or not)
 * @property {{text: string, kind: string}} headNotice - What the top of the buffer is: the real start, what was dropped, or the state of a load
 * @property {boolean} highVolume - The container writes so fast that the buffer is being renewed within a minute
 * @property {boolean} canLoadEarlier - The start of the log is not loaded and loading more can help
 * @property {function} loadEarlier - Reads an older chunk with the fetcher it is given and puts it in front
 * @property {object} logsStreamRef - Ref to the { stop() } handle returned by getLogsStream
 * @property {function} openLogs - Opens the viewer on an empty buffer ({ reachedStart } says whether what arrives begins at the log's first line)
 * @property {function} stopLogsStream - Stops the stream without touching the UI state
 * @property {function} closeLogs - Helper to close logs and cleanup
 * @property {function} appendLogs - Adds lines, holding the view still when paused
 * @property {number} scrollOffset - Lines scrolled up from the newest
 * @property {boolean} following - Whether new lines pull the view to the bottom
 * @property {number} pendingCount - Lines that arrived while paused
 * @property {function} scrollLogs - Scrolls by N lines (positive = up)
 * @property {function} scrollToTop - Jumps to the first line
 * @property {function} scrollToBottom - Jumps to the newest line and follows again
 * @property {function} toggleFollow - Pauses or resumes following
 * @property {Object} search - Search state: open, query, cursor, filter, matchCount, matchPos
 */
export function useLogsViewer() {
  const [showLogs, setShowLogs] = useState(false);
  const [buffer, setBuffer] = useState(() => createLogBuffer());
  const logs = buffer.lines;
  // "Load earlier lines": 'idle' | 'loading' | 'failed'.
  const [earlier, setEarlier] = useState('idle');
  // The buffer as the stream callbacks and the loader see it: they outlive the
  // render that made them, and the loader needs the length at response time.
  const bufferRef = useRef(buffer);
  const containerIdRef = useRef(null);
  // Bumped on open and close, so a read that outlives its viewer is ignored.
  const generationRef = useRef(0);
  const loadingRef = useRef(false);
  // Extra lines asked for after a read that brought nothing new (blank lines
  // are not held but Docker counts them).
  const extraRef = useRef(0);
  const logsStreamRef = useRef(null);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [following, setFollowing] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState(() => textStateOf(''));
  const [filterMode, setFilterMode] = useState(false);
  const [matchPos, setMatchPos] = useState(-1);

  // Read by the stream callback, which outlives the render that made it.
  const followingRef = useRef(true);
  const offsetRef = useRef(0);
  const shownLengthRef = useRef(0);
  const viewHeightRef = useRef(LOG_VIEW_LINES);
  const queryRef = useRef('');
  const filterRef = useRef(false);
  const matchIndicesRef = useRef([]);
  const matchPosRef = useRef(-1);

  const query = searchText.value;
  queryRef.current = query;
  filterRef.current = filterMode;

  // Search runs on what the user sees: the escape sequences are gone by then,
  // so a query can never match bytes that are not on screen.
  const searched = useMemo(() => {
    if (!query) return null;
    return searchLogLines(logs.map(sanitizeTerminalText), query, {
      filter: filterMode,
    });
  }, [logs, query, filterMode]);

  const shownLogs = searched ? searched.lines : logs;
  // The notice describes the top of the whole buffer; with the filter on, the
  // top of what is shown is not that.
  const headNotice = filterMode
    ? { text: '', kind: 'empty' }
    : (earlierNotice(earlier) ?? bufferHeadNotice(buffer));
  const canLoadEarlier = canLoadMore(buffer) && earlier !== 'loading';
  const highVolume = isHighVolume(buffer, Date.now());

  // The warning is a function of the clock, and a quiet container causes no
  // render: while it is on, re-evaluate it every few seconds, so it goes away
  // by itself once the minute has passed.
  const [, setClockTick] = useState(0);
  useEffect(() => {
    if (!highVolume) return undefined;
    const timer = setInterval(() => setClockTick((n) => n + 1), RECHECK_MS);
    return () => clearInterval(timer);
  }, [highVolume]);
  const matchIndices = searched ? searched.matchIndices : [];
  const matchCount = searched ? searched.matchCount : 0;
  const currentMatch = Math.min(matchPos, matchCount - 1);

  shownLengthRef.current = shownLogs.length;
  matchIndicesRef.current = matchIndices;

  /** The one way the buffer changes, so the ref never lags the state. */
  function updateBuffer(update) {
    const next = update(bufferRef.current);
    bufferRef.current = next;
    setBuffer(next);
  }

  function moveTo(offset) {
    offsetRef.current = offset;
    setScrollOffset(offset);
  }

  function setFollow(value) {
    followingRef.current = value;
    setFollowing(value);
    if (value) setPendingCount(0);
  }

  function setMatch(pos) {
    matchPosRef.current = pos;
    setMatchPos(pos);
  }

  function maxOffset() {
    return Math.max(0, shownLengthRef.current - viewHeightRef.current);
  }

  function resetView() {
    setFollow(true);
    shownLengthRef.current = 0;
    moveTo(0);
    setMatch(-1);
    setSearchOpen(false);
    setSearchText(textStateOf(''));
    setFilterMode(false);
  }

  /**
   * Adds lines to the buffer. While paused the offset grows by the same
   * amount, so the lines the user is reading do not move.
   */
  function appendLogs(lines) {
    if (lines.length === 0) return;
    updateBuffer((prev) => appendLines(prev, lines, Date.now()));
    if (followingRef.current) return;

    // With the filter on, a line that does not match is never shown, so it
    // neither moves the view nor counts as new.
    const arrived =
      filterRef.current && queryRef.current
        ? lines.filter((l) =>
            lineMatches(sanitizeTerminalText(l), queryRef.current)
          ).length
        : lines.length;
    if (arrived === 0) return;
    setPendingCount((n) => n + arrived);
    shownLengthRef.current += arrived;
    moveTo(Math.min(offsetRef.current + arrived, maxOffset()));
  }

  /**
   * Scrolls the view. Going up pauses following; reaching the newest line
   * again resumes it.
   *
   * @param {number} lines - Positive scrolls up (older), negative down
   */
  function scrollLogs(lines) {
    const next = Math.min(Math.max(0, offsetRef.current + lines), maxOffset());
    setFollow(next === 0);
    moveTo(next);
  }

  function scrollToTop() {
    scrollLogs(TO_THE_TOP);
  }

  function scrollToBottom() {
    setFollow(true);
    moveTo(0);
  }

  /** Lines the panel shows; a short terminal shrinks it. */
  function setViewHeight(lines) {
    viewHeightRef.current = lines;
  }

  function toggleFollow() {
    if (followingRef.current) {
      setFollow(false);
    } else {
      scrollToBottom();
    }
  }

  // ── Search ────────────────────────────────────────────────────────────────

  function openSearch() {
    setSearchOpen(true);
  }

  /** Enter: close the field and keep the query. */
  function closeSearch() {
    setSearchOpen(false);
  }

  /** Esc: close the field and drop the query (and the filter with it). */
  function clearSearch() {
    setSearchOpen(false);
    setSearchText(textStateOf(''));
    setMatch(-1);
    if (filterRef.current) {
      setFilterMode(false);
      scrollToBottom();
    }
  }

  /** Ctrl+F: show only the matching lines, or all of them again. */
  function toggleFilter() {
    setFilterMode((on) => !on);
    setMatch(-1);
    // The list of lines changes under the view; the bottom is the one place
    // that still means the same thing.
    scrollToBottom();
  }

  /**
   * Routes a keypress to the search field. Returns true when the field took
   * the key as text; false for Enter, Esc and the other control keys, which
   * are the keymap's.
   *
   * @param {string} input
   * @param {import('ink').Key} key
   * @returns {boolean}
   */
  function handleSearchKey(input, key) {
    if (!searchOpen) return false;
    if (key.return || key.escape) return false;
    const { state, handled } = applyKeyToText(searchText, input, key);
    if (handled && state !== searchText) {
      setSearchText(state);
      if (state.value !== searchText.value) setMatch(-1);
    }
    return handled;
  }

  /**
   * Brings a line into the middle of the window.
   *
   * @param {number} index - Index into the shown lines
   */
  function revealLine(index) {
    const length = shownLengthRef.current;
    const end = Math.min(length, index + Math.ceil(viewHeightRef.current / 2));
    const next = Math.min(Math.max(0, length - end), maxOffset());
    setFollow(next === 0);
    moveTo(next);
  }

  /**
   * Moves to the next or previous match, wrapping at the ends.
   *
   * @param {number} direction - 1 for next, -1 for previous
   */
  function jumpToMatch(direction) {
    const hits = matchIndicesRef.current;
    if (hits.length === 0) return;
    const current = matchPosRef.current;
    const next =
      current < 0
        ? direction > 0
          ? 0
          : hits.length - 1
        : (current + direction + hits.length) % hits.length;
    setMatch(next);
    revealLine(hits[next]);
  }

  // ── Earlier lines ─────────────────────────────────────────────────────────

  /** A new or closed viewer forgets any load in flight. */
  function resetEarlier() {
    generationRef.current += 1;
    loadingRef.current = false;
    extraRef.current = 0;
    setEarlier('idle');
  }

  /**
   * Loads an older chunk and puts it in front of the buffer. Docker cannot
   * page backwards, so it asks for what the buffer holds plus one chunk and
   * keeps the part it does not have. The scroll offset counts from the newest
   * line, so the lines being read do not move.
   *
   * Never rejects: a failed read is shown in the head notice and can be
   * retried.
   *
   * @param {(containerId: string, tail: number) => Promise<{lines: string[], reachedStart: boolean, failed: boolean}>} fetchChunk
   */
  async function loadEarlier(fetchChunk) {
    if (loadingRef.current || !canLoadMore(bufferRef.current)) return;
    const generation = generationRef.current;
    const chunk = LOG_RETENTION.LOAD_MORE_CHUNK;
    loadingRef.current = true;
    setEarlier('loading');

    let result = null;
    try {
      result = await fetchChunk(
        containerIdRef.current,
        bufferRef.current.lines.length + chunk + extraRef.current
      );
    } catch {
      result = null;
    }
    // The viewer was closed or reopened meanwhile: this read is not its own.
    if (generation !== generationRef.current) return;

    loadingRef.current = false;
    if (!result || result.failed) {
      setEarlier('failed');
      return;
    }

    const { older, reachedStart } = newerThanHeld(
      result,
      bufferRef.current.lines.length,
      chunk
    );

    extraRef.current =
      older.length === 0 && !reachedStart ? extraRef.current * 2 || chunk : 0;
    updateBuffer((prev) => prependLines(prev, older, reachedStart, Date.now()));
    setEarlier('idle');
  }

  // ── Open / close ──────────────────────────────────────────────────────────

  /**
   * Opens the logs viewer on an empty buffer.
   *
   * @param {Object} [options]
   * @param {boolean} [options.reachedStart=false] - What arrives begins at the log's first line
   * @param {string} [options.containerId] - Whose log "load earlier lines" reads
   */
  function openLogs({ reachedStart = false, containerId = null } = {}) {
    setShowLogs(true);
    updateBuffer(() => createLogBuffer({ reachedStart }));
    containerIdRef.current = containerId;
    resetEarlier();
    resetView();
  }

  /**
   * Stops the log stream, if any, without touching the UI state.
   * Idempotent: the handle is cleared before stop() so a re-entrant call
   * finds nothing to do.
   */
  function stopLogsStream() {
    const handle = logsStreamRef.current;
    logsStreamRef.current = null;
    if (handle) {
      safeCall(handle.stop);
    }
  }

  /**
   * Closes the logs viewer and cleans up the stream.
   */
  function closeLogs() {
    // Stop first: clearing the state must not race a chunk that is already
    // on its way (D9).
    stopLogsStream();
    setShowLogs(false);
    updateBuffer(() => createLogBuffer());
    resetEarlier();
    resetView();
  }

  // Unmount cleanup: quitting CDD with the viewer open (the `q` path has a
  // delay, useExitHandler) must not leave the stream writing into a dead tree.
  useEffect(() => {
    return () => {
      const handle = logsStreamRef.current;
      logsStreamRef.current = null;
      if (handle) {
        safeCall(handle.stop);
      }
    };
  }, []);

  return {
    showLogs,
    setShowLogs,
    logs,
    shownLogs,
    headNotice,
    highVolume,
    canLoadEarlier,
    loadEarlier,
    logsStreamRef,
    openLogs,
    stopLogsStream,
    closeLogs,
    appendLogs,
    scrollOffset,
    following,
    pendingCount,
    scrollLogs,
    scrollToTop,
    scrollToBottom,
    toggleFollow,
    setViewHeight,
    viewHeightRef,
    search: {
      open: searchOpen,
      query,
      cursor: searchText.cursor,
      filter: filterMode,
      matchCount,
      matchPos: currentMatch,
    },
    openSearch,
    closeSearch,
    clearSearch,
    toggleFilter,
    handleSearchKey,
    jumpToMatch,
  };
}
