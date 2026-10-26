import React from 'react';
import { Box, Text } from 'ink';
import PropTypes from 'prop-types';
import { isSecretKey } from '../helpers/secrets.js';
import { EMPTY_VALUE } from '../helpers/creationSummary.js';
import { sanitizeTerminalText } from '../helpers/sanitizeTerminalText.js';

const WARNING_COLORS = {
  'image-pull': 'yellow',
  'port-taken': 'red',
  'name-taken': 'red',
  'missing-env': 'yellow',
  'secret-plain': 'yellow',
  'secret-weak': 'yellow',
};

/**
 * Masks the value of a secret env entry unless the user chose to reveal it.
 * Non-env rows and non-secret entries pass through untouched.
 *
 * @param {string} rowKey
 * @param {string} v
 * @param {boolean} revealSecrets
 * @returns {string}
 */
function displayValue(rowKey, v, revealSecrets) {
  if (rowKey !== 'env') return v;
  const eqIdx = v.indexOf('=');
  if (eqIdx === -1) return v;
  const key = v.slice(0, eqIdx);
  const value = v.slice(eqIdx + 1).trim();
  // An empty secret has nothing to mask or reveal.
  const hasValue = value !== '' && value !== EMPTY_VALUE;
  if (!isSecretKey(key) || !hasValue) return v;
  // Show masked with Ctrl+R hint
  return revealSecrets ? v : `${key}=•••••• [^R]`;
}

/**
 * Pairs each warning with a key built from its content plus how many times
 * the same content appeared before it, so duplicates stay unique and stable.
 *
 * @param {Array<{kind: string, text: string}>} warnings
 * @returns {Array<{warning: object, key: string}>}
 */
function keyedWarnings(warnings) {
  const seen = new Map();
  return warnings.map((warning) => {
    const base = `${warning.kind}:${warning.text}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return { warning, key: `${base}#${count}` };
  });
}

/**
 * Displays the creation summary table with rows, origins, and warnings.
 *
 * @param {Object} props
 * @param {import('../helpers/creationSummary.js').SummaryRow[]} props.rows
 * @param {import('../helpers/creationSummary.js').Warning[]} props.warnings
 * @param {number} props.focusedRow - Index of the currently focused row
 * @param {boolean} props.isLoadingPreview - True while port preview loads
 * @param {boolean} props.revealSecrets - If true, show secret values in plain text
 */
export function CreationSummary({
  rows,
  warnings,
  focusedRow,
  isLoadingPreview,
  revealSecrets = false,
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
              <Text bold color={row.changed ? 'green' : undefined}>
                {row.label}{' '}
              </Text>
              <Text color={row.changed ? 'green' : undefined}>
                {/* The values can come from a container that was inspected, so
                    they are text CDD did not write. */}
                {sanitizeTerminalText(
                  row.values
                    .map((v) => displayValue(row.key, v, revealSecrets))
                    .join(', ')
                )}
              </Text>
            </Box>
            {row.changed && (
              <Box paddingLeft={4}>
                <Text color="green">{'\u2191'} changed by CDD</Text>
              </Box>
            )}
            {row.origin && (
              <Box paddingLeft={4}>
                <Text dimColor>
                  {'\u2193'} {sanitizeTerminalText(row.origin)}
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
          {keyedWarnings(warnings).map(({ warning: w, key }) => (
            <Text key={key} color={WARNING_COLORS[w.kind] || 'yellow'}>
              {'⚠ '} {sanitizeTerminalText(w.text)}
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
      changed: PropTypes.bool,
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
  revealSecrets: PropTypes.bool,
};
