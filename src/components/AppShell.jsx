import React from 'react';
import { Box } from 'ink';
import PropTypes from 'prop-types';
import { COMPACT_ROWS } from '../helpers/reservedRows.js';

// Re-exported: AppShell.dom.test.js imports the threshold from here.
export { COMPACT_ROWS };

/**
 * Armazón persistente. Sólo estructura: no conoce ninguna vista concreta.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.header
 * @param {React.ReactNode} props.nav
 * @param {React.ReactNode} props.content
 * @param {React.ReactNode} props.hud
 * @param {React.ReactNode} [props.footer]
 * @param {number} props.terminalRows - De useStdout, para degradar en pantallas pequeñas
 */
export function AppShell({ header, nav, content, hud, footer, terminalRows }) {
  const compact = typeof terminalRows === 'number' && terminalRows < COMPACT_ROWS;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      padding={compact ? 0 : 1}
    >
      {header}
      {nav}
      {content}
      {hud}
      {!compact && footer}
    </Box>
  );
}

AppShell.propTypes = {
  header: PropTypes.node,
  nav: PropTypes.node,
  content: PropTypes.node,
  hud: PropTypes.node,
  footer: PropTypes.node,
  terminalRows: PropTypes.number,
};
