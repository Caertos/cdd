/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render } from '@testing-library/react';
import { EmptyState } from '../src/components/EmptyState.jsx';
import { STRINGS } from '../src/helpers/strings.js';

describe('EmptyState', () => {
  test('renders the empty title and hint', () => {
    const { getByText } = render(<EmptyState onCreate={() => {}} />);
    expect(getByText(STRINGS.emptyTitle)).toBeTruthy();
    expect(getByText(STRINGS.emptyHint)).toBeTruthy();
  });

  test('mentions the C key to create', () => {
    const { getByText } = render(<EmptyState onCreate={() => {}} />);
    expect(getByText(/\[C\]/)).toBeTruthy();
  });
});
