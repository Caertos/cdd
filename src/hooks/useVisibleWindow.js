import { useEffect, useState } from 'react';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/**
 * Compute the visible slice of a list for a fixed-height terminal window.
 *
 * The window follows the selection with hysteresis: it only moves once the
 * selected row falls outside `[offset, offset + visibleCount - 1]`, and then
 * recentres around the selection. When the whole list fits, nothing is hidden.
 *
 * @param {Object} params
 * @param {number} params.total - Number of rows in the full list
 * @param {number} params.selectedIndex - Index of the selected row (over `total`)
 * @param {number} params.availableRows - Number of rows the terminal can show
 * @returns {{ offset: number, visibleCount: number, hiddenAbove: number, hiddenBelow: number }}
 */
export function useVisibleWindow({ total, selectedIndex, availableRows } = {}) {
  const safeTotal = Number.isFinite(total) && total > 0 ? total : 0;
  const safeRows = Number.isFinite(availableRows) ? availableRows : 0;
  const visibleCount =
    safeTotal <= 0 ? 0 : Math.min(safeTotal, Math.max(1, safeRows));

  const maxOffset = Math.max(0, safeTotal - visibleCount);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    setOffset((current) => {
      // Re-clamp when total / visibleCount change (e.g. a smaller terminal).
      const clamped = clamp(current, 0, maxOffset);
      if (safeTotal <= visibleCount) return 0;
      if (!Number.isFinite(selectedIndex) || selectedIndex < 0) return clamped;
      const lastVisible = clamped + visibleCount - 1;
      if (selectedIndex >= clamped && selectedIndex <= lastVisible) {
        return clamped;
      }
      return clamp(selectedIndex - Math.floor(visibleCount / 2), 0, maxOffset);
    });
  }, [safeTotal, visibleCount, selectedIndex, maxOffset]);

  if (safeTotal <= visibleCount) {
    return { offset: 0, visibleCount, hiddenAbove: 0, hiddenBelow: 0 };
  }

  const effectiveOffset = clamp(offset, 0, maxOffset);
  return {
    offset: effectiveOffset,
    visibleCount,
    hiddenAbove: effectiveOffset,
    hiddenBelow: Math.max(0, safeTotal - effectiveOffset - visibleCount),
  };
}
