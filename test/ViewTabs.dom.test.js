/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render } from '@testing-library/react';
import { ViewTabs } from '../src/components/ViewTabs.jsx';
import { STRINGS } from '../src/helpers/strings.js';

const views = [
  {
    id: 'containers',
    title: STRINGS.views.containers,
    enabled: true,
    shortcut: 1,
  },
  {
    id: 'projects',
    title: STRINGS.views.projects,
    enabled: false,
    shortcut: 2,
  },
  {
    id: 'images',
    title: STRINGS.views.images,
    enabled: false,
    shortcut: 3,
  },
];

describe('ViewTabs', () => {
  test('shows the three tabs with their numeric shortcut', () => {
    const { getByText } = render(
      <ViewTabs views={views} active="containers" />
    );
    expect(getByText('1 Containers')).toBeTruthy();
    expect(getByText('2 Projects')).toBeTruthy();
    expect(getByText('3 Images')).toBeTruthy();
  });

  test('keeps all tabs present when another view is active', () => {
    const { getByText } = render(
      <ViewTabs views={views} active="projects" />
    );
    expect(getByText('1 Containers')).toBeTruthy();
    expect(getByText('2 Projects')).toBeTruthy();
    expect(getByText('3 Images')).toBeTruthy();
  });

  test('highlights only the active tab', () => {
    const { getByText } = render(
      <ViewTabs views={views} active="projects" />
    );
    expect(getByText('2 Projects').getAttribute('data-inverse')).toBe('true');
    expect(getByText('1 Containers').getAttribute('data-inverse')).toBeNull();
    expect(getByText('3 Images').getAttribute('data-inverse')).toBeNull();
  });

  test('dims disabled tabs and leaves the enabled one normal', () => {
    const { getByText } = render(
      <ViewTabs views={views} active="containers" />
    );
    expect(getByText('2 Projects').getAttribute('data-dim')).toBe('true');
    expect(getByText('3 Images').getAttribute('data-dim')).toBe('true');
    expect(getByText('1 Containers').getAttribute('data-dim')).toBeNull();
  });
});
