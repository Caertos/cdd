import React from 'react';
import { Text } from 'ink';
import { STRINGS } from '../helpers/strings.js';

/**
 * Placeholder for the Images view. Image management is not available yet,
 * so this only says so.
 */
export function ImagesView() {
  return <Text>{STRINGS.views.imagesPlaceholder}</Text>;
}
