/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render } from '@testing-library/react';
import { getHints, ControlsHUD } from '../src/components/ControlsHUD.jsx';

describe('getHints — pure function', () => {
  test('step=0, no suggestions, not searching: includes Tab=Search Hub', () => {
    const hints = getHints(0, false, false);
    const keys = hints.map(h => h.key);
    expect(keys).toContain('Tab');
    const tabHint = hints.find(h => h.key === 'Tab');
    expect(tabHint.label).toBe('Search Hub');
  });

  test('step=0, hasSuggestions=true: includes ↑↓ Navigate, does NOT include Tab', () => {
    const hints = getHints(0, true, false);
    const keys = hints.map(h => h.key);
    expect(keys).toContain('↑↓');
    expect(keys).not.toContain('Tab');
    const navHint = hints.find(h => h.key === '↑↓');
    expect(navHint.label).toBe('Navigate');
  });

  test('step=0, isSearchingHub=true: does NOT include Tab, includes Enter and Esc', () => {
    const hints = getHints(0, false, true);
    const keys = hints.map(h => h.key);
    expect(keys).not.toContain('Tab');
    expect(keys).toContain('Enter');
    expect(keys).toContain('Esc');
  });

  test('step=1: includes Enter=Continue and Esc=Cancel, no Tab, no ↑↓', () => {
    const hints = getHints(1, false, false);
    const keys = hints.map(h => h.key);
    expect(keys).toContain('Enter');
    expect(keys).toContain('Esc');
    expect(keys).not.toContain('Tab');
    expect(keys).not.toContain('↑↓');
    const enterHint = hints.find(h => h.key === 'Enter');
    expect(enterHint.label).toBe('Continue');
  });

  test('step=2: same as step=1', () => {
    const hints = getHints(2, false, false);
    const keys = hints.map(h => h.key);
    expect(keys).toContain('Enter');
    expect(keys).toContain('Esc');
    expect(keys).not.toContain('Tab');
    expect(keys).not.toContain('↑↓');
  });

  test('step=3: same as step=1', () => {
    const hints = getHints(3, false, false);
    const keys = hints.map(h => h.key);
    expect(keys).toContain('Enter');
    expect(keys).toContain('Esc');
    expect(keys).not.toContain('Tab');
    expect(keys).not.toContain('↑↓');
  });

  test('getHints(3, false, false, true) includes Tab=Insert next env', () => {
    const hints = getHints(3, false, false, true);
    const keys = hints.map(h => h.key);
    expect(keys).toContain('Tab');
    const tabHint = hints.find(h => h.key === 'Tab');
    expect(tabHint.label).toBe('Insert next env');
  });

  test('getHints(3, false, false, false) does NOT include Tab hint', () => {
    const hints = getHints(3, false, false, false);
    const keys = hints.map(h => h.key);
    expect(keys).not.toContain('Tab');
  });

  test('getHints(3, false, false, true) also includes Enter and Esc', () => {
    const hints = getHints(3, false, false, true);
    const keys = hints.map(h => h.key);
    expect(keys).toContain('Enter');
    expect(keys).toContain('Esc');
  });
});

describe('ControlsHUD — component rendering', () => {
  test('step=0, no suggestions: renders [Tab] and "Search Hub" text', () => {
    const { getByText } = render(
      <ControlsHUD step={0} hasSuggestions={false} isSearchingHub={false} />
    );
    expect(getByText('[Tab]')).toBeTruthy();
    expect(getByText(/Search Hub/)).toBeTruthy();
  });

  test('step=0, hasSuggestions=true: renders [↑↓], does NOT render [Tab]', () => {
    const { getByText, queryByText } = render(
      <ControlsHUD step={0} hasSuggestions={true} isSearchingHub={false} />
    );
    expect(getByText('[↑↓]')).toBeTruthy();
    expect(queryByText('[Tab]')).toBeNull();
  });

  test('step=1: renders [Enter] and [Esc], does NOT render [Tab]', () => {
    const { getByText, queryByText } = render(
      <ControlsHUD step={1} hasSuggestions={false} isSearchingHub={false} />
    );
    expect(getByText('[Enter]')).toBeTruthy();
    expect(getByText('[Esc]')).toBeTruthy();
    expect(queryByText('[Tab]')).toBeNull();
  });

  test('step=3, hasSuggestedEnv=true: renders [Tab] and "Insert next env"', () => {
    const { getByText } = render(
      <ControlsHUD step={3} hasSuggestions={false} isSearchingHub={false} hasSuggestedEnv={true} />
    );
    expect(getByText('[Tab]')).toBeTruthy();
    expect(getByText(/Insert next env/)).toBeTruthy();
  });

  test('step=3, hasSuggestedEnv=false: does NOT render [Tab]', () => {
    const { queryByText } = render(
      <ControlsHUD step={3} hasSuggestions={false} isSearchingHub={false} hasSuggestedEnv={false} />
    );
    expect(queryByText('[Tab]')).toBeNull();
  });
});
