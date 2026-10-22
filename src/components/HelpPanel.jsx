import React from 'react';
import { Box, Text } from 'ink';
import { STRINGS } from '../helpers/strings.js';
import { displayKeys } from '../helpers/keyLabels.js';
import { HELP_CHROME_ROWS } from '../helpers/reservedRows.js';

/**
 * Full help panel for the current context.
 * Shows all active bindings grouped by category with descriptions.
 * Closes with ? or Esc.
 *
 * @param {Object} props
 * @param {import('../helpers/keymap.js').ContextId} props.context
 * @param {import('../helpers/keymap.js').Binding[]} props.bindings
 * @param {number} [props.maxRows] - Height the panel may take, borders included
 */
export function HelpPanel({ context, bindings, maxRows }) {
  const title = STRINGS.contextLabels[context] ?? context;
  // The keys that fit; a panel taller than its room would push the frame past
  // the terminal.
  const room = Number.isFinite(maxRows)
    ? Math.max(1, maxRows - HELP_CHROME_ROWS)
    : bindings.length;
  const shown = bindings.slice(0, room);

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      paddingX={1}
    >
      <Text bold color="cyan">
        Help — {title}
      </Text>
      <Text dimColor>Press ? or Esc to close</Text>
      <Text> </Text>
      {shown.map((binding) => (
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
