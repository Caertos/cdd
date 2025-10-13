import React from "react";
import { Box, Text } from "ink";

export default function MessageFeedback({ message, color }) {
  if (!message) return null;
  return (
    <Box marginBottom={1}>
      <Text color={color}>{message}</Text>
    </Box>
  );
}
