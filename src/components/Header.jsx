import React from "react";
import { Box, Text } from "ink";
import chalk from "chalk";
import PropTypes from 'prop-types';
import { getAppVersion } from "../helpers/appInfo.js";

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

const VERSION = getAppVersion();

export default function Header({ count }) {
  const formattedVersion = VERSION === "unknown" ? "unknown" : `v${VERSION}`;

  return (
    <Box justifyContent="space-between">
      <Text color="cyanBright">
        🐳 {chalk.bold("CDD")}
        <Text color="gray"> — CLI Docker Dashboard</Text>
      </Text>
      <Box flexDirection="column" alignItems="flex-end">
        <Text color="gray">{formattedVersion}</Text>
        <Text color="gray">
          {count} container{count === 1 ? "" : "s"} found
        </Text>
      </Box>
    </Box>
  );
}

Header.propTypes = {
  count: PropTypes.number.isRequired,
};
