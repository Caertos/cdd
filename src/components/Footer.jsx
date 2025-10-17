import React from "react";
import { Box, Text } from "ink";

/**
 * Simple footer displayed at the bottom of the interface.
 *
 * @returns {JSX.Element}
 */
export default function Footer() {
  return (
    <Box justifyContent="flex-end" width="100%">
      <Text dimColor>Crafted by Carlos Cochero 2025</Text>
    </Box>
  );
}
