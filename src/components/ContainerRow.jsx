import React from "react";
import { Box, Text } from 'ink';
import chalk from 'chalk';

const colorByState = state => {
  if (state === 'running') return chalk.greenBright('🟢 RUNNING');
  if (state === 'exited') return chalk.redBright('🔴 EXITED');
  if (state === 'paused') return chalk.yellowBright('🟠 PAUSED');
  return chalk.gray(state.toUpperCase());
};

export default function ContainerRow({ container }) {
  const { name, image, state, status, ports } = container;
  return (
    <Box flexDirection="row" justifyContent="space-between">
      <Text>
        {chalk.cyan(name.padEnd(25))}  
        {chalk.white(image.padEnd(25))}  
        {colorByState(state)}  
        {chalk.gray(` ${ports}`)}
      </Text>
    </Box>
  );
}
