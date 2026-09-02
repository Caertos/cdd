import React from 'react';
import { TextField } from './TextField.jsx';
import { Text } from 'ink';
import PropTypes from 'prop-types';

/**
 * PromptField shows a label and the current typed value for an input field.
 * Wraps TextField with cursor rendering.
 *
 * @param {Object} props
 * @param {string} props.label - Label shown above the input value
 * @param {string} props.value - Current value of the input
 * @param {number} [props.cursor] - Cursor position (0..value.length). When
 *   omitted the cursor defaults to the end of the value.
 * @param {boolean} [props.required=false] - Whether the field is required
 * @returns {JSX.Element}
 */
export function PromptField({ label, value, cursor, required }) {
  const cursorPos = cursor !== undefined ? cursor : (value || '').length;
  return (
    <TextField
      label={label}
      value={value || ''}
      cursor={cursorPos}
      required={required}
    />
  );
}

/**
 * Small helper to show a message below prompts (errors, hints, etc.).
 *
 * @param {Object} props
 * @param {string} props.message - Message text to display
 * @param {string} [props.color] - Optional color for the message
 * @returns {JSX.Element|null}
 */
export function PromptMessage({ message, color }) {
  if (!message) return null;
  return <Text color={color || 'yellow'}>{message}</Text>;
}

PromptField.propTypes = {
  label: PropTypes.string,
  value: PropTypes.string,
  cursor: PropTypes.number,
  required: PropTypes.bool,
};

PromptMessage.propTypes = {
  message: PropTypes.string,
  color: PropTypes.string,
};
