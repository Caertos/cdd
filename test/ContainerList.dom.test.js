/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render } from '@testing-library/react';
import ContainerList from '../src/components/ContainerList.jsx';

const row = (id, name, state = 'exited') => ({
  id,
  name,
  image: 'nginx:latest',
  state,
  ports: [],
});

describe('ContainerList', () => {
  test('marks the row at the selected index with the marker', () => {
    const { container } = render(
      <ContainerList
        containers={[row('id-1', 'web-1'), row('id-2', 'web-2')]}
        selected={1}
      />
    );

    const markers = [...container.querySelectorAll('span')].filter(
      (s) => s.textContent === '➤'
    );
    expect(markers).toHaveLength(1);

    // The marker lives in the same row box as the selected container name.
    const selectedRow = markers[0].closest('div').parentElement;
    expect(selectedRow.textContent).toContain('web-2');
    expect(selectedRow.textContent).not.toContain('web-1');
  });

  test('renders one row per container (keyed by container.id)', () => {
    // React keys are not observable in the DOM; unique ids must simply render
    // every row without warnings or omissions.
    const { container } = render(
      <ContainerList
        containers={[row('id-1', 'web-1'), row('id-2', 'web-2')]}
        selected={0}
      />
    );
    expect(container.textContent).toContain('web-1');
    expect(container.textContent).toContain('web-2');
  });

  test('empty list renders nothing', () => {
    const { container } = render(<ContainerList containers={[]} />);
    expect(container.textContent).toBe('');
  });

  test('isStale is propagated to every row', () => {
    const { getByText } = render(
      <ContainerList
        containers={[row('id-1', 'web-1')]}
        selected={0}
        isStale
      />
    );
    expect(getByText('web-1').getAttribute('data-dim')).toBe('gray');
  });
});
