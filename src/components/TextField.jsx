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
 * @param {boolean} [props.masked=false]   - Reserved for TASK-5 (secrets)
 * @param {string}  [props.placeholder]    - Dimmed text when empty
 */
export function TextField({
  label,
  value = '',
  cursor = 0,
  required = false,
  masked = false,
}) {
  const isEmpty = required && !value.trim();
  const displayValue = masked ? '*'.repeat(value.length) : value;
  const chars = Array.from(displayValue);
  const clampedCursor = Math.max(0, Math.min(chars.length, cursor));

  const before = chars.slice(0, clampedCursor).join('');
  const atCursor = chars[clampedCursor] ?? '';
  const after = chars.slice(clampedCursor + 1).join('');

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
  masked: PropTypes.bool,
  placeholder: PropTypes.string,
};
