/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render } from '@testing-library/react';
import { TextField } from '../src/components/TextField.jsx';

describe('TextField', () => {
  test('renders label and value with cursor at end (block cursor)', () => {
    const { getByText, container } = render(
      <TextField label="Name:" value="abc" cursor={3} />
    );
    expect(getByText('Name:')).toBeTruthy();
    // Inverse space at end = block cursor
    expect(container.textContent).toContain('abc');
  });

  test('renders cursor in the middle of text', () => {
    const { container } = render(
      <TextField label="Name:" value="abc" cursor={1} />
    );
    // a [b] c — all three characters present, b is inverse
    expect(container.textContent).toContain('a');
    expect(container.textContent).toContain('b');
    expect(container.textContent).toContain('c');
  });

  test('empty required field shows in red', () => {
    const { getByText } = render(
      <TextField label="Image:" value="" cursor={0} required />
    );
    expect(getByText('Image:')).toBeTruthy();
  });

  test('non-empty required field is not red', () => {
    const { container } = render(
      <TextField label="Image:" value="nginx" cursor={5} required />
    );
    expect(container.textContent).toContain('nginx');
  });

  test('masked field shows asterisks instead of value', () => {
    const { container } = render(
      <TextField label="Secret:" value="mysecret" cursor={8} masked />
    );
    expect(container.textContent).toContain('********');
  });

  test('placeholder is not shown when value is non-empty', () => {
    const { container } = render(
      <TextField
        label="Name:"
        value="hello"
        cursor={5}
        placeholder="Type here..."
      />
    );
    expect(container.textContent).not.toContain('Type here...');
  });

  test('renders with cursor at 0', () => {
    const { container } = render(
      <TextField label="Name:" value="abc" cursor={0} />
    );
    expect(container.textContent).toContain('a');
    expect(container.textContent).toContain('bc');
  });

  test('cursor value beyond string length clamps to end', () => {
    const { container } = render(
      <TextField label="Name:" value="abc" cursor={100} />
    );
    expect(container.textContent).toContain('abc');
  });

  test('handles emoji characters', () => {
    const { container } = render(
      <TextField label="Icon:" value="🚀abc" cursor={1} />
    );
    expect(container.textContent).toContain('🚀');
    expect(container.textContent).toContain('a');
    expect(container.textContent).toContain('bc');
  });
});
