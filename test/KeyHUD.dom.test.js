/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render } from '@testing-library/react';
import { getBindings } from '../src/helpers/keymap.js';
import { KeyHUD } from '../src/components/KeyHUD.jsx';

describe('KeyHUD — component rendering', () => {
  test('renders nothing when bindings is empty', () => {
    const { container } = render(<KeyHUD bindings={[]} />);
    expect(container.textContent).toBe('');
  });

  test('renders nothing when bindings is null', () => {
    const { container } = render(<KeyHUD bindings={null} />);
    expect(container.textContent).toBe('');
  });

  test('renders key labels from bindings', () => {
    const bindings = [
      { id: 'test1', keys: ['i'], label: 'Start', priority: 90 },
      { id: 'test2', keys: ['p'], label: 'Stop', priority: 85 },
    ];
    const { getByText } = render(<KeyHUD bindings={bindings} />);
    expect(getByText('[i]')).toBeTruthy();
    expect(getByText('Start')).toBeTruthy();
    expect(getByText('[p]')).toBeTruthy();
    expect(getByText('Stop')).toBeTruthy();
  });

  test('shows friendly key names instead of raw ones', () => {
    const bindings = [
      { id: 'a', keys: ['escape', '?'], label: 'Close', priority: 90 },
      { id: 'b', keys: ['up'], label: '↑', priority: 80 },
    ];
    const { getByText } = render(<KeyHUD bindings={bindings} />);
    expect(getByText('[Esc]')).toBeTruthy();
    expect(getByText('[↑]')).toBeTruthy();
  });

  test('the cleanup question reads [y] Yes  [n] No', () => {
    const bindings = getBindings('list', { confirmCleanup: true }).filter(
      (b) => b.id.startsWith('cleanup.')
    );
    const { container } = render(<KeyHUD bindings={bindings} />);
    expect(container.textContent).toMatch(/\[y\]\s+Yes\s*\[n\]\s+No/);
  });

  test('truncates and shows "? more" when maxWidth is exceeded', () => {
    const bindings = [
      { id: 'test1', keys: ['i'], label: 'Start', priority: 90 },
      { id: 'test2', keys: ['p'], label: 'Stop', priority: 85 },
      { id: 'test3', keys: ['r'], label: 'Restart', priority: 80 },
    ];
    const { getByText, queryByText } = render(
      <KeyHUD bindings={bindings} maxWidth={20} />
    );
    expect(getByText('[i]')).toBeTruthy();
    expect(getByText('? more')).toBeTruthy();
    // Third item should be truncated
    expect(queryByText('[r]')).toBeNull();
  });

  test('renders all keys when maxWidth is large enough', () => {
    const bindings = [
      { id: 'test1', keys: ['i'], label: 'Start', priority: 90 },
      { id: 'test2', keys: ['p'], label: 'Stop', priority: 85 },
    ];
    const { getByText, queryByText } = render(
      <KeyHUD bindings={bindings} maxWidth={200} />
    );
    expect(getByText('[i]')).toBeTruthy();
    expect(getByText('[p]')).toBeTruthy();
    expect(queryByText('? more')).toBeNull();
  });
});
