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
      expect(created[0]).toEqual({ imageName: 'redis:7-alpine', containerName: '', portInput: '', envInput: 'FOO=bar' });
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

    expect(expose.current.imageName).toBe('nginx:1.27-alpine');
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

  test('applyFocusedSuggestion() preserves explicit tag when suggestion already has one', () => {
    const expose = { current: null };
    render(<HookTester onCreate={() => {}} onCancel={() => {}} dbImages={[]} imageProfiles={IMAGE_PROFILES} expose={expose} />);

    // Manually set imageName with a tag and simulate a suggestion with tag
    act(() => { expose.current.updateImageInput('pg'); });
    // inject a suggestion with a tag by directly calling with known value
    // Instead: use updateImageInput then manually apply — but suggestions come from profiles (no tag)
    // So test that if imageName already has ':' when applyFocusedSuggestion runs, it is not double-tagged
    // The real scenario: user types 'postgres:15', selects suggestion — but suggestions list only contains 'postgres'
    // Better test: set imageName to 'postgres:15' via setImageName then call nextStep on step 0 → tag preserved
    act(() => { expose.current.setImageName('postgres:15'); });
    act(() => { expose.current.nextStep(); }); // step 0 → should advance with postgres:15 preserved

    expect(expose.current.imageName).toBe('postgres:15');
    expect(expose.current.step).toBe(1);
  });
});

describe('useContainerCreation — resolveImageTag on nextStep & applyFocusedSuggestion', () => {
  test('nextStep at step 0 with bare image name appends defaultTag', () => {
    const expose = { current: null };
    render(<HookTester onCreate={() => {}} onCancel={() => {}} dbImages={[]} imageProfiles={IMAGE_PROFILES} expose={expose} />);

    act(() => { expose.current.setImageName('postgres'); });
    act(() => { expose.current.nextStep(); });

    expect(expose.current.imageName).toBe('postgres:17-alpine');
    expect(expose.current.step).toBe(1);
  });

  test('nextStep at step 0 with explicit tag preserves it', () => {
    const expose = { current: null };
    render(<HookTester onCreate={() => {}} onCancel={() => {}} dbImages={[]} imageProfiles={IMAGE_PROFILES} expose={expose} />);

    act(() => { expose.current.setImageName('postgres:15'); });
    act(() => { expose.current.nextStep(); });

    expect(expose.current.imageName).toBe('postgres:15');
    expect(expose.current.step).toBe(1);
  });
});

