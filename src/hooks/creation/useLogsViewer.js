import { useState, useRef, useEffect } from 'react';
import { safeCall } from '../../helpers/safeCall.js';
import { LOG_VIEW_LINES } from '../../helpers/reservedRows.js';

/** Most lines the viewer keeps; older ones fall off the top. */
const MAX_LOG_LINES = 1000;

/** Larger than any buffer: scrolling this far lands on the first line. */
const TO_THE_TOP = Number.MAX_SAFE_INTEGER;

/**
 * Custom hook to manage the logs viewer state and stream reference.
 * Handles showing/hiding logs, the scroll window, and follow/pause.
 *
 * `scrollOffset` counts lines up from the newest line of what is shown.
 *
 * @returns {Object} Logs viewer state and helpers
 * @property {boolean} showLogs - Whether the logs viewer is open
 * @property {function} setShowLogs - Setter for showLogs
 * @property {Array<string>} logs - Array of log lines
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
 */
export function useLogsViewer() {
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState([]);
  const logsStreamRef = useRef(null);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [following, setFollowing] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  // Read by the stream callback, which outlives the render that made it.
  const followingRef = useRef(true);
  const offsetRef = useRef(0);
  const shownLengthRef = useRef(0);
  const viewHeightRef = useRef(LOG_VIEW_LINES);

  shownLengthRef.current = logs.length;

  function moveTo(offset) {
    offsetRef.current = offset;
    setScrollOffset(offset);
  }

  function setFollow(value) {
    followingRef.current = value;
    setFollowing(value);
    if (value) setPendingCount(0);
  }

  function maxOffset() {
    return Math.max(0, shownLengthRef.current - viewHeightRef.current);
  }

  function resetView() {
    setFollow(true);
    shownLengthRef.current = 0;
    moveTo(0);
  }

  /**
   * Adds lines to the buffer. While paused the offset grows by the same
   * amount, so the lines the user is reading do not move.
   */
  function appendLogs(lines) {
    if (lines.length === 0) return;
    setLogs((prev) => [...prev, ...lines].slice(-MAX_LOG_LINES));
    if (followingRef.current) return;

    const arrived = lines.length;
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
  };
}
