import React from 'react';
import { Box, Text } from 'ink';
import PropTypes from 'prop-types';

/**
 * Renders an autocomplete suggestion panel as a boxed list below the image input.
 * Displays a window of `maxVisible` items starting at `visibleOffset`.
 * The focused row (selectedIndex) is highlighted cyan with a › prefix.
 *
 * @param {Object} props
 * @param {string[]} props.items - Full list of suggestion strings
 * @param {number} props.selectedIndex - Currently focused index (-1 = none)
 * @param {number} props.visibleOffset - First item index of the visible window
 * @param {number} [props.maxVisible=6] - Maximum number of items visible at once
 * @returns {JSX.Element|null}
 */
export function SuggestionPanel({
  items,
  selectedIndex,
  visibleOffset,
  maxVisible = 6,
}) {
  if (!items || items.length === 0) return null;

  const visible = items.slice(visibleOffset, visibleOffset + maxVisible);

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="cyan"
      paddingX={1}
      data-testid="suggestion-panel"
    >
      {visible.map((item, localIdx) => {
        const globalIdx = visibleOffset + localIdx;
        const isFocused = globalIdx === selectedIndex;
        return (
          <Text key={item} color={isFocused ? 'cyan' : undefined} dimColor={!isFocused}>
            {isFocused ? `› ${item}` : `  ${item}`}
          </Text>
        );
      })}
    </Box>
  );
}

SuggestionPanel.propTypes = {
  items: PropTypes.arrayOf(PropTypes.string).isRequired,
  selectedIndex: PropTypes.number.isRequired,
  visibleOffset: PropTypes.number.isRequired,
  maxVisible: PropTypes.number,
};
