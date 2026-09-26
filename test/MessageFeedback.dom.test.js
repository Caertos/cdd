/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render } from '@testing-library/react';
import MessageFeedback from '../src/components/MessageFeedback.jsx';

describe('MessageFeedback', () => {
  test('renders null without a message', () => {
    const { container } = render(<MessageFeedback />);
    expect(container.textContent).toBe('');
  });

  test('renders null with an empty message', () => {
    const { container } = render(<MessageFeedback message="" />);
    expect(container.textContent).toBe('');
  });

  test('applies the color to the message', () => {
    const { getByText } = render(
      <MessageFeedback message="Saved" color="green" />
    );
    expect(getByText('Saved').getAttribute('data-color')).toBe('green');
  });
});
