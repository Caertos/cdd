import React from "react";
import { Box, Text } from "ink";
import chalk from "chalk";
import PropTypes from 'prop-types';

/**
 * Header component displayed at the top of the CLI UI.
 *
 * @component
 * @param {Object} props
 * @param {number} props.count - Number of containers currently detected
 * @returns {JSX.Element}
 * @example
 * <Header count={3} />
 */

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

Header.propTypes = {
  count: PropTypes.number.isRequired,
};
