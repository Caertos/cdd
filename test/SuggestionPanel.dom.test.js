/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render } from '@testing-library/react';
import { SuggestionPanel } from '../src/components/SuggestionPanel.jsx';

describe('SuggestionPanel', () => {
  const items = ['caddy', 'elasticsearch', 'golang', 'httpd', 'kafka', 'mariadb', 'memcached', 'minio'];

  test('renders nothing when items is empty', () => {
    const { container } = render(
      <SuggestionPanel items={[]} selectedIndex={-1} visibleOffset={0} maxVisible={5} />
    );
    expect(container.firstChild).toBeNull();
  });

  test('renders only maxVisible items from visibleOffset', () => {
    const { getByText, queryByText } = render(
      <SuggestionPanel items={items} selectedIndex={-1} visibleOffset={0} maxVisible={5} />
    );
    expect(getByText(/caddy/)).toBeTruthy();
    expect(getByText(/elasticsearch/)).toBeTruthy();
    expect(getByText(/kafka/)).toBeTruthy();
    expect(queryByText(/mariadb/)).toBeNull();
  });

  test('respects visibleOffset by skipping early items', () => {
    const { queryByText, getByText } = render(
      <SuggestionPanel items={items} selectedIndex={-1} visibleOffset={2} maxVisible={3} />
    );
    expect(getByText(/golang/)).toBeTruthy();
    expect(getByText(/httpd/)).toBeTruthy();
    expect(getByText(/kafka/)).toBeTruthy();
    expect(queryByText(/caddy/)).toBeNull();
  });

  test('focused row has › prefix marker', () => {
    const { getByText } = render(
      <SuggestionPanel items={items} selectedIndex={1} visibleOffset={0} maxVisible={5} />
    );
    const el = getByText(/› elasticsearch/);
    expect(el).toBeTruthy();
  });

  test('non-focused rows do NOT have › prefix', () => {
    const { getByText } = render(
      <SuggestionPanel items={items} selectedIndex={1} visibleOffset={0} maxVisible={5} />
    );
    const el = getByText(/caddy/);
    expect(el.textContent).not.toMatch(/›/);
  });
});
