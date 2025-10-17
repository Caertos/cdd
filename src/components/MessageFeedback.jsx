import React from "react";
import { Box, Text } from "ink";
import PropTypes from 'prop-types';

/**
 * Small component that shows a feedback message in the UI.
 *
 * @param {Object} props
 * @param {string} props.message - Message to display. If falsy, component returns null.
 * @param {string} [props.color] - Optional color name for the message text.
 * @returns {JSX.Element|null}
 */
export default function MessageFeedback({ message, color }) {
  if (!message) return null;
  return (
    <Box marginBottom={1}>
      <Text color={color}>{message}</Text>
    </Box>
  );
}

MessageFeedback.propTypes = {
  message: PropTypes.string,
  color: PropTypes.string,
};