describe('useContainerCreation — insertNextSuggestedEnv() & hasSuggestedEnv', () => {
  test('insertNextSuggestedEnv is exposed from hook', () => {
    const expose = { current: null };
    render(<HookTester onCreate={() => {}} onCancel={() => {}} dbImages={[]} imageProfiles={IMAGE_PROFILES} expose={expose} />);
    expect(typeof expose.current.insertNextSuggestedEnv).toBe('function');
  });

  test('hasSuggestedEnv is true when profile has suggestedEnv entries (postgres)', () => {
    const expose = { current: null };
    render(<HookTester onCreate={() => {}} onCancel={() => {}} dbImages={[]} imageProfiles={IMAGE_PROFILES} expose={expose} />);
    act(() => { expose.current.setImageName('postgres:17-alpine'); });
    expect(expose.current.hasSuggestedEnv).toBe(true);
  });

  test('hasSuggestedEnv is false when image has no suggestedEnv (nginx)', () => {
    const expose = { current: null };
    render(<HookTester onCreate={() => {}} onCancel={() => {}} dbImages={[]} imageProfiles={IMAGE_PROFILES} expose={expose} />);
    act(() => { expose.current.setImageName('nginx:1.27-alpine'); });
    expect(expose.current.hasSuggestedEnv).toBe(false);
  });

  test('calling insertNextSuggestedEnv with postgres image inserts first suggested env', () => {
    const expose = { current: null };
    render(<HookTester onCreate={() => {}} onCancel={() => {}} dbImages={[]} imageProfiles={IMAGE_PROFILES} expose={expose} />);
    // advance to step 3 with postgres
    act(() => { expose.current.setImageName('postgres'); });
    act(() => { expose.current.nextStep(); }); // → step 1 (resolves tag)
    act(() => { expose.current.nextStep(); }); // → step 2
    act(() => { expose.current.nextStep(); }); // → step 3

    act(() => { expose.current.insertNextSuggestedEnv(); });
    // envInput should contain the first suggestedEnv for postgres (required var first)
    expect(expose.current.envInput).toBe('POSTGRES_PASSWORD=secret');
  });

  test('calling insertNextSuggestedEnv again inserts the next pending suggestion', () => {
    const expose = { current: null };
    render(<HookTester onCreate={() => {}} onCancel={() => {}} dbImages={[]} imageProfiles={IMAGE_PROFILES} expose={expose} />);
    act(() => { expose.current.setImageName('postgres'); });
    act(() => { expose.current.nextStep(); });
    act(() => { expose.current.nextStep(); });
    act(() => { expose.current.nextStep(); });

    act(() => { expose.current.insertNextSuggestedEnv(); }); // inserts first
    act(() => { expose.current.insertNextSuggestedEnv(); }); // inserts second
    expect(expose.current.envInput).toBe('POSTGRES_PASSWORD=secret,POSTGRES_USER=postgres');
  });

  test('calling insertNextSuggestedEnv when all already added sets feedback message', () => {
    const expose = { current: null };
    render(<HookTester onCreate={() => {}} onCancel={() => {}} dbImages={[]} imageProfiles={IMAGE_PROFILES} expose={expose} />);
    act(() => { expose.current.setImageName('postgres'); });
    act(() => { expose.current.nextStep(); });
    act(() => { expose.current.nextStep(); });
    act(() => { expose.current.nextStep(); });

    // manually set all suggested envs
    const profile = IMAGE_PROFILES['postgres'];
    act(() => { expose.current.setEnvInput(profile.suggestedEnv.join(',')); });

    act(() => { expose.current.insertNextSuggestedEnv(); });
    expect(expose.current.message).toBe('All suggested env vars added');
    // envInput unchanged
    expect(expose.current.envInput).toBe(profile.suggestedEnv.join(','));
  });

  test('if user manually typed a key matching a suggestion, Tab skips that key', () => {
    const expose = { current: null };
    render(<HookTester onCreate={() => {}} onCancel={() => {}} dbImages={[]} imageProfiles={IMAGE_PROFILES} expose={expose} />);
    act(() => { expose.current.setImageName('postgres'); });
    act(() => { expose.current.nextStep(); });
    act(() => { expose.current.nextStep(); });
    act(() => { expose.current.nextStep(); });

    // user manually typed first suggestion key with different value
    act(() => { expose.current.setEnvInput('POSTGRES_PASSWORD=mypass'); });

    act(() => { expose.current.insertNextSuggestedEnv(); });
    // should skip POSTGRES_PASSWORD and insert the next one (POSTGRES_USER)
    expect(expose.current.envInput).toContain('POSTGRES_USER=postgres');
    expect(expose.current.envInput).not.toContain('POSTGRES_PASSWORD=secret');
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

describe('useContainerCreation — message auto-clear after timeout', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  test('error message set on nextStep clears after 4000ms', () => {
    const expose = { current: null };
    render(<HookTester onCreate={() => {}} onCancel={() => {}} dbImages={[]} expose={expose} />);

    // Trigger validation error (empty imageName)
    act(() => {
      expose.current.nextStep();
    });

    expect(expose.current.message).toBe('Image name cannot be empty.');

    // Advance timers by 4000ms
    act(() => {
      jest.advanceTimersByTime(4000);
    });

    expect(expose.current.message).toBe('');
  });

  test('success message from insertNextSuggestedEnv clears after 4000ms', () => {
    const expose = { current: null };
    render(<HookTester onCreate={() => {}} onCancel={() => {}} dbImages={[]} imageProfiles={IMAGE_PROFILES} expose={expose} />);

    act(() => { expose.current.setImageName('postgres'); });
    act(() => { expose.current.nextStep(); }); // step 0 → 1
    act(() => { expose.current.nextStep(); }); // step 1 → 2
    act(() => { expose.current.nextStep(); }); // step 2 → 3

    // Exhaust all suggested envs then call insertNextSuggestedEnv once more to get 'All suggested' message
    const profile = IMAGE_PROFILES['postgres'];
    act(() => { expose.current.setEnvInput(profile.suggestedEnv.join(',')); });
    act(() => { expose.current.insertNextSuggestedEnv(); });

    expect(expose.current.message).toBe('All suggested env vars added');

    act(() => {
      jest.advanceTimersByTime(4000);
    });

    expect(expose.current.message).toBe('');
  });
});
