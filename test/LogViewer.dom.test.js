/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render } from '@testing-library/react';
import LogViewer from '../src/components/LogViewer.jsx';

const lines = (count) =>
  Array.from({ length: count }, (_, i) => `line-${i}`);

describe('LogViewer', () => {
  test('titles with the container name', () => {
    const { getByText } = render(
      <LogViewer logs={['a']} container={{ name: 'web' }} />
    );
    expect(getByText('web logs, press ESC to exit')).toBeTruthy();
  });

  test('falls back to "Container" without metadata', () => {
    const { getByText } = render(<LogViewer logs={['a']} />);
    expect(getByText('Container logs, press ESC to exit')).toBeTruthy();
  });

  test('renders only the last 15 lines', () => {
    const { container } = render(<LogViewer logs={lines(20)} />);
    expect(container.textContent).toContain('line-19');
    expect(container.textContent).toContain('line-5');
    expect(container.textContent).not.toContain('line-4');
  });

  test('renders all lines when there are 15 or fewer', () => {
    const { container } = render(<LogViewer logs={lines(15)} />);
    expect(container.textContent).toContain('line-0');
    expect(container.textContent).toContain('line-14');
  });

  test('empty logs → dimmed placeholder', () => {
    const { getByText, container } = render(<LogViewer logs={[]} />);
    const placeholder = getByText('No logs...');
    expect(placeholder.getAttribute('data-dim')).toBe('true');
    expect(container.textContent).not.toContain('line-');
  });
});
