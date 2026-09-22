import React from 'react';
import { Text } from 'ink';
import PropTypes from 'prop-types';
import { STRINGS } from '../helpers/strings.js';

/**
 * Empty state shown when Docker is connected but there are no containers.
 *
 * @param {Object} props
 * @param {Function} props.onCreate - Open the container creation wizard
 */
export function EmptyState({ onCreate: _onCreate }) {
  return (
    <>
      <Text bold>{STRINGS.emptyTitle}</Text>
      <Text> </Text>
      <Text>{STRINGS.emptyHint}</Text>
    </>
  );
}

EmptyState.propTypes = {
  onCreate: PropTypes.func.isRequired,
};
