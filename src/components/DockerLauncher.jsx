import React from 'react';
import { Box, Text } from 'ink';
import PropTypes from 'prop-types';
import { STRINGS } from '../helpers/strings.js';

const T = STRINGS.dockerLauncher;

const seconds = (ms) => Math.round(ms / 1000);

/**
 * Presentational panel for the Docker-launch flow.
 *
 * Renders nothing for `idle` — the `[S]` key hint is added by the parent
 * (ConnectionNotice) in the integration PR. Every other status maps to a
 * short, actionable panel; the transitions themselves live in
 * `useDockerLauncher`.
 *
 * @param {Object} props
 * @param {import('../helpers/dockerLauncher.js').LaunchMethod|null} props.method
 * @param {'idle'|'confirming'|'launching'|'waiting'|'ready'|'failed'|'timeout'} props.status
 * @param {number} props.elapsedMs
 * @param {string|null} props.error
 */
export function DockerLauncher({ method, status, elapsedMs, error }) {
  if (status === 'idle') {
    return null;
  }

  if (status === 'confirming' && method) {
    return (
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor="cyan"
        padding={1}
      >
        <Text bold>{T.confirmingTitle}</Text>
        <Text> </Text>
        <Text>{T.confirmingExplain}</Text>
        <Text bold color="cyan">
          {method.display}
        </Text>
        {method.needsPrivileges && (
          <>
            <Text> </Text>
            <Text color="yellow">{T.passwordPrompt}</Text>
            <Text dimColor>{T.passwordWhy}</Text>
          </>
        )}
        <Text> </Text>
        <Text color="cyan">{T.confirmHint}</Text>
      </Box>
    );
  }

  if (status === 'launching') {
    return (
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor="cyan"
        padding={1}
      >
        <Text>{T.launching}</Text>
      </Box>
    );
  }

  if (status === 'waiting' && method) {
    return (
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor="cyan"
        padding={1}
      >
        <Text>{T.launching}</Text>
        <Text>{T.waitingStarted(seconds(elapsedMs))}</Text>
        <Text dimColor>{T.waitingNote(seconds(method.typicalWaitMs))}</Text>
        <Text color="cyan">{T.waitingCancel}</Text>
      </Box>
    );
  }

  if (status === 'ready') {
    return (
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor="green"
        padding={1}
      >
        <Text bold color="green">
          {T.ready}
        </Text>
      </Box>
    );
  }

  if (status === 'failed') {
    return (
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor="red"
        padding={1}
      >
        <Text bold color="red">
          {error || T.launchFailed}
        </Text>
        <Text> </Text>
        <Text>{T.failedHint}</Text>
      </Box>
    );
  }

  if (status === 'timeout' && method) {
    return (
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor="yellow"
        padding={1}
      >
        <Text bold color="yellow">
          {T.timeoutExplain}
        </Text>
        {method.kind === 'windows-desktop' && (
          <Text dimColor>{T.timeoutWsl2}</Text>
        )}
        <Text> </Text>
        <Box columnGap={2}>
          <Text color="cyan">{T.timeoutKeepWaiting}</Text>
          <Text color="cyan">{T.timeoutGiveUp}</Text>
        </Box>
      </Box>
    );
  }

  return null;
}

DockerLauncher.propTypes = {
  method: PropTypes.shape({
    kind: PropTypes.string.isRequired,
    command: PropTypes.string.isRequired,
    args: PropTypes.arrayOf(PropTypes.string).isRequired,
    needsPrivileges: PropTypes.bool.isRequired,
    display: PropTypes.string.isRequired,
    typicalWaitMs: PropTypes.number.isRequired,
  }),
  status: PropTypes.oneOf([
    'idle',
    'confirming',
    'launching',
    'waiting',
    'ready',
    'failed',
    'timeout',
  ]).isRequired,
  elapsedMs: PropTypes.number.isRequired,
  error: PropTypes.string,
};
