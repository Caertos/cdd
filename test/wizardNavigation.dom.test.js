/**
 * @jest-environment jsdom
 */
import React, { useEffect } from 'react';
import { render, act } from '@testing-library/react';
import { jest } from '@jest/globals';
import { IMAGE_PROFILES } from '../src/helpers/constants.js';

jest.unstable_mockModule('../src/helpers/dockerHubService.js', () => ({
  searchDockerHub: jest.fn(),
  formatHubResult: jest.fn((r) => r.name),
}));

const {
  useContainerCreation,
  validateStep,
  stepMessageFor,
  STEP_COUNT,
} = await import('../src/hooks/creation/useContainerCreation.js');

function HookTester({ onCreate, onCancel, dbImages, imageProfiles, expose }) {
  const hook = useContainerCreation({ onCreate, onCancel, dbImages, imageProfiles });
  useEffect(() => {
    if (expose) expose.current = hook;
  });
  return null;
}

describe('Wizard navigation — STEP_COUNT', () => {
  test('STEP_COUNT is 4', () => {
    expect(STEP_COUNT).toBe(4);
  });
});

describe('validateStep (pure)', () => {
  const ctx = { imageProfiles: IMAGE_PROFILES, dbImages: ['mysql', 'postgres'] };

  test('step 0: empty image name fails', () => {
    expect(validateStep(0, { imageName: '', portInput: '', envInput: '', containerName: '' }, ctx))
      .toEqual({ ok: false, error: 'Image name cannot be empty.' });
  });

  test('step 0: non-empty image name passes', () => {
    expect(validateStep(0, { imageName: 'nginx', portInput: '', envInput: '', containerName: '' }, ctx))
      .toEqual({ ok: true });
  });

  test('step 1: always passes', () => {
    expect(validateStep(1, { imageName: 'nginx', portInput: '', envInput: '', containerName: '' }, ctx))
      .toEqual({ ok: true });
  });

  test('step 2: invalid ports fail', () => {
    expect(validateStep(2, { imageName: 'nginx', portInput: 'abc', envInput: '', containerName: '' }, ctx))
      .toEqual({ ok: false, error: expect.stringContaining('Port format') });
  });

  test('step 2: valid ports pass', () => {
    expect(validateStep(2, { imageName: 'nginx', portInput: '8080:80', envInput: '', containerName: '' }, ctx))
      .toEqual({ ok: true });
  });

  test('step 2: empty ports pass (optional)', () => {
    expect(validateStep(2, { imageName: 'nginx', portInput: '', envInput: '', containerName: '' }, ctx))
      .toEqual({ ok: true });
  });
});

describe('stepMessageFor (pure)', () => {
  const ctx = { imageProfiles: IMAGE_PROFILES, dbImages: ['mysql', 'postgres'] };

  test('step 0: returns image prompt', () => {
    const msg = stepMessageFor(0, { imageName: '' }, ctx);
    expect(msg.text).toContain('image');
    expect(msg.color).toBe('yellow');
  });

  test('step 1: returns container name prompt', () => {
    const msg = stepMessageFor(1, { imageName: 'nginx' }, ctx);
    expect(msg.text).toContain('container name');
  });

  test('step 2: returns ports prompt', () => {
    const msg = stepMessageFor(2, { imageName: 'nginx' }, ctx);
    expect(msg.text).toContain('ports');
  });

  test('step 3: postgres shows required env vars', () => {
    const msg = stepMessageFor(3, { imageName: 'postgres' }, ctx);
    expect(msg.text).toContain('Required env vars');
    expect(msg.text).toContain('POSTGRES_PASSWORD');
  });

  test('step 3: unknown image shows generic message', () => {
    const msg = stepMessageFor(3, { imageName: 'custom-image' }, ctx);
    expect(msg.text).toContain('environment variables');
  });
});

describe('prevStep()', () => {
  test('going forward and back preserves all field values', () => {
    const expose = { current: null };
    render(
      <HookTester
        onCreate={() => {}}
        onCancel={() => {}}
        dbImages={[]}
        expose={expose}
      />
    );

    act(() => {
      expose.current.updateImageInput('nginx');
    });

    act(() => {
      expose.current.nextStep(); // step 0 → 1
    });
    expect(expose.current.step).toBe(1);

    act(() => {
      expose.current.setContainerName('my-nginx');
    });

    act(() => {
      expose.current.nextStep(); // step 1 → 2
    });
    expect(expose.current.step).toBe(2);

    act(() => {
      expose.current.setPortInput('8080:80');
    });

    act(() => {
      expose.current.nextStep(); // step 2 → 3
    });
    expect(expose.current.step).toBe(3);

    // Go back
    act(() => {
      expose.current.prevStep(); // step 3 → 2
    });
    expect(expose.current.step).toBe(2);
    expect(expose.current.portInput).toBe('8080:80');

    act(() => {
      expose.current.prevStep(); // step 2 → 1
    });
    expect(expose.current.step).toBe(1);
    expect(expose.current.containerName).toBe('my-nginx');

    act(() => {
      expose.current.prevStep(); // step 1 → 0
    });
    expect(expose.current.step).toBe(0);
    // imageName is resolved with default tag on step 0→1 transition
    expect(expose.current.imageName).toMatch(/nginx/);
  });

  test('prevStep at step 0 is a no-op', () => {
    const expose = { current: null };
    render(
      <HookTester
        onCreate={() => {}}
        onCancel={() => {}}
        dbImages={[]}
        expose={expose}
      />
    );

    expect(expose.current.step).toBe(0);
    act(() => {
      expose.current.prevStep();
    });
    expect(expose.current.step).toBe(0);
  });

  test('going back recalculates step message', () => {
    const expose = { current: null };
    render(
      <HookTester
        onCreate={() => {}}
        onCancel={() => {}}
        dbImages={[]}
        expose={expose}
      />
    );

    act(() => {
      expose.current.updateImageInput('nginx');
    });

    act(() => {
      expose.current.nextStep(); // → step 1
    });
    const step1Msg = expose.current.message;
    expect(step1Msg).toContain('container name');

    act(() => {
      expose.current.nextStep(); // → step 2
    });

    act(() => {
      expose.current.prevStep(); // → step 1
    });
    // Message should be recalculated for step 1
    expect(expose.current.message).toContain('container name');
  });
});

