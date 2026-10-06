/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render } from '@testing-library/react';
import HelpPanel from '../src/components/HelpPanel.jsx';
import { KEYMAP } from '../src/helpers/keymap.js';
import { STRINGS } from '../src/helpers/strings.js';

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
    expect(getByText('[Space]')).toBeTruthy();
    expect(getByText('Pause stream')).toBeTruthy();
  });

  test('shows friendly key names and lists a shifted twin once', () => {
    const { getByText, queryByText } = render(
      <HelpPanel
        context="list"
        bindings={[
          binding('fix', ['F', 'shift+F'], { help: 'Fix it' }),
          binding('up', ['up'], { help: 'Move up' }),
          binding('close', ['escape', '?'], { help: 'Close' }),
        ]}
      />
    );
    expect(getByText('[F]')).toBeTruthy();
    expect(queryByText('[F] [shift+F]')).toBeNull();
    expect(getByText('[↑]')).toBeTruthy();
    expect(getByText('[Esc] [?]')).toBeTruthy();
  });

  // §5.5 (D16)
  test('every keymap context has a label in STRINGS.contextLabels', () => {
    const missing = Object.keys(KEYMAP).filter((ctx) => !STRINGS.contextLabels[ctx]);
    expect(missing).toEqual([]);
  });

  // §5.5 (D16). HelpPanel used to keep a private copy without 'disconnected'.
  test('titles come from STRINGS.contextLabels', () => {
    const { getByText } = render(<HelpPanel context="disconnected" bindings={[]} />);
    expect(getByText(`Help — ${STRINGS.contextLabels.disconnected}`)).toBeTruthy();
  });
});
