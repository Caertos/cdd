/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render } from '@testing-library/react';
import { ProjectsView } from '../src/views/ProjectsView.jsx';
import { ImagesView } from '../src/views/ImagesView.jsx';
import { STRINGS } from '../src/helpers/strings.js';

describe('view placeholders', () => {
  test('ProjectsView shows its honest placeholder', () => {
    expect(typeof STRINGS.views.projectsPlaceholder).toBe('string');
    expect(STRINGS.views.projectsPlaceholder.length).toBeGreaterThan(0);
    const { getByText } = render(<ProjectsView />);
    expect(getByText(STRINGS.views.projectsPlaceholder)).toBeTruthy();
  });

  test('ImagesView shows its honest placeholder', () => {
    expect(typeof STRINGS.views.imagesPlaceholder).toBe('string');
    expect(STRINGS.views.imagesPlaceholder.length).toBeGreaterThan(0);
    const { getByText } = render(<ImagesView />);
    expect(getByText(STRINGS.views.imagesPlaceholder)).toBeTruthy();
  });
});
