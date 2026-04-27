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

  // FR8 — hubResults wiring
  test('when hubResults is provided, activeItems = hubResults (replaces suggestions)', () => {
    const { getByText, queryByText } = render(
      <ContainerCreationPrompt
        step={0}
        imageName="ng"
        containerName=""
        portInput=""
        envInput=""
        message=""
        messageColor="yellow"
        suggestions={['nginx', 'golang']}
        hubResults={['hub-nginx', 'hub-node']}
        selectedSuggestionIndex={-1}
        visibleOffset={0}
      />
    );
    expect(getByText(/hub-nginx/)).toBeTruthy();
    expect(queryByText(/golang/)).toBeNull();
  });

  test('when hubResults is null, falls back to suggestions', () => {
    const { getByText } = render(
      <ContainerCreationPrompt
        step={0}
        imageName="ng"
        containerName=""
        portInput=""
        envInput=""
        message=""
        messageColor="yellow"
        suggestions={['nginx', 'golang']}
        hubResults={null}
        selectedSuggestionIndex={-1}
        visibleOffset={0}
      />
    );
    expect(getByText(/golang/)).toBeTruthy();
  });

  test('when step===0 and isSearchingHub=true, SuggestionPanel is shown even if activeItems is empty', () => {
    const { getByText } = render(
      <ContainerCreationPrompt
        step={0}
        imageName="ng"
        containerName=""
        portInput=""
        envInput=""
        message=""
        messageColor="yellow"
        suggestions={[]}
        hubResults={null}
        isSearchingHub={true}
        selectedSuggestionIndex={-1}
        visibleOffset={0}
      />
    );
    expect(getByText(/searching Docker Hub/)).toBeTruthy();
  });

  test('when step===0 and isSearchingHub=false and activeItems is empty, SuggestionPanel is NOT shown', () => {
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
        hubResults={null}
        isSearchingHub={false}
        selectedSuggestionIndex={-1}
        visibleOffset={0}
      />
    );
    expect(queryByTestId('suggestion-panel')).toBeNull();
  });

  test('isLoading prop is passed down to SuggestionPanel when isSearchingHub=true', () => {
    const { getByText } = render(
      <ContainerCreationPrompt
        step={0}
        imageName="ng"
        containerName=""
        portInput=""
        envInput=""
        message=""
        messageColor="yellow"
        suggestions={['nginx']}
        hubResults={null}
        isSearchingHub={true}
        selectedSuggestionIndex={-1}
        visibleOffset={0}
      />
    );
    expect(getByText(/searching Docker Hub/)).toBeTruthy();
  });
});

describe('ContainerCreationPrompt — ControlsHUD wiring', () => {
  test('step=0, no suggestions: renders ControlsHUD with [Tab] and Search Hub', () => {
    const { getByText } = render(
      <ContainerCreationPrompt
        step={0}
        imageName=""
        containerName=""
        portInput=""
        envInput=""
        message=""
        messageColor="yellow"
        suggestions={[]}
        hubResults={null}
        isSearchingHub={false}
        selectedSuggestionIndex={-1}
        visibleOffset={0}
      />
    );
    expect(getByText('[Tab]')).toBeTruthy();
    expect(getByText(/Search Hub/)).toBeTruthy();
  });

  test('does NOT render old static text "Press Enter to continue, Escape to cancel"', () => {
    const { queryByText } = render(
      <ContainerCreationPrompt
        step={0}
        imageName=""
        containerName=""
        portInput=""
        envInput=""
        message=""
        messageColor="yellow"
        suggestions={[]}
        hubResults={null}
        isSearchingHub={false}
        selectedSuggestionIndex={-1}
        visibleOffset={0}
      />
    );
    expect(queryByText(/Press Enter to continue, Escape to cancel/)).toBeNull();
  });

  test('step=0, hasSuggestions=true: renders [↑↓] not [Tab]', () => {
    const { getByText, queryByText } = render(
      <ContainerCreationPrompt
        step={0}
        imageName="ng"
        containerName=""
        portInput=""
        envInput=""
        message=""
        messageColor="yellow"
        suggestions={['nginx', 'golang']}
        hubResults={null}
        isSearchingHub={false}
        selectedSuggestionIndex={-1}
        visibleOffset={0}
      />
    );
    expect(getByText('[↑↓]')).toBeTruthy();
    expect(queryByText('[Tab]')).toBeNull();
  });

  test('step=0, isSearchingHub=true, no suggestions: ControlsHUD does NOT render [Tab] or Navigate, DOES render [Enter] and [Esc]', () => {
    const { queryByText, getByText } = render(
      <ContainerCreationPrompt
        step={0}
        imageName="ng"
        containerName=""
        portInput=""
        envInput=""
        message=""
        messageColor="yellow"
        suggestions={[]}
        hubResults={null}
        isSearchingHub={true}
        selectedSuggestionIndex={-1}
        visibleOffset={0}
      />
    );
    expect(queryByText('[Tab]')).toBeNull();
    expect(queryByText(/Navigate/)).toBeNull();
    expect(getByText('[Enter]')).toBeTruthy();
    expect(getByText('[Esc]')).toBeTruthy();
  });

  test('step=1: renders [Enter] and [Esc]', () => {
    const { getByText } = render(
      <ContainerCreationPrompt
        step={1}
        imageName="nginx"
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
    expect(getByText('[Enter]')).toBeTruthy();
    expect(getByText('[Esc]')).toBeTruthy();
  });
});
