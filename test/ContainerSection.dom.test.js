/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render } from '@testing-library/react';
import { STRINGS } from '../src/helpers/strings.js';

const row = (id, name) => ({
  id,
  name,
  image: 'nginx:latest',
  state: 'exited',
  ports: [],
});

async function renderSection(props) {
  const { default: ContainerSection } = await import(
    '../src/components/ContainerSection.jsx'
  );
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
});
