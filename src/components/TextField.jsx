import React from 'react';
import { Text } from 'ink';
import PropTypes from 'prop-types';

/**
 * TextField renders a single-line text input with a visible cursor.
 * Purely presentational — does not capture keyboard input.
 *
 * The cursor inverts the character under it. When the cursor is at the end
 * of the text, a block cursor (inverted space) is shown.
 *
 * @param {Object} props
 * @param {string}  props.label      - Label shown above the field
 * @param {string}  props.value      - Current text content
 * @param {number}  props.cursor     - Cursor position (0..value.length)
 * @param {boolean} [props.required=false] - Show in red if empty
 * @param {Array<{start: number, end: number}>} [props.maskRanges=[]] - Ranges to mask with dots
 * @param {string}  [props.placeholder]    - Dimmed text when empty
 */
export function TextField({
  label,
  value = '',
  cursor = 0,
  required = false,
  maskRanges = [],
}) {
  const isEmpty = required && !value.trim();

  // Build display value with masking applied to specified ranges
  const chars = Array.from(value);
  const displayChars = chars.map((char, idx) => {
    const inMaskRange = maskRanges.some(
      (range) => idx >= range.start && idx < range.end
    );
    return inMaskRange ? '•' : char;
  });

  const clampedCursor = Math.max(0, Math.min(displayChars.length, cursor));

  const before = displayChars.slice(0, clampedCursor).join('');
  const atCursor = displayChars[clampedCursor] ?? '';
  const after = displayChars.slice(clampedCursor + 1).join('');

  const color = isEmpty ? 'red' : 'cyan';

  return (
    <>
      <Text>{label}</Text>
      <Text color={color}>
        {before}
        {atCursor ? <Text inverse>{atCursor}</Text> : <Text inverse> </Text>}
        {after}
      </Text>
    </>
  );
}

TextField.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string,
  cursor: PropTypes.number,
  required: PropTypes.bool,
  maskRanges: PropTypes.arrayOf(
    PropTypes.shape({
      start: PropTypes.number.isRequired,
      end: PropTypes.number.isRequired,
    })
  ),
  placeholder: PropTypes.string,
};
