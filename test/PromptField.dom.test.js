/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render } from '@testing-library/react';
import { PromptField, PromptMessage } from '../src/components/PromptField.jsx';

describe('PromptField', () => {
  test('shows the label and the value', () => {
    const { container } = render(<PromptField label="Name" value="web-1" />);
    expect(container.textContent).toContain('Name');
    expect(container.textContent).toContain('web-1');
  });

  test('cursor defaults to the end of the value (block cursor after text)', () => {
    const { container } = render(<PromptField label="Name" value="abc" />);
    expect(container.textContent).toBe('Nameabc ');
  });

  test('explicit cursor inverts the character at that position', () => {
    const { container } = render(
      <PromptField label="Name" value="abc" cursor={1} />
    );
    expect(container.textContent).toBe('Nameabc');
  });

  test('required and empty → red field', () => {
    const { container } = render(
      <PromptField label="Image" value="" required />
    );
    const spans = [...container.querySelectorAll('span')];
    expect(spans.some((s) => s.getAttribute('data-color') === 'red')).toBe(
      true
    );
  });

  test('maskRanges replace characters with dots', () => {
    const { container } = render(
      <PromptField
        label="Token"
        value="secret123"
        maskRanges={[{ start: 0, end: 6 }]}
      />
    );
    expect(container.textContent).toContain('••••••123');
    expect(container.textContent).not.toContain('secret');
  });
});

describe('PromptMessage', () => {
  test('renders null without a message', () => {
    const { container } = render(<PromptMessage />);
    expect(container.textContent).toBe('');
  });

  test('defaults to yellow', () => {
    const { getByText } = render(<PromptMessage message="Careful" />);
    expect(getByText('Careful').getAttribute('data-color')).toBe('yellow');
  });

  test('uses the provided color', () => {
    const { getByText } = render(
      <PromptMessage message="Failed" color="red" />
    );
    expect(getByText('Failed').getAttribute('data-color')).toBe('red');
  });
});
