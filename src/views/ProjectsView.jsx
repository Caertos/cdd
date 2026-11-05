import React from 'react';
import { Text } from 'ink';
import { STRINGS } from '../helpers/strings.js';

/**
 * Placeholder for the Projects view. Compose projects are not supported yet,
 * so this only says so.
 */
export function ProjectsView() {
  return <Text>{STRINGS.views.projectsPlaceholder}</Text>;
}
