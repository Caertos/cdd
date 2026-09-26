/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render } from '@testing-library/react';
import UsageMenu from '../src/components/UsageMenu.jsx';

const SHORTCUTS = [
  'Use ↑/↓ for navigation',
  'I to initiate selected container',
  'P to stop selected container',
  'R to restart selected container',
  'C to create a container',
  'L to view logs of selected container',
  'S to open shell in selected container',
  'D to toggle debug log panel',
  'E to remove selected container',
  'Q to quit',
];

describe('UsageMenu', () => {
  test('lists every documented shortcut', () => {
    const { container } = render(<UsageMenu />);
    for (const shortcut of SHORTCUTS) {
      expect(container.textContent).toContain(shortcut);
    }
  });

  test('lays the shortcuts out in three columns', () => {
    const { container } = render(<UsageMenu />);
    // container > root box > row box > column boxes
    const columns = container.children[0].children[0].children;
    expect(columns).toHaveLength(3);
    const total = [...columns].reduce(
      (sum, col) => sum + col.children.length,
      0
    );
    expect(total).toBe(SHORTCUTS.length);
  });
});
