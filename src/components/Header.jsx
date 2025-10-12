import React from "react";
import { Box, Text } from "ink";
import chalk from "chalk";

export default function Header({ count }) {
  return (
    <Box justifyContent="space-between">
      <Text color="cyanBright">
        🐳 {chalk.bold("CDD")}
        <Text color="gray"> — CLI Docker Dashboard</Text>
      </Text>
      <Text color="gray">
        {count} container{count === 1 ? "" : "s"} found
      </Text>
    </Box>
  );
}
