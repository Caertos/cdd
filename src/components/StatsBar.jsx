import React from "react";
import { Text } from "ink";
import chalk from "chalk";

export default function StatsBar({ cpu, mem }) {
  const cpuBar = makeBar(cpu);
  const memBar = makeBar(mem);

  return (
    <Text>
      CPU: {cpuBar} {colorize(cpu)}%   MEM: {memBar} {colorize(mem)}%
    </Text>
  );
}

function makeBar(value) {
  const filled = Math.round(value / 10);
  const empty = 10 - filled;
  const bar = "▓".repeat(filled) + "░".repeat(empty);
  return colorize(value, bar);
}

function colorize(value, text = value.toString()) {
  if (value < 50) return chalk.greenBright(text);
  if (value < 80) return chalk.yellowBright(text);
  return chalk.redBright(text);
}
