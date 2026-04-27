/**
 * @jest-environment jsdom
 */
import React, { useEffect } from 'react';
import { render, act } from '@testing-library/react';
import { IMAGE_PROFILES } from '../src/helpers/constants.js';
import { jest } from '@jest/globals';

// Mock dockerHubService BEFORE any other import that might pull it in
jest.unstable_mockModule('../src/helpers/dockerHubService.js', () => ({
  searchDockerHub: jest.fn(),
  formatHubResult: jest.fn((r) => r.name), // identity-like stub: returns name string
}));

// Dynamic import resolves AFTER jest.unstable_mockModule is registered
const { useContainerCreation } = await import('../src/hooks/creation/useContainerCreation.js');
const { searchDockerHub } = await import('../src/helpers/dockerHubService.js');

function HookTester({ onCreate, onCancel, dbImages, imageProfiles, expose }) {
  const hook = useContainerCreation({ onCreate, onCancel, dbImages, imageProfiles });
  // keep exposing the latest hook values on every render
  useEffect(() => {
    if (expose) expose.current = hook;
  });
  return null;
}

describe('useContainerCreation (DOM render)', () => {
  test('image empty shows error and does not advance', () => {
    const expose = { current: null };
    render(<HookTester onCreate={() => {}} onCancel={() => {}} dbImages={[]} expose={expose} />);

      expect(expose.current.step).toBe(0);

      act(() => {
        expose.current.nextStep();
      });

      expect(expose.current.message).toBe('Image name cannot be empty.');
      expect(expose.current.step).toBe(0);
  });

  test('ports validation: invalid ports shows error', () => {
    const expose = { current: null };
    render(<HookTester onCreate={() => {}} onCancel={() => {}} dbImages={[]} expose={expose} />);

      act(() => {
        expose.current.setImageName('nginx');
      });

      act(() => {
        expose.current.nextStep(); // to name
      });

      act(() => {
        expose.current.nextStep(); // to ports
      });

      expect(expose.current.step).toBe(2);

      act(() => {
        expose.current.setPortInput('notaport');
      });

      act(() => {
        expose.current.nextStep();
      });

      expect(expose.current.message).toBe('Port format must be host:container and both must be numbers (e.g. 8080:80)');
      expect(expose.current.step).toBe(2);
  });

  test('complete flow calls onCreate with data', () => {
    const created = [];
    const onCreate = (data) => created.push(data);
    const expose = { current: null };

    render(<HookTester onCreate={onCreate} onCancel={() => {}} dbImages={[]} expose={expose} />);

      act(() => {
        expose.current.setImageName('redis');
      });

      act(() => {
        expose.current.nextStep(); // to name
      });

      act(() => {
        expose.current.nextStep(); // to ports
      });

      act(() => {
        expose.current.setPortInput('');
      });

      act(() => {
        expose.current.nextStep(); // to env
      });

      act(() => {
        expose.current.setEnvInput('FOO=bar');
      });

      act(() => {
        expose.current.nextStep(); // final create
      });

      expect(created.length).toBe(1);
      expect(created[0]).toEqual({ imageName: 'redis', containerName: '', portInput: '', envInput: 'FOO=bar' });
  });

  test('step 3 with mysql image: missing MYSQL_ROOT_PASSWORD blocks creation', () => {
    const created = [];
    const expose = { current: null };

    render(<HookTester onCreate={(d) => created.push(d)} onCancel={() => {}} dbImages={[]} imageProfiles={IMAGE_PROFILES} expose={expose} />);

    // advance to step 3 (env) with mysql image
    act(() => { expose.current.setImageName('mysql:8'); });
    act(() => { expose.current.nextStep(); }); // step 0 → 1
    act(() => { expose.current.nextStep(); }); // step 1 → 2
    act(() => { expose.current.nextStep(); }); // step 2 → 3

    expect(expose.current.step).toBe(3);

    // try to advance without required env var
    act(() => { expose.current.nextStep(); });

    expect(expose.current.step).toBe(3); // still blocked
    expect(expose.current.message).toMatch(/MYSQL_ROOT_PASSWORD/i);
    expect(created.length).toBe(0);
  });

  test('step 3 with mysql image: valid env advances and calls onCreate', () => {
    const created = [];
    const expose = { current: null };

    render(<HookTester onCreate={(d) => created.push(d)} onCancel={() => {}} dbImages={[]} imageProfiles={IMAGE_PROFILES} expose={expose} />);

    act(() => { expose.current.setImageName('mysql:8'); });
    act(() => { expose.current.nextStep(); });
    act(() => { expose.current.nextStep(); });
    act(() => { expose.current.nextStep(); }); // at step 3

    act(() => { expose.current.setEnvInput('MYSQL_ROOT_PASSWORD=secret'); });
    act(() => { expose.current.nextStep(); }); // should call onCreate

    expect(created.length).toBe(1);
    expect(created[0].imageName).toBe('mysql:8');
  });
});

