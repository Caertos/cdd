import React from 'react';
import { Box, Text } from 'ink';
import PropTypes from 'prop-types';

/**
 * Connection error screen shown when Docker is unreachable.
 *
 * @param {Object} props
 * @param {import('../helpers/dockerErrors.js').DockerErrorInfo} props.error
 * @param {number} props.nextRetryIn - Seconds until the next retry
 */
export function ConnectionNotice({ error, nextRetryIn }) {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="red"
      padding={1}
    >
      <Text bold color="red">
        {error.title}
      </Text>
      <Text> </Text>
      <Text>{error.detail}</Text>
      <Text> </Text>
      <Text bold>Try this:</Text>
      {error.hints.map((hint, i) => (
        <Text key={i}>
          {'  · '}
          {hint}
        </Text>
      ))}
      <Text> </Text>
      <Text dimColor>Technical detail: {error.technical}</Text>
      <Text> </Text>
      <Box justifyContent="space-between">
        <Text>
          {nextRetryIn > 0 ? `Retrying in ${nextRetryIn} s...` : 'Retrying...'}
        </Text>
        <Box columnGap={2}>
          <Text color="cyan">[R] retry now</Text>
          <Text color="cyan">[Q] quit</Text>
        </Box>
      </Box>
    </Box>
  );
}

ConnectionNotice.propTypes = {
  error: PropTypes.shape({
    kind: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    detail: PropTypes.string.isRequired,
    hints: PropTypes.arrayOf(PropTypes.string).isRequired,
    technical: PropTypes.string.isRequired,
  }).isRequired,
  nextRetryIn: PropTypes.number.isRequired,
};
