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

  // FR8 — isLoading prop
  test('renders [searching Docker Hub...] row when isLoading=true', () => {
    const { getByText } = render(
      <SuggestionPanel items={[]} selectedIndex={-1} visibleOffset={0} isLoading={true} />
    );
    expect(getByText(/searching Docker Hub/)).toBeTruthy();
  });

  test('loading row is NOT selectable — no › prefix on loading row', () => {
    const { getByText } = render(
      <SuggestionPanel items={items} selectedIndex={-1} visibleOffset={0} maxVisible={5} isLoading={true} />
    );
    const loadingEl = getByText(/searching Docker Hub/);
    expect(loadingEl.textContent).not.toMatch(/›/);
  });

  test('does NOT render loading row when isLoading=false', () => {
    const { queryByText } = render(
      <SuggestionPanel items={items} selectedIndex={-1} visibleOffset={0} maxVisible={5} isLoading={false} />
    );
    expect(queryByText(/searching Docker Hub/)).toBeNull();
  });

  test('renders panel even when items is empty but isLoading=true', () => {
    const { getByText } = render(
      <SuggestionPanel items={[]} selectedIndex={-1} visibleOffset={0} isLoading={true} />
    );
    expect(getByText(/searching Docker Hub/)).toBeTruthy();
  });
});
