import React from 'react';
import { Box, Text } from 'ink';
import PropTypes from 'prop-types';

/**
 * Tab bar listing the top-level views. The active tab is inverted and
 * disabled tabs are dimmed. Each tab is a single text node so its label
 * reads as one unit ("1 Containers").
 *
 * @param {Object} props
 * @param {Array<{id: string, title: string, enabled: boolean, shortcut: number}>} props.views
 * @param {string} props.active - Id of the view currently shown
 */
export function ViewTabs({ views, active }) {
  return (
    <Box flexDirection="row">
      {views.map((view) => (
        <Box key={view.id} marginRight={2}>
          <Text
            inverse={view.id === active ? true : undefined}
            dimColor={view.enabled ? undefined : true}
          >
            {`${view.shortcut} ${view.title}`}
          </Text>
        </Box>
      ))}
    </Box>
  );
}

ViewTabs.propTypes = {
  views: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      title: PropTypes.string.isRequired,
      enabled: PropTypes.bool.isRequired,
      shortcut: PropTypes.number.isRequired,
    })
  ).isRequired,
  active: PropTypes.string.isRequired,
};