describe('useContainerCreation — suggestions & updateImageInput()', () => {
  test('hook exposes suggestions, selectedSuggestionIndex, visibleOffset', () => {
    const expose = { current: null };
    render(<HookTester onCreate={() => {}} onCancel={() => {}} dbImages={[]} imageProfiles={IMAGE_PROFILES} expose={expose} />);
    expect(Array.isArray(expose.current.suggestions)).toBe(true);
    expect(typeof expose.current.selectedSuggestionIndex).toBe('number');
    expect(typeof expose.current.visibleOffset).toBe('number');
  });

  test('updateImageInput() with "ng" filters IMAGE_PROFILES keys containing "ng"', () => {
    const expose = { current: null };
    render(<HookTester onCreate={() => {}} onCancel={() => {}} dbImages={[]} imageProfiles={IMAGE_PROFILES} expose={expose} />);

    act(() => { expose.current.updateImageInput('ng'); });

    expect(expose.current.imageName).toBe('ng');
    expect(expose.current.suggestions).toContain('nginx');
  });

  test('updateImageInput() with empty string clears suggestions', () => {
    const expose = { current: null };
    render(<HookTester onCreate={() => {}} onCancel={() => {}} dbImages={[]} imageProfiles={IMAGE_PROFILES} expose={expose} />);

    act(() => { expose.current.updateImageInput('ng'); });
    act(() => { expose.current.updateImageInput(''); });

    expect(expose.current.suggestions).toHaveLength(0);
  });

  test('updateImageInput() resets selectedSuggestionIndex to -1', () => {
    const expose = { current: null };
    render(<HookTester onCreate={() => {}} onCancel={() => {}} dbImages={[]} imageProfiles={IMAGE_PROFILES} expose={expose} />);

    act(() => { expose.current.updateImageInput('ng'); });

    expect(expose.current.selectedSuggestionIndex).toBe(-1);
  });

  test('step-3 message includes suggestedEnv hints when profile has them', () => {
    const expose = { current: null };
    render(<HookTester onCreate={() => {}} onCancel={() => {}} dbImages={[]} imageProfiles={IMAGE_PROFILES} expose={expose} />);

    act(() => { expose.current.setImageName('postgres'); });
    act(() => { expose.current.nextStep(); }); // → step 1
    act(() => { expose.current.nextStep(); }); // → step 2
    act(() => { expose.current.nextStep(); }); // → step 3

    expect(expose.current.message).toMatch(/POSTGRES_PASSWORD/i);
    expect(expose.current.message).toMatch(/POSTGRES_USER/i);
  });
});

