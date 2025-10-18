import React from "react";
import { Text } from "ink";
import chalk from "chalk";
import PropTypes from 'prop-types';

const BAR_WIDTH = 8;

/**
 * Small visual bar that shows CPU and memory usage percentages.
 *
 * @param {Object} props
 * @param {number} props.cpu - CPU percentage (values outside 0-100 are clamped)
 * @param {number} props.mem - Memory percentage (values outside 0-100 are clamped)
 * @returns {JSX.Element}
 */
export default function StatsBar({ cpu, mem }) {
  const cpuBar = makeBar(cpu, BAR_WIDTH);
  const memBar = makeBar(mem, BAR_WIDTH);

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
 * @param {number} value - Percentage value (values outside 0-100 are clamped)
 * @param {number} width - Desired bar width in characters
 * @returns {string} Colored bar string
 */
function makeBar(value, width) {
  const safeWidth = Math.max(1, Math.round(width));
  const normalized = Number.isFinite(value) ? Math.min(Math.max(value, 0), 100) : 0;
  const filled = Math.round((normalized / 100) * safeWidth);
  const empty = Math.max(0, safeWidth - filled);
  const bar = "█".repeat(filled) + "░".repeat(empty);
  return colorize(normalized, bar);
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return 0;
  const normalized = Math.min(Math.max(value, 0), 100);
  if (normalized >= 10) return Math.round(normalized);
  return normalized.toFixed(1).replace(/\.0$/, "");
}

/**
 * Colorize a value or text depending on thresholds.
 *
 * @param {number} value - Numeric value used to pick color; receives clamped percentage
 * @param {string} [text] - Text to colorize, defaults to the numeric string
 * @returns {string}
 */
function colorize(value, text = value.toString()) {
  if (value < 50) return chalk.greenBright(text);
  if (value < 80) return chalk.yellowBright(text);
  return chalk.redBright(text);
}
