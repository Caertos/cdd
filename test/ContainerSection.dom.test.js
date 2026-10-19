/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render } from '@testing-library/react';
import { STRINGS } from '../src/helpers/strings.js';
import {
  LEGIT,
  expectNoControlBytes,
  hostile,
  nodeWithText,
  sanitised,
} from './support/terminalControls.js';

const row = (id, name) => ({
  id,
  name,
  image: 'nginx:latest',
  state: 'exited',
  ports: [],
});

async function renderSection(props) {
  const { default: ContainerSection } =
    await import('../src/components/ContainerSection.jsx');
  return render(<ContainerSection {...props} />);
}

describe('ContainerSection', () => {
  test('empty + connection ok → EmptyState', async () => {
    const { getByText } = await renderSection({
      containers: [],
      connectionStatus: 'ok',
      onCreate: () => {},
    });
    expect(getByText(STRINGS.emptyTitle)).toBeTruthy();
  });

  test('empty + connecting → noContainers message', async () => {
    const { getByText, queryByText } = await renderSection({
      containers: [],
      connectionStatus: 'connecting',
      onCreate: () => {},
    });
    expect(getByText(STRINGS.noContainers)).toBeTruthy();
    expect(queryByText(STRINGS.emptyTitle)).toBeNull();
  });

  test('empty + error → noContainers message (not EmptyState)', async () => {
    const { getByText } = await renderSection({
      containers: [],
      connectionStatus: 'error',
      onCreate: () => {},
    });
    expect(getByText(STRINGS.noContainers)).toBeTruthy();
  });

  test('delegates to ContainerList when there are items', async () => {
    const { getByText, queryByText } = await renderSection({
      containers: [row('id-1', 'web-1'), row('id-2', 'web-2')],
      connectionStatus: 'ok',
      selected: 0,
    });
    expect(getByText('web-1')).toBeTruthy();
    expect(getByText('web-2')).toBeTruthy();
    expect(queryByText(STRINGS.emptyTitle)).toBeNull();
    expect(queryByText(STRINGS.noContainers)).toBeNull();
  });

  test('a filter with no matches gets its own state, not EmptyState', async () => {
    const { getByText, queryByText } = await renderSection({
      containers: [],
      connectionStatus: 'ok',
      query: 'pg',
      totalCount: 25,
      onCreate: () => {},
    });
    expect(getByText(STRINGS.filter.noMatch(25, 'pg'))).toBeTruthy();
    expect(getByText(STRINGS.filter.noMatchHint)).toBeTruthy();
    // The containers are there; only the create button must not be offered.
    expect(queryByText(STRINGS.emptyTitle)).toBeNull();
  });

  test('no containers and no query still shows EmptyState', async () => {
    const { getByText } = await renderSection({
      containers: [],
      connectionStatus: 'ok',
      query: '',
      totalCount: 0,
      onCreate: () => {},
    });
    expect(getByText(STRINGS.emptyTitle)).toBeTruthy();
  });
});

// The no-match message quotes the query back to the user, and the query can
// be a paste. A terminal executes part of what it is given, so the message
// has to reach the screen without the control bytes of the query.
describe('ContainerSection — the filter query reaches the screen sanitised', () => {
  test('the no-match message leaves no control byte in the DOM', async () => {
    const { container } = await renderSection({
      containers: [],
      connectionStatus: 'ok',
      query: hostile('query'),
      totalCount: 25,
      onCreate: () => {},
    });
    const message = nodeWithText(container, sanitised('query'));
    expect(message).toBeTruthy();
    expectNoControlBytes(message.textContent);
  });

  test('the words of the query survive', async () => {
    const { container } = await renderSection({
      containers: [],
      connectionStatus: 'ok',
      query: hostile('query'),
      totalCount: 25,
      onCreate: () => {},
    });
    const message = nodeWithText(container, sanitised('query'));
    expect(message.textContent).toContain(sanitised('query'));
  });

  test('the url of the hyperlink does not stay on screen', async () => {
    const { container } = await renderSection({
      containers: [],
      connectionStatus: 'ok',
      query: hostile('query'),
      totalCount: 25,
      onCreate: () => {},
    });
    expect(container.textContent).not.toContain('evil.example');
  });

  test('legitimate text is not mangled', async () => {
    const { container } = await renderSection({
      containers: [],
      connectionStatus: 'ok',
      query: LEGIT,
      totalCount: 25,
      onCreate: () => {},
    });
    const message = nodeWithText(container, LEGIT);
    expect(message).toBeTruthy();
    expect(message.textContent).toContain(LEGIT);
    expectNoControlBytes(message.textContent);
  });
});
