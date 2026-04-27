import React from 'react';
import { Box, Text } from 'ink';

/**
 * Returns the contextual keyboard hints for the current wizard state.
 *
 * @param {number} step - Current wizard step (0-3)
 * @param {boolean} hasSuggestions - Whether suggestions/hub results are visible
 * @param {boolean} isSearchingHub - Whether a Hub search is in progress
 * @returns {{ key: string, label: string }[]}
 */
function getHints(step, hasSuggestions, isSearchingHub) {
  if (step === 0) {
    if (hasSuggestions) {
      return [
        { key: '↑↓', label: 'Navigate' },
        { key: 'Enter', label: 'Select' },
        { key: 'Esc', label: 'Cancel' },
      ];
    }
    const hints = [];
    if (!isSearchingHub) hints.push({ key: 'Tab', label: 'Search Hub' });
    hints.push({ key: '↑↓', label: 'Browse' });
    hints.push({ key: 'Enter', label: 'Confirm' });
    hints.push({ key: 'Esc', label: 'Cancel' });
    return hints;
  }
  return [
    { key: 'Enter', label: 'Continue' },
    { key: 'Esc', label: 'Cancel' },
  ];
}

/**
 * Displays a row of contextual keyboard shortcut hints for the active wizard step.
 *
 * @param {Object} props
 * @param {number} props.step - Current wizard step
 * @param {boolean} [props.hasSuggestions=false] - Whether suggestions/hub results are visible
 * @param {boolean} [props.isSearchingHub=false] - Whether a Hub search is in progress
 */
function ControlsHUD({ step, hasSuggestions = false, isSearchingHub = false }) {
  const hints = getHints(step, hasSuggestions, isSearchingHub);
  return (
    <Box flexDirection="row" columnGap={2}>
      {hints.map(({ key, label }) => (
        <Box key={key}>
          <Text color="cyan">[{key}]</Text>
          <Text dimColor> {label}</Text>
        </Box>
      ))}
    </Box>
  );
}

export default ControlsHUD;
export { getHints, ControlsHUD };
