import React from 'react';
import { Box, Text } from 'ink';
import { STRINGS } from '../helpers/strings.js';
import { displayKeys } from '../helpers/keyLabels.js';

/**
 * Full help panel for the current context.
 * Shows all active bindings grouped by category with descriptions.
 * Closes with ? or Esc.
 *
 * @param {Object} props
 * @param {import('../helpers/keymap.js').ContextId} props.context
 * @param {import('../helpers/keymap.js').Binding[]} props.bindings
 */
export function HelpPanel({ context, bindings }) {
  const title = STRINGS.contextLabels[context] ?? context;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      padding={1}
    >
      <Text bold color="cyan">
        Help — {title}
      </Text>
      <Text dimColor>Press ? or Esc to close</Text>
      <Text> </Text>
      {bindings.map((binding) => (
        <Box key={binding.id} columnGap={2}>
          <Text color="cyan">
            {displayKeys(binding.keys)
              .map((k) => `[${k}]`)
              .join(' ')}
          </Text>
          <Text>{binding.help ?? binding.label}</Text>
        </Box>
      ))}
    </Box>
  );
}

export default HelpPanel;
