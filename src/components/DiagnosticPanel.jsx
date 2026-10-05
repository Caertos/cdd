import React from 'react';
import { Box, Text } from 'ink';
import PropTypes from 'prop-types';
import { STRINGS } from '../helpers/strings.js';

/**
 * Why the selected container is in the state it is in.
 *
 * The panel shows itself, unprompted, only when there is something to say: a
 * container that was stopped on purpose gets nothing. Its whole value rests
 * on being believable, so when no rule matched it says so and shows the log
 * tail rather than offering a guess.
 *
 * @param {Object} props
 * @param {import('../helpers/diagnostics/diagnose.js').Diagnosis|null} props.diagnosis
 *   null while the log is still being read
 * @param {string} props.containerName - Name shown in the title
 * @param {boolean} [props.isLoading] - True while the log is being read
 * @returns {JSX.Element|null}
 */
export function DiagnosticPanel({
  diagnosis,
  containerName,
  isLoading = false,
}) {
  const { panelTitle, likelyCause, notRecognized, lastLines } =
    STRINGS.diagnostics;

  // Nothing to say and nothing on the way: stay out of the layout entirely.
  if (!diagnosis && !isLoading) return null;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="yellow"
      paddingX={1}
      marginTop={1}
    >
      <Text bold color="yellow">
        {panelTitle(containerName)}
      </Text>

      <Text> </Text>

      {diagnosis && <Text>{diagnosis.what}</Text>}

      {isLoading ? (
        <>
          <Text> </Text>
          <Text dimColor>{STRINGS.diagnostics.readingLog}</Text>
        </>
      ) : (
        diagnosis && (
          <>
            <Text> </Text>
            <Box paddingLeft={2} flexDirection="column">
              <Text bold>{likelyCause}</Text>
              <Text>
                {diagnosis.why ??
                  (diagnosis.tail.length > 0
                    ? notRecognized
                    : STRINGS.diagnostics.noOutput)}
              </Text>
            </Box>

            {diagnosis.tail.length > 0 && (
              <>
                <Text> </Text>
                <Box paddingLeft={2} flexDirection="column">
                  <Text bold>{lastLines}</Text>
                  {diagnosis.tail.map((line, i) => (
                    <Text key={i} dimColor>
                      {line}
                    </Text>
                  ))}
                </Box>
              </>
            )}
          </>
        )
      )}

      <Text> </Text>
      <Text color="cyan">{STRINGS.diagnostics.viewFullLog}</Text>
    </Box>
  );
}

DiagnosticPanel.propTypes = {
  diagnosis: PropTypes.shape({
    what: PropTypes.string.isRequired,
    why: PropTypes.string,
    ruleId: PropTypes.string,
    evidence: PropTypes.arrayOf(PropTypes.string),
    fix: PropTypes.object,
    tail: PropTypes.arrayOf(PropTypes.string).isRequired,
  }),
  containerName: PropTypes.string,
  isLoading: PropTypes.bool,
};

export default DiagnosticPanel;
