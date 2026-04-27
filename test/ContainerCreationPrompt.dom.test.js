/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render } from '@testing-library/react';
import { ContainerCreationPrompt } from '../src/components/ContainerCreationPrompt.jsx';

describe('ContainerCreationPrompt — SuggestionPanel wiring', () => {
  test('does NOT render SuggestionPanel when step > 0', () => {
    const { queryByText } = render(
      <ContainerCreationPrompt
        step={1}
        imageName="nginx"
        containerName=""
        portInput=""
        envInput=""
        message=""
        messageColor="yellow"
        suggestions={['nginx', 'node']}
        selectedSuggestionIndex={-1}
        visibleOffset={0}
      />
    );
    // On step 1, the imageName field is not active — no suggestion panel
    expect(queryByText(/^nginx$/)).toBeNull();
  });

  test('does NOT render SuggestionPanel on step 0 when suggestions is empty', () => {
    const { queryByTestId } = render(
      <ContainerCreationPrompt
        step={0}
        imageName="ng"
        containerName=""
        portInput=""
        envInput=""
        message=""
        messageColor="yellow"
        suggestions={[]}
        selectedSuggestionIndex={-1}
        visibleOffset={0}
      />
    );
    // No suggestion panel should render when suggestions array is empty
    expect(queryByTestId('suggestion-panel')).toBeNull();
  });

  test('renders SuggestionPanel items on step 0 when suggestions exist', () => {
    const { getAllByText, getByText } = render(
      <ContainerCreationPrompt
        step={0}
        imageName="ng"
        containerName=""
        portInput=""
        envInput=""
        message=""
        messageColor="yellow"
        suggestions={['nginx', 'golang']}
        selectedSuggestionIndex={-1}
        visibleOffset={0}
      />
    );
    // golang is not in any label — appears only in suggestion panel
    expect(getByText(/golang/)).toBeTruthy();
    // nginx appears in suggestion panel (may also appear in label text, but it does appear)
    const nginxEls = getAllByText(/nginx/);
    expect(nginxEls.length).toBeGreaterThan(0);
  });
});
