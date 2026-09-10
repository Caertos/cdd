import React from 'react';
import { Box, Text } from 'ink';
import PropTypes from 'prop-types';

const WARNING_COLORS = {
  'image-pull': 'yellow',
  'port-taken': 'red',
  'name-taken': 'red',
  'missing-env': 'yellow',
  'secret-plain': 'yellow',
};

/**
 * Displays the creation summary table with rows, origins, and warnings.
 *
 * @param {Object} props
 * @param {import('../helpers/creationSummary.js').SummaryRow[]} props.rows
 * @param {import('../helpers/creationSummary.js').Warning[]} props.warnings
 * @param {number} props.focusedRow - Index of the currently focused row
 * @param {boolean} props.isLoadingPreview - True while port preview loads
 */
export function CreationSummary({
  rows,
  warnings,
  focusedRow,
  isLoadingPreview,
}) {
  return (
    <Box flexDirection="column">
      <Text bold>Review and confirm</Text>
      <Text> </Text>
      {rows.map((row, idx) => {
        const isFocused = idx === focusedRow;
        return (
          <Box key={row.key} flexDirection="column">
            <Box>
              <Text color={isFocused ? 'cyan' : undefined}>
                [{row.step + 1}]{' '}
              </Text>
              <Text bold>{row.label} </Text>
              <Text>{row.values.join(', ')}</Text>
            </Box>
            {row.origin && (
              <Box paddingLeft={4}>
                <Text dimColor>
                  {'\u2193'} {row.origin}
                </Text>
              </Box>
            )}
          </Box>
        );
      })}
      {isLoadingPreview && (
        <Box paddingTop={1}>
          <Text dimColor>Checking image for exposed ports...</Text>
        </Box>
      )}
      {warnings.length > 0 && (
        <Box flexDirection="column" paddingTop={1}>
          {warnings.map((w, idx) => (
            <Text key={idx} color={WARNING_COLORS[w.kind] || 'yellow'}>
              {'\u26A0 '} {w.text}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
}

CreationSummary.propTypes = {
  rows: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      step: PropTypes.number.isRequired,
      label: PropTypes.string.isRequired,
      values: PropTypes.arrayOf(PropTypes.string).isRequired,
      origin: PropTypes.string,
    })
  ).isRequired,
  warnings: PropTypes.arrayOf(
    PropTypes.shape({
      kind: PropTypes.string.isRequired,
      level: PropTypes.string.isRequired,
      text: PropTypes.string.isRequired,
    })
  ).isRequired,
  focusedRow: PropTypes.number.isRequired,
  isLoadingPreview: PropTypes.bool.isRequired,
};