describe('hasAnyInput()', () => {
  test('returns false when all fields are empty', () => {
    const expose = { current: null };
    render(
      <HookTester
        onCreate={() => {}}
        onCancel={() => {}}
        dbImages={[]}
        expose={expose}
      />
    );
    expect(expose.current.hasAnyInput()).toBe(false);
  });

  test('returns true when imageName has content', () => {
    const expose = { current: null };
    render(
      <HookTester
        onCreate={() => {}}
        onCancel={() => {}}
        dbImages={[]}
        expose={expose}
      />
    );
    act(() => {
      expose.current.updateImageInput('nginx');
    });
    expect(expose.current.hasAnyInput()).toBe(true);
  });

  test('returns true when portInput has content', () => {
    const expose = { current: null };
    render(
      <HookTester
        onCreate={() => {}}
        onCancel={() => {}}
        dbImages={[]}
        expose={expose}
      />
    );
    act(() => {
      expose.current.setPortInput('8080:80');
    });
    expect(expose.current.hasAnyInput()).toBe(true);
  });
});

describe('closeSuggestions()', () => {
  test('clears suggestions and selection', () => {
    const expose = { current: null };
    render(
      <HookTester
        onCreate={() => {}}
        onCancel={() => {}}
        dbImages={[]}
        expose={expose}
      />
    );

    act(() => {
      expose.current.updateImageInput('ng');
    });
    expect(expose.current.suggestions.length).toBeGreaterThan(0);

    act(() => {
      expose.current.closeSuggestions();
    });
    expect(expose.current.suggestions).toEqual([]);
    expect(expose.current.selectedSuggestionIndex).toBe(-1);
  });
});

describe('cancelHubSearch()', () => {
  test('clears hub search state', () => {
    const expose = { current: null };
    render(
      <HookTester
        onCreate={() => {}}
        onCancel={() => {}}
        dbImages={[]}
        expose={expose}
      />
    );

    // Simulate search in progress
    act(() => {
      expose.current.setImageName('nginx');
    });

    // cancelHubSearch should be a safe no-op when no search is active
    act(() => {
      expose.current.cancelHubSearch();
    });
    expect(expose.current.isSearchingHub).toBe(false);
  });
});

describe('Esc chain priority (suggestions → Hub → prev → discard)', () => {
  test('closeSuggestions does not change step', () => {
    const expose = { current: null };
    render(
      <HookTester
        onCreate={() => {}}
        onCancel={() => {}}
        dbImages={[]}
        expose={expose}
      />
    );

    act(() => {
      expose.current.updateImageInput('ng');
    });
    expect(expose.current.suggestions.length).toBeGreaterThan(0);

    act(() => {
      expose.current.closeSuggestions();
    });
    // Step unchanged, suggestions cleared
    expect(expose.current.step).toBe(0);
    expect(expose.current.suggestions).toEqual([]);
  });
});

describe('applyFocusedSuggestion + nextStep integration', () => {
  test('selecting a suggestion then pressing Enter advances to step 1', () => {
    const expose = { current: null };
    render(
      <HookTester
        onCreate={() => {}}
        onCancel={() => {}}
        dbImages={[]}
        expose={expose}
      />
    );

    // Type to get suggestions
    act(() => {
      expose.current.updateImageInput('ng');
    });
    expect(expose.current.suggestions.length).toBeGreaterThan(0);

    // Select first suggestion
    act(() => {
      expose.current.moveSuggestionSelection(1);
    });
    expect(expose.current.selectedSuggestionIndex).toBe(0);

    // Apply suggestion (simulates Enter on wizard.next)
    act(() => {
      expose.current.applyFocusedSuggestion();
    });
    expect(expose.current.imageName).toMatch(/nginx/);
    expect(expose.current.suggestions).toEqual([]);

    // Next Enter should advance to step 1
    act(() => {
      expose.current.nextStep();
    });
    expect(expose.current.step).toBe(1);
  });
});
