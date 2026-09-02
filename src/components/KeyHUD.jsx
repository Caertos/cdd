import React from 'react';
import { Box, Text } from 'ink';

/**
 * Displays a single-line bar of active keyboard shortcuts.
 * Purely presentational — reads from the keymap bindings.
 *
 * @param {Object} props
 * @param {import('../helpers/keymap.js').Binding[]} props.bindings - Active bindings
 * @param {number} [props.maxWidth=80] - Available width; truncates and adds "? more"
 */
export function KeyHUD({ bindings, maxWidth = 80 }) {
  if (!bindings || bindings.length === 0) return null;

  const items = [];
  let usedWidth = 0;
  let truncated = false;

  for (const binding of bindings) {
    const keyText = binding.keys[0];
    const labelText = binding.label;
    const itemWidth = keyText.length + labelText.length + 4;

    if (usedWidth + itemWidth > maxWidth && items.length > 0) {
      truncated = true;
      break;
    }

    items.push({ key: keyText, label: labelText });
    usedWidth += itemWidth;
  }

  return (
    <Box flexDirection="row" columnGap={2}>
      {items.map((item) => (
        <Box key={item.key}>
          <Text color="cyan">[{item.key}]</Text>
          <Text dimColor> {item.label}</Text>
        </Box>
      ))}
      {truncated && (
        <Box>
          <Text dimColor italic>
            {' '}
            ? more
          </Text>
        </Box>
      )}
    </Box>
  );
}

export default KeyHUD;
