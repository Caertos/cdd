import React from "react";
import { Box, Text } from "ink";

const SHORTCUTS = [
  "Use ↑/↓ for navigation",
  "I to initiate selected container",
  "P to stop selected container",
  "R to restart selected container",
  "C to create a container",
  "L to view logs of selected container",
  "D to toggle debug log panel",
  "E to remove selected container",
  "Q to quit",
];

const GRID_COLUMNS = 3;

/**
 * Small usage menu that explains available keybindings to the user.
 * Renders entries in a responsive grid to avoid an excessively long column.
 *
 * @returns {JSX.Element}
 */
export default function UsageMenu() {
  const rowsPerColumn = Math.ceil(SHORTCUTS.length / GRID_COLUMNS);
  const columns = Array.from({ length: GRID_COLUMNS }, (_, columnIndex) =>
    SHORTCUTS.slice(columnIndex * rowsPerColumn, (columnIndex + 1) * rowsPerColumn)
  ).filter((column) => column.length > 0);

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box flexDirection="row">
        {columns.map((column, columnIndex) => (
          <Box
            key={`shortcut-column-${columnIndex}`}
            flexDirection="column"
            marginRight={columnIndex === columns.length - 1 ? 0 : 3}
          >
            {column.map((shortcut, rowIndex) => (
              <Text key={`shortcut-${columnIndex}-${rowIndex}`}>{shortcut}</Text>
            ))}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