describe('useContainerCreation — moveSuggestionSelection() & applyFocusedSuggestion()', () => {
  test('moveSuggestionSelection(1) increases selectedSuggestionIndex', () => {
    const expose = { current: null };
    render(<HookTester onCreate={() => {}} onCancel={() => {}} dbImages={[]} imageProfiles={IMAGE_PROFILES} expose={expose} />);

    act(() => { expose.current.updateImageInput('m'); });
    // There should be several suggestions with "m"
    act(() => { expose.current.moveSuggestionSelection(1); });

    expect(expose.current.selectedSuggestionIndex).toBe(0);
  });

  test('moveSuggestionSelection() clamps at last item', () => {
    const expose = { current: null };
    render(<HookTester onCreate={() => {}} onCancel={() => {}} dbImages={[]} imageProfiles={IMAGE_PROFILES} expose={expose} />);

    act(() => { expose.current.updateImageInput('m'); });
    const count = expose.current.suggestions.length;

    // Move past end
    for (let i = 0; i <= count + 2; i++) {
      act(() => { expose.current.moveSuggestionSelection(1); });
    }

    expect(expose.current.selectedSuggestionIndex).toBe(count - 1);
  });

  test('moveSuggestionSelection(-1) clamps at -1 (no selection)', () => {
    const expose = { current: null };
    render(<HookTester onCreate={() => {}} onCancel={() => {}} dbImages={[]} imageProfiles={IMAGE_PROFILES} expose={expose} />);

    act(() => { expose.current.updateImageInput('m'); });
    act(() => { expose.current.moveSuggestionSelection(-1); });

    expect(expose.current.selectedSuggestionIndex).toBe(-1);
  });

  test('applyFocusedSuggestion() fills imageName with focused suggestion', () => {
    const expose = { current: null };
    render(<HookTester onCreate={() => {}} onCancel={() => {}} dbImages={[]} imageProfiles={IMAGE_PROFILES} expose={expose} />);

    act(() => { expose.current.updateImageInput('ng'); });
    act(() => { expose.current.moveSuggestionSelection(1); }); // select first
    act(() => { expose.current.applyFocusedSuggestion(); });

    expect(expose.current.imageName).toBe('nginx');
  });

  test('applyFocusedSuggestion() does NOT advance step', () => {
    const expose = { current: null };
    render(<HookTester onCreate={() => {}} onCancel={() => {}} dbImages={[]} imageProfiles={IMAGE_PROFILES} expose={expose} />);

    act(() => { expose.current.updateImageInput('ng'); });
    act(() => { expose.current.moveSuggestionSelection(1); });
    act(() => { expose.current.applyFocusedSuggestion(); });

    expect(expose.current.step).toBe(0);
  });

  test('applyFocusedSuggestion() clears suggestions after applying', () => {
    const expose = { current: null };
    render(<HookTester onCreate={() => {}} onCancel={() => {}} dbImages={[]} imageProfiles={IMAGE_PROFILES} expose={expose} />);

    act(() => { expose.current.updateImageInput('ng'); });
    act(() => { expose.current.moveSuggestionSelection(1); });
    act(() => { expose.current.applyFocusedSuggestion(); });

    expect(expose.current.suggestions).toHaveLength(0);
  });
});

