import React from "react";
import { Text } from "ink";
import chalk from "chalk";
import PropTypes from 'prop-types';

/**
 * Small visual bar that shows CPU and memory usage percentages.
 *
 * @param {Object} props
 * @param {number} props.cpu - CPU percentage (0-100)
 * @param {number} props.mem - Memory percentage (0-100)
 * @returns {JSX.Element}
 */
export default function StatsBar({ cpu, mem }) {
  const cpuBar = makeBar(cpu);
  const memBar = makeBar(mem);

  return (
    <Text>
      CPU:{cpuBar}{colorize(cpu, ` ${formatPercent(cpu)}%`)} MEM:{memBar}{colorize(mem, ` ${formatPercent(mem)}%`)}
    </Text>
  );
}

StatsBar.propTypes = {
  cpu: PropTypes.number.isRequired,
  mem: PropTypes.number.isRequired,
};

/**
 * Build a fixed-width bar representation from a numeric percentage.
 *
 * @param {number} value - Percentage value (0-100)
 * @returns {string} Colored bar string
 */
function makeBar(value) {
  const width = 6;
  const filled = Math.round((value / 100) * width);
  const empty = Math.max(0, width - filled);
  const bar = "█".repeat(filled) + "░".repeat(empty);
  return colorize(value, bar);
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return 0;
  if (value >= 10) return Math.round(value);
  return value.toFixed(1).replace(/\.0$/, "");
}

/**
 * Colorize a value or text depending on thresholds.
 *
 * @param {number} value - Numeric value used to pick color
 * @param {string} [text] - Text to colorize, defaults to the numeric string
 * @returns {string}
 */
function colorize(value, text = value.toString()) {
  if (value < 50) return chalk.greenBright(text);
  if (value < 80) return chalk.yellowBright(text);
  return chalk.redBright(text);
}
