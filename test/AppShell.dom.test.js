/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render } from '@testing-library/react';
import { AppShell, COMPACT_ROWS } from '../src/components/AppShell.jsx';

function renderShell(props) {
  return render(
    <AppShell
      header={<span>HEADER</span>}
      nav={<span>NAV</span>}
      content={<span>CONTENT</span>}
      hud={<span>HUD</span>}
      footer={<span>FOOTER</span>}
      {...props}
    />
  );
}

describe('AppShell', () => {
  test('paints the five zones when there are plenty of rows', () => {
    const { getByText } = renderShell({ terminalRows: 40 });
    expect(getByText('HEADER')).toBeTruthy();
    expect(getByText('NAV')).toBeTruthy();
    expect(getByText('CONTENT')).toBeTruthy();
    expect(getByText('HUD')).toBeTruthy();
    expect(getByText('FOOTER')).toBeTruthy();
  });

  test('keeps header, nav, content and hud but drops the footer in a small terminal', () => {
    const { getByText, queryByText } = renderShell({
      terminalRows: COMPACT_ROWS - 1,
    });
    expect(getByText('HEADER')).toBeTruthy();
    expect(getByText('NAV')).toBeTruthy();
    expect(getByText('CONTENT')).toBeTruthy();
    expect(getByText('HUD')).toBeTruthy();
    expect(queryByText('FOOTER')).toBeNull();
  });

  test('still shows the footer at exactly COMPACT_ROWS rows', () => {
    expect(COMPACT_ROWS).toBe(20);
    const { getByText } = renderShell({ terminalRows: COMPACT_ROWS });
    expect(getByText('FOOTER')).toBeTruthy();
  });

  test('uses the normal layout when the terminal height is unknown', () => {
    const { getByText } = renderShell({ terminalRows: undefined });
    expect(getByText('FOOTER')).toBeTruthy();
  });

  test('renders without a footer prop', () => {
    const { getByText } = renderShell({ footer: undefined });
    expect(getByText('HEADER')).toBeTruthy();
    expect(getByText('NAV')).toBeTruthy();
    expect(getByText('CONTENT')).toBeTruthy();
    expect(getByText('HUD')).toBeTruthy();
  });
});
