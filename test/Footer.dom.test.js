/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render } from '@testing-library/react';
import Footer from '../src/components/Footer.jsx';

describe('Footer', () => {
  test('renders the credit without throwing', () => {
    const { getByText } = render(<Footer />);
    expect(getByText('Crafted by Carlos Cochero 2025')).toBeTruthy();
  });
});
