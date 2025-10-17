import React from "react";
import { Box, Text } from "ink";

/**
 * Small usage menu that explains available keybindings to the user.
 *
 * @returns {JSX.Element}
 */
export default function UsageMenu() {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text>Use / for navigation</Text>
      <Text>I to initiate selected container</Text>
      <Text>P to stop selected container</Text>
      <Text>R to restart selected container</Text>
      <Text>C to create a container</Text>
      <Text>L to view logs of selected container</Text>
      <Text>E to remove selected container</Text>
      <Text>Q to quit</Text>
    </Box>
  );
}