describe('useContainerCreation — triggerHubSearch()', () => {
  beforeEach(() => {
    searchDockerHub.mockReset();
  });

  test('triggerHubSearch is exposed from the hook', () => {
    const expose = { current: null };
    render(<HookTester onCreate={() => {}} onCancel={() => {}} dbImages={[]} imageProfiles={IMAGE_PROFILES} expose={expose} />);

    expect(typeof expose.current.triggerHubSearch).toBe('function');
  });

  test('calling triggerHubSearch() sets isSearchingHub=true while searching, then false after resolve', async () => {
    let resolveSearch;
    searchDockerHub.mockImplementation(
      () => new Promise((resolve) => { resolveSearch = resolve; })
    );

    const expose = { current: null };
    render(<HookTester onCreate={() => {}} onCancel={() => {}} dbImages={[]} imageProfiles={IMAGE_PROFILES} expose={expose} />);

    act(() => { expose.current.updateImageInput('nginx'); });

    // Trigger search (async, don't await yet)
    act(() => { expose.current.triggerHubSearch(); });

    expect(expose.current.isSearchingHub).toBe(true);

    // Resolve the mock search
    const results = [{ name: 'nginx', isOfficial: true, pullCount: 1000, description: 'nginx' }];
    await act(async () => { resolveSearch(results); });

    expect(expose.current.isSearchingHub).toBe(false);
    // hubResults is string[] after formatHubResult mapping (mock returns r.name)
    expect(expose.current.hubResults).toEqual(['nginx']);
  });

  test('after search resolves, hubResults is set and isSearchingHub is false', async () => {
    const results = [{ name: 'nginx', isOfficial: true, pullCount: 500, description: '' }];
    searchDockerHub.mockResolvedValue(results);

    const expose = { current: null };
    render(<HookTester onCreate={() => {}} onCancel={() => {}} dbImages={[]} imageProfiles={IMAGE_PROFILES} expose={expose} />);

    act(() => { expose.current.updateImageInput('nginx'); });

    await act(async () => { await expose.current.triggerHubSearch(); });

    // hubResults is string[] after formatHubResult mapping (mock returns r.name)
    expect(expose.current.hubResults).toEqual(['nginx']);
    expect(expose.current.isSearchingHub).toBe(false);
  });

  test('calling triggerHubSearch() when isSearchingHub===true is a no-op (concurrent guard)', async () => {
    let resolveFirst;
    searchDockerHub.mockImplementation(
      () => new Promise((resolve) => { resolveFirst = resolve; })
    );

    const expose = { current: null };
    render(<HookTester onCreate={() => {}} onCancel={() => {}} dbImages={[]} imageProfiles={IMAGE_PROFILES} expose={expose} />);

    act(() => { expose.current.updateImageInput('nginx'); });
    act(() => { expose.current.triggerHubSearch(); }); // first call

    expect(expose.current.isSearchingHub).toBe(true);
    expect(searchDockerHub).toHaveBeenCalledTimes(1);

    // Second call while still searching should be a no-op
    act(() => { expose.current.triggerHubSearch(); });

    expect(searchDockerHub).toHaveBeenCalledTimes(1); // still only once

    // Cleanup
    await act(async () => { resolveFirst([]); });
  });

  test('calling triggerHubSearch() with empty imageName is a no-op', async () => {
    const expose = { current: null };
    render(<HookTester onCreate={() => {}} onCancel={() => {}} dbImages={[]} imageProfiles={IMAGE_PROFILES} expose={expose} />);

    // imageName is empty by default
    await act(async () => { await expose.current.triggerHubSearch(); });

    expect(searchDockerHub).not.toHaveBeenCalled();
    expect(expose.current.isSearchingHub).toBe(false);
  });

  test('typing into imageName (updateImageInput) aborts ongoing search and clears hubResults', async () => {
    let resolveSearch;
    searchDockerHub.mockImplementation(
      () => new Promise((resolve) => { resolveSearch = resolve; })
    );

    const expose = { current: null };
    render(<HookTester onCreate={() => {}} onCancel={() => {}} dbImages={[]} imageProfiles={IMAGE_PROFILES} expose={expose} />);

    act(() => { expose.current.updateImageInput('nginx'); });
    act(() => { expose.current.triggerHubSearch(); }); // in-flight

    expect(expose.current.isSearchingHub).toBe(true);

    // User types more — should abort search and clear results
    await act(async () => {
      expose.current.updateImageInput('ngin');
      // Resolve the (now stale) promise — it should be ignored
      resolveSearch([{ name: 'nginx', isOfficial: true, pullCount: 100, description: '' }]);
    });

    expect(expose.current.isSearchingHub).toBe(false);
    expect(expose.current.hubResults).toBeNull();
  });
});
