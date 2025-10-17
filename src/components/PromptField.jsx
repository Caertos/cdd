import React from "react";
import { Text } from "ink";
import PropTypes from 'prop-types';

/**
 * PromptField shows a label and the current typed value for an input field.
 * The cursor is represented with a trailing underscore.
 *
 * @param {Object} props
 * @param {string} props.label - Label shown above the input value
 * @param {string} props.value - Current value of the input
 * @param {boolean} [props.required=false] - Whether the field is required
 * @returns {JSX.Element}
 */
export function PromptField({ label, value, required }) {
  // If the field is required and empty, show in red
  const isEmpty = required && !value.trim();
  return (
    <>
      <Text>{label}</Text>
      <Text color={isEmpty ? "red" : "cyan"}>{value}_</Text>
    </>
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
  return <Text color={color || "yellow"}>{message}</Text>;
}

PromptField.propTypes = {
  label: PropTypes.string,
  value: PropTypes.string,
  required: PropTypes.bool,
};

PromptMessage.propTypes = {
  message: PropTypes.string,
  color: PropTypes.string,
};
