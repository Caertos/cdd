import { useState, useRef, useEffect, useMemo } from 'react';
import { safeCall } from '../../helpers/safeCall.js';
import { LOG_VIEW_LINES } from '../../helpers/reservedRows.js';
import { sanitizeTerminalText } from '../../helpers/sanitizeTerminalText.js';
import { searchLogLines, lineMatches } from '../../helpers/logSearch.js';
import { applyKeyToText, textStateOf } from '../../helpers/textEditing.js';

/** Most lines the viewer keeps; older ones fall off the top. */
const MAX_LOG_LINES = 1000;

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
 * @property {Array<string>} logs - Every line received
 * @property {Array<string>} shownLogs - The lines the viewer draws (filtered or not)
 * @property {function} setLogs - Setter for logs
 * @property {object} logsStreamRef - Ref to the { stop() } handle returned by getLogsStream
 * @property {function} openLogs - Helper to open logs for a container
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
  const [logs, setLogs] = useState([]);
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
  const matchIndices = searched ? searched.matchIndices : [];
  const matchCount = searched ? searched.matchCount : 0;
  const currentMatch = Math.min(matchPos, matchCount - 1);

  shownLengthRef.current = shownLogs.length;
  matchIndicesRef.current = matchIndices;

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
    setLogs((prev) => [...prev, ...lines].slice(-MAX_LOG_LINES));
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

  // ── Open / close ──────────────────────────────────────────────────────────

  /**
   * Opens the logs viewer and resets logs.
   */
  function openLogs() {
    setShowLogs(true);
    setLogs([]);
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
    setLogs([]);
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
    setLogs,
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
