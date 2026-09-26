/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render } from '@testing-library/react';
import HelpPanel from '../src/components/HelpPanel.jsx';

const binding = (id, keys, extra) => ({ id, keys, ...extra });

describe('HelpPanel', () => {
  test('shows the title for the context', () => {
    const { getByText } = render(<HelpPanel context="list" bindings={[]} />);
    expect(getByText('Help — Container List')).toBeTruthy();
  });

  test('falls back to the raw context id when unlabeled', () => {
    const { getByText } = render(
      <HelpPanel context="custom-ctx" bindings={[]} />
    );
    expect(getByText('Help — custom-ctx')).toBeTruthy();
  });

  test('renders the close hint', () => {
    const { getByText } = render(<HelpPanel context="list" bindings={[]} />);
    expect(getByText('Press ? or Esc to close')).toBeTruthy();
  });

  test('renders keys joined and help text over label fallback', () => {
    const { getByText } = render(
      <HelpPanel
        context="logs"
        bindings={[
          binding('exit', ['e', 'E'], { help: 'Exit viewer' }),
          binding('pause', ['space'], { label: 'Pause stream' }),
        ]}
      />
    );
    expect(getByText('[e] [E]')).toBeTruthy();
    expect(getByText('Exit viewer')).toBeTruthy();
    expect(getByText('[space]')).toBeTruthy();
    expect(getByText('Pause stream')).toBeTruthy();
  });
});
