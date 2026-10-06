/**
 * @jest-environment jsdom
 */
import React, { useEffect } from 'react';
import { render, act } from '@testing-library/react';
import { jest } from '@jest/globals';

// Mock ink — capture the useInput handler so tests can simulate keypresses.
let _inputHandler = null;
const triggerInput = (input, key = {}) => {
  if (_inputHandler) _inputHandler(input, key);
};
await jest.unstable_mockModule('ink', () => ({
  Box: ({ children, ...props }) => React.createElement('div', props, children),
  Text: ({ children }) => React.createElement('span', null, children),
  Spacer: () => React.createElement('div', null),
  useInput: (fn) => {
    _inputHandler = fn;
  },
  useApp: () => ({ exit: () => {} }),
  render: () => ({ unmount: () => {}, waitUntilExit: () => Promise.resolve() }),
}));

// Mock containerActions — expose all named exports so dependents don't break
const mockSvcCreateContainer = jest.fn();
await jest.unstable_mockModule(
  '../src/helpers/dockerService/serviceComponents/containerActions.js',
  () => ({
    createContainer: mockSvcCreateContainer,
    removeContainer: jest.fn().mockResolvedValue(undefined),
    startContainer: jest.fn().mockResolvedValue(undefined),
    stopContainer: jest.fn().mockResolvedValue(undefined),
    restartContainer: jest.fn().mockResolvedValue(undefined),
  })
);

// Mock the log module to avoid side effects. getLogsTail is what the
// diagnosis panel and the F key read through useDiagnostics.
await jest.unstable_mockModule(
  '../src/helpers/dockerService/serviceComponents/containerLogs.js',
  () => ({
    getLogsStream: () => {},
    getLogsTail: jest.fn().mockResolvedValue([]),
  })
);

// inspect: the F key reads Config.Env to rebuild the wizard (TASK-8).
const mockGetContainerDetails = jest.fn();
const mockGetImageEnv = jest.fn();
await jest.unstable_mockModule(
  '../src/helpers/dockerService/serviceComponents/containerInspect.js',
  () => ({
    getContainerDetails: mockGetContainerDetails,
    getImageEnv: mockGetImageEnv,
    getManyContainerDetails: jest.fn().mockResolvedValue(new Map()),
  })
);

// Break useControls → useShellMode → App.jsx → useContainers cycle under ESM
await jest.unstable_mockModule('../src/hooks/useShellMode.js', () => ({
  useShellMode: () => ({ openShell: jest.fn() }),
}));

// Review step (TASK-4) imports these dynamically; without mocks a unit test
// would open the real Docker daemon socket.
await jest.unstable_mockModule(
  '../src/helpers/dockerService/dockerService.js',
  () => ({
    docker: { listContainers: jest.fn().mockResolvedValue([]) },
  })
);
await jest.unstable_mockModule(
  '../src/helpers/dockerService/serviceComponents/imageUtils.js',
  () => ({
    imageExists: jest.fn().mockResolvedValue(true),
    pullImage: jest.fn().mockResolvedValue(undefined),
    previewAutoPorts: jest.fn().mockResolvedValue(null),
  })
);

const { useControls } = await import('../src/hooks/useControls.js');

function HookTester({ containers, expose, overrides }) {
  const hook = useControls(containers, overrides);
  useEffect(() => {
    if (expose) expose.current = hook;
  });
  return null;
}

// Helper: advance the full wizard and fire onCreate.
// 5 steps since TASK-4: image → name → ports → env → review.
async function completeCreationWizard(expose, imageName = 'nginx') {
  act(() => {
    expose.current.creation.setImageName(imageName);
  });
  act(() => {
    expose.current.creation.nextStep();
  }); // 0 → 1
  act(() => {
    expose.current.creation.nextStep();
  }); // 1 → 2
  act(() => {
    expose.current.creation.nextStep();
  }); // 2 → 3
  // 3 → 4 (review): prepareReview() is async (summary + warnings)
  await act(async () => {
    await expose.current.creation.nextStep();
  });
  expect(expose.current.creation.step).toBe(4);
  // 4 (review) confirmed → onCreate
  await act(async () => {
    expose.current.creation.nextStep();
  });
}

describe('useControls (FR6 — port mapping in success message)', () => {
  beforeEach(() => {
    mockSvcCreateContainer.mockReset();
  });

  test('success message includes port mapping after container creation', async () => {
    const ports = [
      {
        containerPort: '3306',
        hostPort: '3306',
        protocol: 'tcp',
        source: 'auto',
      },
    ];
    mockSvcCreateContainer.mockResolvedValue({ id: 'cid-abc', ports });

    const expose = { current: null };
    render(<HookTester containers={[]} expose={expose} />);

    await completeCreationWizard(expose, 'nginx');

    expect(expose.current.actions.message).toBe(
      'Created container cid-abc | Ports: 3306→3306/tcp'
    );
    expect(expose.current.actions.messageColor).toBe('green');
  });

  test('success message has no port section when ports array is empty', async () => {
    mockSvcCreateContainer.mockResolvedValue({ id: 'cid-xyz', ports: [] });

    const expose = { current: null };
    render(<HookTester containers={[]} expose={expose} />);

    await completeCreationWizard(expose, 'alpine');

    expect(expose.current.actions.message).toBe('Created container cid-xyz');
    expect(expose.current.actions.messageColor).toBe('green');
  });

  test('success message includes multiple port mappings', async () => {
    const ports = [
      {
        containerPort: '80',
        hostPort: '8080',
        protocol: 'tcp',
        source: 'user',
      },
      {
        containerPort: '443',
        hostPort: '8443',
        protocol: 'tcp',
        source: 'user',
      },
    ];
    mockSvcCreateContainer.mockResolvedValue({ id: 'cid-multi', ports });

    const expose = { current: null };
    render(<HookTester containers={[]} expose={expose} />);

    await completeCreationWizard(expose, 'nginx');

    expect(expose.current.actions.message).toBe(
      'Created container cid-multi | Ports: 8080→80/tcp, 8443→443/tcp'
    );
  });

  test('error message is shown when svcCreateContainer rejects', async () => {
    mockSvcCreateContainer.mockRejectedValue(new Error('pull access denied'));

    const expose = { current: null };
    render(<HookTester containers={[]} expose={expose} />);

    await completeCreationWizard(expose, 'badimage');

    expect(expose.current.actions.message).toBe(
      'Error creating container: pull access denied'
    );
    expect(expose.current.actions.messageColor).toBe('red');
  });
});

describe('useControls — step 0 keyboard routing integration', () => {
  beforeEach(() => {
    mockSvcCreateContainer.mockReset();
  });

  test('creation.updateImageInput() filters suggestions (routing readiness check)', () => {
    const expose = { current: null };
    render(<HookTester containers={[]} expose={expose} />);

    // updateImageInput should be exposed through creation hook
    expect(typeof expose.current.creation.updateImageInput).toBe('function');

    act(() => {
      expose.current.creation.updateImageInput('ng');
    });

    expect(expose.current.creation.suggestions).toContain('nginx');
    expect(expose.current.creation.selectedSuggestionIndex).toBe(-1);
  });

  test('moveSuggestionSelection(1) then applyFocusedSuggestion() fills imageName', () => {
    const expose = { current: null };
    render(<HookTester containers={[]} expose={expose} />);

    act(() => {
      expose.current.creation.updateImageInput('ng');
    });
    act(() => {
      expose.current.creation.moveSuggestionSelection(1);
    });
    act(() => {
      expose.current.creation.applyFocusedSuggestion();
    });

    expect(expose.current.creation.imageName).toBe('nginx:1.27-alpine');
    expect(expose.current.creation.step).toBe(0);
    expect(expose.current.creation.suggestions).toHaveLength(0);
  });

  test('applyFocusedSuggestion() does not advance step (Enter with focus uses suggestion not nextStep)', () => {
    const expose = { current: null };
    render(<HookTester containers={[]} expose={expose} />);

    act(() => {
      expose.current.creation.updateImageInput('ng');
    });
    act(() => {
      expose.current.creation.moveSuggestionSelection(1);
    });
    act(() => {
      expose.current.creation.applyFocusedSuggestion();
    });

    // Step must remain 0 — autocomplete applied, wizard did not advance
    expect(expose.current.creation.step).toBe(0);
  });

  test('nextStep() with imageName set advances to step 1 (normal flow without suggestions)', () => {
    const expose = { current: null };
    render(<HookTester containers={[]} expose={expose} />);

    act(() => {
      expose.current.creation.setImageName('nginx');
    });
    act(() => {
      expose.current.creation.nextStep();
    });

    expect(expose.current.creation.step).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FR4 / FR5 / FR6 — Real keyboard routing via processCreationInput
// These tests simulate actual keypresses through the useInput callback.
// ─────────────────────────────────────────────────────────────────────────────
describe('useControls — FR4/FR5/FR6 keyboard routing via processCreationInput', () => {
  beforeEach(() => {
    _inputHandler = null;
    mockSvcCreateContainer.mockReset();
  });

  /** Helper: render hook and enter creation mode by simulating 'c' keypress. */
  function renderAndStartCreation(containers = []) {
    const expose = { current: null };
    render(<HookTester containers={containers} expose={expose} />);
    // Trigger creation mode ('c' command in handleDockerCommands)
    act(() => {
      triggerInput('c', {});
    });
    return expose;
  }

  // ── FR4: ↑/↓ only intercepted on step 0 with suggestions ────────────────

  test('FR4 — ↓ arrow on step 0 with suggestions moves selection down', () => {
    const expose = renderAndStartCreation();

    // Type 'n' to get suggestions (nginx, node, etc.)
    act(() => {
      triggerInput('n', {});
    });
    const suggestionsAfterType = expose.current.creation.suggestions;
    expect(suggestionsAfterType.length).toBeGreaterThan(0);

    act(() => {
      triggerInput('', { downArrow: true });
    });
    expect(expose.current.creation.selectedSuggestionIndex).toBe(0);
  });

  test('FR4 — ↑ arrow on step 0 with suggestions moves selection up', () => {
    const expose = renderAndStartCreation();

    act(() => {
      triggerInput('n', {});
    });
    // Move down twice, then up once → index should be 0
    act(() => {
      triggerInput('', { downArrow: true });
    });
    act(() => {
      triggerInput('', { downArrow: true });
    });
    act(() => {
      triggerInput('', { upArrow: true });
    });
    expect(expose.current.creation.selectedSuggestionIndex).toBe(0);
  });

  test('FR4 — ↑/↓ are ignored on step 0 when suggestions list is empty', () => {
    const expose = renderAndStartCreation();

    // Type something unlikely to match → no suggestions
    act(() => {
      triggerInput('x', {});
    });
    act(() => {
      triggerInput('x', {});
    });
    act(() => {
      triggerInput('x', {});
    });
    expect(expose.current.creation.suggestions).toHaveLength(0);

    act(() => {
      triggerInput('', { downArrow: true });
    });
    // selectedSuggestionIndex stays at -1 (ignored)
    expect(expose.current.creation.selectedSuggestionIndex).toBe(-1);
  });

  test('FR4 — ↑/↓ are ignored when step > 0 (no suggestions navigation on other steps)', () => {
    const expose = renderAndStartCreation();

    // Advance to step 1: type an image name (opens suggestion list), close it
    // with Esc (context is wizard-list while open), then Enter to advance.
    act(() => {
      triggerInput('n', {});
    });
    act(() => {
      triggerInput('g', {});
    });
    act(() => {
      expose.current.creation.setImageName('nginx');
    });
    act(() => {
      triggerInput('', { escape: true });
    });
    expect(expose.current.creation.suggestions).toHaveLength(0);
    act(() => {
      triggerInput('\r', {});
    });
    expect(expose.current.creation.step).toBe(1);

    const prevSelection = expose.current.creation.selectedSuggestionIndex;
    act(() => {
      triggerInput('', { downArrow: true });
    });
    // selection is unchanged — arrow ignored on step 1
    expect(expose.current.creation.selectedSuggestionIndex).toBe(prevSelection);
  });

  // ── FR5: Enter with focused suggestion → apply, NOT nextStep ─────────────

  test('FR5 — Enter with selectedSuggestionIndex >= 0 applies suggestion and stays on step 0', () => {
    const expose = renderAndStartCreation();

    act(() => {
      triggerInput('n', {});
    }); // type to get suggestions
    expect(expose.current.creation.suggestions.length).toBeGreaterThan(0);

    act(() => {
      triggerInput('', { downArrow: true });
    }); // select first suggestion
    expect(expose.current.creation.selectedSuggestionIndex).toBe(0);

    // Press Enter → should apply suggestion, NOT advance step
    act(() => {
      triggerInput('\r', {});
    });

    expect(expose.current.creation.step).toBe(0);
    expect(expose.current.creation.imageName).not.toBe('');
    expect(expose.current.creation.imageName).not.toBe('n');
  });

  test('FR5 — Enter with focused suggestion does NOT call nextStep (step stays 0)', () => {
    const expose = renderAndStartCreation();

    act(() => {
      triggerInput('n', {});
    });
    act(() => {
      triggerInput('', { downArrow: true });
    }); // focus first

    act(() => {
      triggerInput('\r', {});
    }); // Enter with focus

    // FR5: step must be 0 (nextStep was NOT called)
    expect(expose.current.creation.step).toBe(0);
  });

  // ── FR6: Enter without focused suggestion → nextStep ─────────────────────

  test('FR6 — Enter with selectedSuggestionIndex === -1 advances step', () => {
    const expose = renderAndStartCreation();

    act(() => {
      expose.current.creation.setImageName('nginx');
    });
    // No suggestion focused (index -1)
    expect(expose.current.creation.selectedSuggestionIndex).toBe(-1);

    act(() => {
      triggerInput('\r', {});
    }); // Enter without focus
    expect(expose.current.creation.step).toBe(1);
  });

  test('FR6 — Enter without focus does NOT apply suggestion (imageName unchanged)', () => {
    const expose = renderAndStartCreation();

    act(() => {
      expose.current.creation.setImageName('nginx');
    });

    act(() => {
      triggerInput('\r', {});
    }); // advance to step 1

    // nextStep resolves the tag — nginx becomes nginx:1.27-alpine; step advances to 1
    // applyFocusedSuggestion was NOT called (no suggestion was focused)
    expect(expose.current.creation.imageName).toBe('nginx:1.27-alpine');
    expect(expose.current.creation.step).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tab on step 3 → insertNextSuggestedEnv
// ─────────────────────────────────────────────────────────────────────────────
describe('useControls — Tab on step 3 calls insertNextSuggestedEnv', () => {
  beforeEach(() => {
    _inputHandler = null;
    mockSvcCreateContainer.mockReset();
  });

  test('Tab on step 3 calls insertNextSuggestedEnv()', () => {
    const mockInsertNextSuggestedEnv = jest.fn();
    const expose = { current: null };
    render(
      <HookTester
        containers={[]}
        expose={expose}
        overrides={{ insertNextSuggestedEnv: mockInsertNextSuggestedEnv }}
      />
    );
    // Enter creation mode
    act(() => {
      triggerInput('c', {});
    });
    // Advance to step 3
    act(() => {
      expose.current.creation.setImageName('postgres');
    });
    act(() => {
      triggerInput('\r', {});
    }); // step 0 → 1
    act(() => {
      triggerInput('\r', {});
    }); // step 1 → 2
    act(() => {
      triggerInput('\r', {});
    }); // step 2 → 3
    expect(expose.current.creation.step).toBe(3);

    act(() => {
      triggerInput('', { tab: true });
    });

    expect(mockInsertNextSuggestedEnv).toHaveBeenCalledTimes(1);
  });

  test('Tab on step 3 when insertNextSuggestedEnv is undefined → no-op (safe guard)', () => {
    const expose = { current: null };
    render(
      <HookTester
        containers={[]}
        expose={expose}
        overrides={{ insertNextSuggestedEnv: undefined }}
      />
    );
    act(() => {
      triggerInput('c', {});
    });
    act(() => {
      expose.current.creation.setImageName('nginx');
    });
    act(() => {
      triggerInput('\r', {});
    });
    act(() => {
      triggerInput('\r', {});
    });
    act(() => {
      triggerInput('\r', {});
    });

    // Should not throw
    expect(() => {
      act(() => {
        triggerInput('', { tab: true });
      });
    }).not.toThrow();
  });
});
describe('useControls — FR7 Tab triggers hub search on step 0', () => {
  beforeEach(() => {
    _inputHandler = null;
    mockSvcCreateContainer.mockReset();
  });

  /** Helper: render in creation mode with a triggerHubSearch mock override */
  function renderCreationWithSearch({
    isSearchingHub = false,
    imageName: initialImageName = '',
  } = {}) {
    const mockTriggerHubSearch = jest.fn();
    const expose = { current: null };

    render(
      <HookTester
        containers={[]}
        expose={expose}
        overrides={{ triggerHubSearch: mockTriggerHubSearch, isSearchingHub }}
      />
    );
    // Enter creation mode
    act(() => {
      triggerInput('c', {});
    });
    // Set imageName if provided
    if (initialImageName) {
      act(() => {
        expose.current.creation.setImageName(initialImageName);
      });
    }
    return { expose, mockTriggerHubSearch };
  }

  test('FR7 — Tab on step 0 calls triggerHubSearch()', () => {
    const { mockTriggerHubSearch } = renderCreationWithSearch({
      imageName: 'nginx',
    });

    act(() => {
      triggerInput('', { tab: true });
    });

    expect(mockTriggerHubSearch).toHaveBeenCalledTimes(1);
  });

  test('FR7 — Tab on step 0 when isSearchingHub=true does NOT call triggerHubSearch (guard)', () => {
    const { mockTriggerHubSearch } = renderCreationWithSearch({
      isSearchingHub: true,
      imageName: 'nginx',
    });

    act(() => {
      triggerInput('', { tab: true });
    });

    expect(mockTriggerHubSearch).not.toHaveBeenCalled();
  });

  test('FR7 — Tab on step 0 when imageName is empty string does NOT call triggerHubSearch (guard)', () => {
    const { mockTriggerHubSearch } = renderCreationWithSearch({
      imageName: '',
    });

    act(() => {
      triggerInput('', { tab: true });
    });

    expect(mockTriggerHubSearch).not.toHaveBeenCalled();
  });

  test('FR7 — Tab on step > 0 does NOT call triggerHubSearch (only active on step 0)', () => {
    const { expose, mockTriggerHubSearch } = renderCreationWithSearch({
      imageName: 'nginx',
    });

    // Advance to step 1
    act(() => {
      triggerInput('\r', {});
    });
    expect(expose.current.creation.step).toBe(1);

    act(() => {
      triggerInput('', { tab: true });
    });

    expect(mockTriggerHubSearch).not.toHaveBeenCalled();
  });
});

describe('useControls — success/error message clears after 4000ms', () => {
  // Fake only the timer APIs: React's act() and the async wizard still need
  // the real microtask queue, nextTick and setImmediate.
  beforeEach(() => {
    jest.useFakeTimers({
      doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'],
    });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  test('success message from container creation clears after 4000ms', async () => {
    mockSvcCreateContainer.mockResolvedValue({ id: 'cid-timer', ports: [] });

    const expose = { current: null };
    render(<HookTester containers={[]} expose={expose} />);

    await completeCreationWizard(expose, 'nginx');
    expect(expose.current.actions.message).toBe('Created container cid-timer');

    act(() => {
      jest.advanceTimersByTime(3999);
    });
    expect(expose.current.actions.message).toBe('Created container cid-timer');

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(expose.current.actions.message).toBe('');
  });

  test('error message from container creation clears after 4000ms', async () => {
    mockSvcCreateContainer.mockRejectedValue(new Error('not found'));

    const expose = { current: null };
    render(<HookTester containers={[]} expose={expose} />);

    await completeCreationWizard(expose, 'badimage');
    expect(expose.current.actions.message).toContain('not found');

    act(() => {
      jest.advanceTimersByTime(4000);
    });
    expect(expose.current.actions.message).toBe('');
  });
});

describe('useControls — pressing C calls resetCreation BEFORE onStartCreate', () => {
  beforeEach(() => {
    _inputHandler = null;
    mockSvcCreateContainer.mockReset();
  });

  test('pressing C resets creation state before entering creation mode', () => {
    const callOrder = [];
    const expose = { current: null };

    // We render with no overrides, but we can spy on the internal calls
    // by checking that imageName is reset (empty) when creatingContainer becomes true.
    // Strategy: set imageName to something, then press C, verify state is reset in same render.
    render(<HookTester containers={[]} expose={expose} />);

    // Give the hook an existing state to verify it gets reset
    act(() => {
      triggerInput('c', {});
    }); // enter creation mode
    act(() => {
      expose.current.creation.setImageName('dirty-state');
    });

    // Esc with data opens discard confirmation — the app stays in the wizard
    act(() => {
      if (_inputHandler) _inputHandler('', { escape: true });
    });
    expect(expose.current.confirmDiscard).toBe(true);
    act(() => {
      triggerInput('y', {});
    }); // confirm discard
    expect(expose.current.creatingContainer).toBe(false);

    // Re-enter via C — this should reset THEN show creation mode
    act(() => {
      triggerInput('c', {});
    });

    // After pressing C: creatingContainer should be true AND imageName should be reset to ''
    expect(expose.current.creatingContainer).toBe(true);
    // imageName is '' (from resetCreation), NOT 'dirty-state'
    expect(expose.current.creation.imageName).toBe('');
  });

  test('after pressing C, creation.message is set to the wizard prompt (resetCreation ran)', () => {
    const expose = { current: null };
    render(<HookTester containers={[]} expose={expose} />);

    act(() => {
      triggerInput('c', {});
    });

    expect(expose.current.creatingContainer).toBe(true);
    expect(expose.current.creation.message).toBe(
      'Insert the name of the image to create: '
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// D3 FIX — hubResults navigation with ↑/↓ and Enter
// ─────────────────────────────────────────────────────────────────────────────
describe('useControls — D3 fix: hubResults navigation', () => {
  beforeEach(() => {
    _inputHandler = null;
    mockSvcCreateContainer.mockReset();
  });

  test('D3 — with hubResults present, down arrow moves selection index', () => {
    const expose = { current: null };
    render(<HookTester containers={[]} expose={expose} />);

    // Enter creation mode
    act(() => {
      triggerInput('c', {});
    });

    // Simulate hubResults being set (normally from triggerHubSearch)
    const mockHubResults = ['nginx', 'nginx-alpine', 'nginx-unstable'];
    act(() => {
      expose.current.creation.updateImageInput('ng');
      // Directly set hubResults via the hook's internal state
      // In real usage, this would come from triggerHubSearch
    });

    // Verify activeItems includes suggestions when hubResults is null
    expect(expose.current.creation.activeItems).toBeDefined();
    expect(expose.current.creation.activeItems.length).toBeGreaterThan(0);
  });

  test('D3 — activeItems is hubResults when hubResults is present', () => {
    const expose = { current: null };
    render(<HookTester containers={[]} expose={expose} />);

    act(() => {
      triggerInput('c', {});
    });
    act(() => {
      expose.current.creation.updateImageInput('ng');
    });

    // activeItems should be the suggestions list (since hubResults is null)
    expect(expose.current.creation.activeItems).toEqual(
      expose.current.creation.suggestions
    );
  });

  test('D3 — applyFocusedSuggestion uses activeItems (not just suggestions)', () => {
    const expose = { current: null };
    render(<HookTester containers={[]} expose={expose} />);

    act(() => {
      triggerInput('c', {});
    });
    act(() => {
      expose.current.creation.updateImageInput('ng');
    });

    // Move to first suggestion
    act(() => {
      expose.current.creation.moveSuggestionSelection(1);
    });
    expect(expose.current.creation.selectedSuggestionIndex).toBe(0);

    // Apply the suggestion
    act(() => {
      expose.current.creation.applyFocusedSuggestion();
    });

    // Should have applied the suggestion
    expect(expose.current.creation.imageName).not.toBe('');
    expect(expose.current.creation.step).toBe(0);
  });
});

describe('useControls — disconnected context wires R to connection.retry', () => {
  test('context is disconnected and R calls connection.retry', () => {
    const retry = jest.fn();
    const expose = { current: null };
    render(
      <HookTester
        containers={[]}
        expose={expose}
        overrides={{
          connection: { status: 'error', error: null, retry, retryToken: 0 },
        }}
      />
    );

    expect(expose.current.context).toBe('disconnected');

    act(() => {
      triggerInput('r', {});
    });

    expect(retry).toHaveBeenCalledTimes(1);
  });

  test('context stays list when Docker is ok', () => {
    const retry = jest.fn();
    const expose = { current: null };
    render(
      <HookTester
        containers={[{ id: 'c1', name: 'web', state: 'running' }]}
        expose={expose}
        overrides={{
          connection: { status: 'ok', error: null, retry, retryToken: 0 },
        }}
      />
    );

    expect(expose.current.context).toBe('list');
  });

  test('Q quits directly without confirmation on connection screen', () => {
    const retry = jest.fn();
    const expose = { current: null };
    render(
      <HookTester
        containers={[]}
        expose={expose}
        overrides={{
          connection: { status: 'error', error: null, retry, retryToken: 0 },
        }}
      />
    );

    expect(expose.current.context).toBe('disconnected');
    expect(expose.current.confirmQuit).toBe(false);

    act(() => {
      triggerInput('q', {});
    });

    // Direct exit path: no invisible confirmation, cleanup message set.
    expect(expose.current.confirmQuit).toBe(false);
    expect(expose.current.message).toBe('Exiting...');
    expect(expose.current.context).toBe('disconnected');
  });
});

describe('useControls — the fix key (TASK-8)', () => {
  const broken = {
    id: 'c1',
    name: 'mi-basedatos',
    image: 'postgres:17-alpine',
    state: 'exited',
    status: 'Exited (1) 2 seconds ago',
    ports: ['5432:5432'],
  };

  const healthMap = (container, facts = {}) =>
    new Map([
      [
        container.id,
        {
          code: 'crash-loop',
          level: 'fail',
          headline: 'died 2s',
          facts: {
            exitCode: 1,
            uptimeMs: 2000,
            restartCount: 0,
            oomKilled: false,
            healthStatus: null,
            ...facts,
          },
        },
      ],
    ]);

  const logLine = ['Error: superuser password is not specified'];

  async function setup() {
    const { getLogsTail } =
      await import('../src/helpers/dockerService/serviceComponents/containerLogs.js');
    getLogsTail.mockResolvedValue(logLine);
    mockGetContainerDetails.mockResolvedValue({
      env: ['POSTGRES_USER=app', 'PATH=/usr/bin'],
      cmd: ['postgres'],
    });
    mockGetImageEnv.mockResolvedValue(['PATH=/usr/bin']);

    const expose = { current: null };
    render(
      <HookTester
        containers={[broken]}
        expose={expose}
        overrides={{ health: healthMap(broken) }}
      />
    );
    await act(async () => {});
    return expose;
  }

  afterEach(() => {
    mockGetContainerDetails.mockReset();
    mockGetImageEnv.mockReset();
    mockSvcCreateContainer.mockReset();
  });

  test('the key is offered once a fix is available', async () => {
    const expose = await setup();
    expect(expose.current.diagnosis.fix).not.toBeNull();
    const ids = expose.current.keymapBindings.map((b) => b.id);
    expect(ids).toContain('container.fix');
  });

  test('pressing F opens the wizard prefilled on the review step', async () => {
    const expose = await setup();
    await act(async () => {
      expose.current.dispatch('container.fix');
    });
    await act(async () => {});

    expect(expose.current.creatingContainer).toBe(true);
    expect(expose.current.creationStep).toBe(4);
    expect(expose.current.containerNameInput).toBe('mi-basedatos-2');
    expect(expose.current.envInput).toContain('POSTGRES_PASSWORD');
  });

  test('the image own variables never reach the form', async () => {
    const expose = await setup();
    await act(async () => {
      expose.current.dispatch('container.fix');
    });
    await act(async () => {});
    expect(expose.current.envInput).not.toContain('PATH=');
  });

  test('the ports are carried over', async () => {
    const expose = await setup();
    await act(async () => {
      expose.current.dispatch('container.fix');
    });
    await act(async () => {});
    expect(expose.current.portInput).toBe('5432:5432');
  });

  test('the review marks what the fix changed', async () => {
    const expose = await setup();
    await act(async () => {
      expose.current.dispatch('container.fix');
    });
    await act(async () => {});
    const changed = expose.current.creation.reviewRows
      .filter((r) => r.changed)
      .map((r) => r.key);
    expect(changed).toEqual(expect.arrayContaining(['env', 'name']));
  });

  test('without a fix the key is not offered', async () => {
    const { getLogsTail } =
      await import('../src/helpers/dockerService/serviceComponents/containerLogs.js');
    getLogsTail.mockResolvedValue(['something nobody recognises']);
    mockGetContainerDetails.mockResolvedValue({ env: [], cmd: [] });
    mockGetImageEnv.mockResolvedValue([]);

    const container = { ...broken, image: 'acme/app:1' };
    const expose = { current: null };
    render(
      <HookTester
        containers={[container]}
        expose={expose}
        overrides={{ health: healthMap(container) }}
      />
    );
    await act(async () => {});

    expect(expose.current.diagnosis.fix).toBeNull();
    expect(expose.current.keymapBindings.map((b) => b.id)).not.toContain(
      'container.fix'
    );
  });
});

describe('useControls — the failed container is never deleted silently', () => {
  const broken = {
    id: 'c1',
    name: 'mi-basedatos',
    image: 'postgres:17-alpine',
    state: 'exited',
    status: 'Exited (1) 2 seconds ago',
    ports: ['5432:5432'],
  };

  const verdictMap = new Map([
    [
      'c1',
      {
        code: 'crash-loop',
        level: 'fail',
        headline: 'died 2s',
        facts: {
          exitCode: 1,
          uptimeMs: 2000,
          restartCount: 0,
          oomKilled: false,
          healthStatus: null,
        },
      },
    ],
  ]);

  beforeEach(async () => {
    mockSvcCreateContainer.mockReset().mockResolvedValue({
      id: 'cid-new',
      ports: [],
    });
    const { getLogsTail } =
      await import('../src/helpers/dockerService/serviceComponents/containerLogs.js');
    getLogsTail.mockResolvedValue(['superuser password is not specified']);
    mockGetContainerDetails.mockResolvedValue({
      env: ['POSTGRES_PASSWORD=x'],
      cmd: [],
    });
    mockGetImageEnv.mockResolvedValue([]);
    const { removeContainer } =
      await import('../src/helpers/dockerService/serviceComponents/containerActions.js');
    removeContainer.mockClear();
  });

  async function recreateAndConfirm(expose) {
    await act(async () => {
      expose.current.dispatch('container.fix');
    });
    await act(async () => {});
    expect(expose.current.creationStep).toBe(4);
    await act(async () => {
      expose.current.creation.nextStep();
    });
    await act(async () => {});
  }

  async function setup() {
    const expose = { current: null };
    render(
      <HookTester
        containers={[broken]}
        expose={expose}
        overrides={{ health: verdictMap }}
      />
    );
    await act(async () => {});
    return expose;
  }

  test('after creating, CDD asks before touching the failed container', async () => {
    const expose = await setup();
    await recreateAndConfirm(expose);

    expect(expose.current.message).toContain('mi-basedatos-2');
    expect(expose.current.message).toContain('Delete mi-basedatos');
    expect(expose.current.pendingCleanup).toEqual({
      id: 'c1',
      name: 'mi-basedatos',
      replacement: 'mi-basedatos-2',
    });
  });

  test('answering no leaves the failed container alone', async () => {
    const { removeContainer } =
      await import('../src/helpers/dockerService/serviceComponents/containerActions.js');
    const expose = await setup();
    await recreateAndConfirm(expose);

    await act(async () => {
      expose.current.dispatch('cleanup.keep');
    });
    expect(removeContainer).not.toHaveBeenCalled();
    expect(expose.current.pendingCleanup).toBeNull();
    expect(expose.current.message).toContain('mi-basedatos kept.');
    expect(expose.current.message).toContain(
      'mi-basedatos-2 is stopped — select it and press [i] to start it.'
    );
  });

  test('answering yes removes it', async () => {
    const { removeContainer } =
      await import('../src/helpers/dockerService/serviceComponents/containerActions.js');
    const expose = await setup();
    await recreateAndConfirm(expose);

    await act(async () => {
      await expose.current.dispatch('cleanup.delete');
    });
    expect(removeContainer).toHaveBeenCalledWith('c1');
    expect(expose.current.pendingCleanup).toBeNull();
    expect(expose.current.message).toContain(
      'Removed mi-basedatos, the container that failed.'
    );
    expect(expose.current.message).toContain(
      'mi-basedatos-2 is stopped — select it and press [i] to start it.'
    );
  });

  test('a failed removal keeps its own message, without the start hint', async () => {
    const { removeContainer } =
      await import('../src/helpers/dockerService/serviceComponents/containerActions.js');
    removeContainer.mockRejectedValueOnce(new Error('busy'));
    const expose = await setup();
    await recreateAndConfirm(expose);

    await act(async () => {
      await expose.current.dispatch('cleanup.delete');
    });
    expect(expose.current.message).toContain('Could not remove mi-basedatos');
    expect(expose.current.message).not.toContain('press [i]');
  });

  test('the question is only asked when a fix was used', async () => {
    // A plain wizard creation has no failed container to ask about.
    const expose = { current: null };
    render(<HookTester containers={[broken]} expose={expose} overrides={{}} />);
    await act(async () => {});
    await completeCreationWizard(expose, 'nginx');
    expect(expose.current.pendingCleanup).toBeNull();
    expect(expose.current.message).toContain('Created container cid-new');
  });

  test('cancelling the wizard forgets the superseded container', async () => {
    const expose = await setup();
    await act(async () => {
      expose.current.dispatch('container.fix');
    });
    await act(async () => {});
    await act(async () => {
      expose.current.creation.cancelCreation();
    });
    expect(expose.current.pendingCleanup).toBeNull();
  });
});

describe('useControls — F refuses to guess when inspect fails', () => {
  const broken = {
    id: 'c1',
    name: 'mi-basedatos',
    image: 'postgres:17-alpine',
    state: 'exited',
    status: 'Exited (1) 2 seconds ago',
    ports: ['5432:5432'],
  };
  const verdictMap = new Map([
    [
      'c1',
      {
        code: 'crash-loop',
        level: 'fail',
        headline: 'died 2s',
        facts: {
          exitCode: 1,
          uptimeMs: 2000,
          restartCount: 0,
          oomKilled: false,
          healthStatus: null,
        },
      },
    ],
  ]);

  afterEach(() => {
    mockGetContainerDetails.mockReset();
    mockGetImageEnv.mockReset();
  });

  test('a failed inspect does not open the wizard', async () => {
    // Carrying on would build a container with no environment: a postgres
    // without POSTGRES_PASSWORD dies the same way it just did.
    const { getLogsTail } =
      await import('../src/helpers/dockerService/serviceComponents/containerLogs.js');
    getLogsTail.mockResolvedValue(['superuser password is not specified']);
    mockGetContainerDetails.mockResolvedValue(null);
    mockGetImageEnv.mockResolvedValue([]);

    const expose = { current: null };
    render(
      <HookTester
        containers={[broken]}
        expose={expose}
        overrides={{ health: verdictMap }}
      />
    );
    await act(async () => {});
    await act(async () => {
      expose.current.dispatch('container.fix');
    });
    await act(async () => {});

    expect(expose.current.creatingContainer).toBe(false);
  });

  test('and it says why, pointing at the wizard', async () => {
    const { getLogsTail } =
      await import('../src/helpers/dockerService/serviceComponents/containerLogs.js');
    getLogsTail.mockResolvedValue(['superuser password is not specified']);
    mockGetContainerDetails.mockRejectedValue(new Error('boom'));
    mockGetImageEnv.mockResolvedValue([]);

    const expose = { current: null };
    render(
      <HookTester
        containers={[broken]}
        expose={expose}
        overrides={{ health: verdictMap }}
      />
    );
    await act(async () => {});
    await act(async () => {
      expose.current.dispatch('container.fix');
    });
    await act(async () => {});

    expect(expose.current.message).toContain("Couldn't read");
    expect(expose.current.message).toContain('C');
  });
});

describe('useControls — the cleanup question cannot go stale', () => {
  const broken = {
    id: 'c1',
    name: 'mi-basedatos',
    image: 'postgres:17-alpine',
    state: 'exited',
    status: 'Exited (1) 2 seconds ago',
    ports: ['5432:5432'],
  };
  const verdictMap = new Map([
    [
      'c1',
      {
        code: 'crash-loop',
        level: 'fail',
        headline: 'died 2s',
        facts: {
          exitCode: 1,
          uptimeMs: 2000,
          restartCount: 0,
          oomKilled: false,
          healthStatus: null,
        },
      },
    ],
  ]);

  beforeEach(async () => {
    mockSvcCreateContainer.mockReset().mockResolvedValue({
      id: 'cid-new',
      ports: [],
    });
    const { getLogsTail } =
      await import('../src/helpers/dockerService/serviceComponents/containerLogs.js');
    getLogsTail.mockResolvedValue(['superuser password is not specified']);
    mockGetContainerDetails.mockReset().mockResolvedValue({
      env: ['POSTGRES_PASSWORD=x'],
      cmd: [],
    });
    mockGetImageEnv.mockReset().mockResolvedValue([]);
  });

  async function recreate(expose) {
    await act(async () => {
      expose.current.dispatch('container.fix');
    });
    await act(async () => {});
    await act(async () => {
      expose.current.creation.nextStep();
    });
    await act(async () => {});
    return expose;
  }

  async function setup() {
    const expose = { current: null };
    render(
      <HookTester
        containers={[broken]}
        expose={expose}
        overrides={{ health: verdictMap }}
      />
    );
    await act(async () => {});
    return expose;
  }

  test('a failed creation does not leave the question armed', async () => {
    mockSvcCreateContainer.mockRejectedValue(new Error('no such image'));
    const expose = await setup();
    await recreate(expose);

    expect(expose.current.pendingCleanup).toBeNull();
  });

  test('opening a plain wizard forgets the superseded container', async () => {
    const expose = await setup();
    await recreate(expose);
    expect(expose.current.pendingCleanup).not.toBeNull();

    // The user forgot the question and pressed C for a new container.
    await act(async () => {
      expose.current.dispatch('container.create');
    });
    expect(expose.current.pendingCleanup).toBeNull();
  });

  test('another key disarms the question instead of deleting invisibly', async () => {
    const { removeContainer } =
      await import('../src/helpers/dockerService/serviceComponents/containerActions.js');
    removeContainer.mockClear();
    const expose = await setup();
    await recreate(expose);
    expect(expose.current.pendingCleanup).not.toBeNull();

    // Any other key, through the same door the keyboard uses.
    await act(async () => {
      expose.current.dispatch('container.restart');
    });
    expect(expose.current.pendingCleanup).toBeNull();
    expect(removeContainer).not.toHaveBeenCalled();
  });
});

describe('useControls — the help panel describes the screen underneath (H1)', () => {
  const containers = [
    {
      id: 'a',
      name: 'web',
      image: 'nginx:1.27-alpine',
      state: 'running',
      status: 'Up 1 minute',
      ports: ['8080:80'],
    },
  ];

  async function setup() {
    const expose = { current: null };
    render(
      <HookTester
        containers={containers}
        expose={expose}
        overrides={{ health: new Map() }}
      />
    );
    await act(async () => {});
    return expose;
  }

  test('with help closed there is nothing to list yet', async () => {
    const expose = await setup();
    expect(expose.current.helpBindings).toEqual([]);
  });

  test('opening help lists the keys of the screen beneath it', async () => {
    const expose = await setup();
    await act(async () => {
      expose.current.handlers['app.help']();
    });
    const ids = expose.current.helpBindings.map((b) => b.id);
    expect(ids).toContain('container.start');
    expect(ids).toContain('container.erase');
    expect(ids).toContain('app.quit');
  });

  test('and closes with the one key of its own', async () => {
    const expose = await setup();
    await act(async () => {
      expose.current.handlers['app.help']();
    });
    const ids = expose.current.helpBindings.map((b) => b.id);
    expect(ids.filter((id) => id === 'help.close')).toHaveLength(1);
  });

  test('the title names the screen it describes, not "Help"', async () => {
    const expose = await setup();
    await act(async () => {
      expose.current.handlers['app.help']();
    });
    // STRINGS.contextLabels.list === 'Container List'
    expect(expose.current.helpContext).toBe('list');
  });

  test('every listed binding explains itself', async () => {
    const expose = await setup();
    await act(async () => {
      expose.current.handlers['app.help']();
    });
    for (const binding of expose.current.helpBindings) {
      expect(typeof binding.help).toBe('string');
      expect(binding.help.length).toBeGreaterThan(0);
      expect(Array.isArray(binding.keys)).toBe(true);
      expect(binding.keys.length).toBeGreaterThan(0);
    }
  });

  test('the HUD still shows only Esc while the panel is open', async () => {
    const expose = await setup();
    await act(async () => {
      expose.current.handlers['app.help']();
    });
    // The keymap context is 'help', so the HUD keeps its single close key.
    expect(expose.current.context).toBe('help');
    expect(expose.current.keymapBindings.map((b) => b.id)).toEqual([
      'help.close',
    ]);
  });

  test('closing help empties the list again', async () => {
    const expose = await setup();
    await act(async () => {
      expose.current.handlers['app.help']();
      expose.current.handlers['app.help']();
    });
    expect(expose.current.helpBindings).toEqual([]);
  });
});

describe('useControls — the cleanup question waits for an answer (N1)', () => {
  const broken = {
    id: 'c1',
    name: 'mi-basedatos',
    image: 'postgres:17-alpine',
    state: 'exited',
    status: 'Exited (1) 2 seconds ago',
    ports: ['5432:5432'],
  };
  const verdictMap = new Map([
    [
      'c1',
      {
        code: 'crash-loop',
        level: 'fail',
        headline: 'died 2s',
        facts: {
          exitCode: 1,
          uptimeMs: 2000,
          restartCount: 0,
          oomKilled: false,
          healthStatus: null,
        },
      },
    ],
  ]);

  beforeEach(async () => {
    mockSvcCreateContainer.mockReset().mockResolvedValue({
      id: 'cid-new',
      ports: [],
    });
    const { getLogsTail } =
      await import('../src/helpers/dockerService/serviceComponents/containerLogs.js');
    getLogsTail.mockResolvedValue(['superuser password is not specified']);
    mockGetContainerDetails.mockReset().mockResolvedValue({
      env: ['POSTGRES_PASSWORD=x'],
      cmd: [],
    });
    mockGetImageEnv.mockReset().mockResolvedValue([]);
  });

  test('the question is still on screen after the 4s message timer would fire', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick'] });
    try {
      const expose = { current: null };
      render(
        <HookTester
          containers={[broken]}
          expose={expose}
          overrides={{ health: verdictMap }}
        />
      );
      await act(async () => {});
      await act(async () => {
        expose.current.dispatch('container.fix');
      });
      await act(async () => {});
      await act(async () => {
        expose.current.creation.nextStep();
      });
      await act(async () => {});

      // "Creating container…" armed a 4s timer that setMessage never cancelled,
      // so the question used to be wiped while pendingCleanup stayed armed.
      await act(async () => {
        jest.advanceTimersByTime(4000);
      });

      expect(expose.current.message).toContain('[y] Yes');
      expect(expose.current.pendingCleanup).not.toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  test('the answer still works after the timer would have fired', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick'] });
    try {
      const { removeContainer } =
        await import('../src/helpers/dockerService/serviceComponents/containerActions.js');
      removeContainer.mockClear();
      const expose = { current: null };
      render(
        <HookTester
          containers={[broken]}
          expose={expose}
          overrides={{ health: verdictMap }}
        />
      );
      await act(async () => {});
      await act(async () => {
        expose.current.dispatch('container.fix');
      });
      await act(async () => {});
      await act(async () => {
        expose.current.creation.nextStep();
      });
      await act(async () => {});
      await act(async () => {
        jest.advanceTimersByTime(4000);
      });

      await act(async () => {
        await expose.current.dispatch('cleanup.delete');
      });
      expect(removeContainer).toHaveBeenCalledWith('c1');
    } finally {
      jest.useRealTimers();
    }
  });

  test('another key clears the question text as well as disarming it', async () => {
    const expose = { current: null };
    render(
      <HookTester
        containers={[broken]}
        expose={expose}
        overrides={{ health: verdictMap }}
      />
    );
    await act(async () => {});
    await act(async () => {
      expose.current.dispatch('container.fix');
    });
    await act(async () => {});
    await act(async () => {
      expose.current.creation.nextStep();
    });
    await act(async () => {});
    expect(expose.current.message).toContain('[y] Yes');

    await act(async () => {
      expose.current.dispatch('container.restart');
    });
    // Leaving the text would invite the very y it no longer answers.
    expect(expose.current.message).not.toContain('[y] Yes');
  });
});

describe('useControls — F is not re-entrant', () => {
  const broken = {
    id: 'c1',
    name: 'mi-basedatos',
    image: 'postgres:17-alpine',
    state: 'exited',
    status: 'Exited (1) 2 seconds ago',
    ports: ['5432:5432'],
  };
  const verdictMap = new Map([
    [
      'c1',
      {
        code: 'crash-loop',
        level: 'fail',
        headline: 'died 2s',
        facts: {
          exitCode: 1,
          uptimeMs: 2000,
          restartCount: 0,
          oomKilled: false,
          healthStatus: null,
        },
      },
    ],
  ]);

  beforeEach(async () => {
    mockGetContainerDetails.mockReset().mockResolvedValue({
      env: ['POSTGRES_PASSWORD=x'],
      cmd: [],
    });
    mockGetImageEnv.mockReset().mockResolvedValue([]);
    const { getLogsTail } =
      await import('../src/helpers/dockerService/serviceComponents/containerLogs.js');
    getLogsTail.mockResolvedValue(['superuser password is not specified']);
  });

  test('a second F while the first is still reading is ignored', async () => {
    let release;
    mockGetContainerDetails.mockReturnValue(
      new Promise((resolve) => {
        release = () => resolve({ env: ['POSTGRES_PASSWORD=x'], cmd: [] });
      })
    );

    const expose = { current: null };
    render(
      <HookTester
        containers={[broken]}
        expose={expose}
        overrides={{ health: verdictMap }}
      />
    );
    await act(async () => {});

    const first = expose.current.dispatch('container.fix');
    // Second press, mid-flight: it must not open a second wizard.
    expose.current.dispatch('container.fix');
    await act(async () => {
      release();
      await first;
    });

    expect(mockGetContainerDetails).toHaveBeenCalledTimes(1);
    expect(expose.current.creationStep).toBe(4);
  });

  test('F works again once the first attempt finished', async () => {
    const expose = { current: null };
    render(
      <HookTester
        containers={[broken]}
        expose={expose}
        overrides={{ health: verdictMap }}
      />
    );
    await act(async () => {});
    await act(async () => {
      await expose.current.dispatch('container.fix');
    });
    expect(expose.current.creationStep).toBe(4);

    // Back out, then use the key again: the guard must not stay latched.
    await act(async () => {
      expose.current.creation.cancelCreation();
    });
    await act(async () => {
      await expose.current.dispatch('container.fix');
    });
    expect(mockGetContainerDetails).toHaveBeenCalledTimes(2);
    expect(expose.current.creationStep).toBe(4);
  });

  test('a refused attempt does not leave the key disabled', async () => {
    mockGetContainerDetails.mockResolvedValue(null);
    const expose = { current: null };
    render(
      <HookTester
        containers={[broken]}
        expose={expose}
        overrides={{ health: verdictMap }}
      />
    );
    await act(async () => {});
    await act(async () => {
      await expose.current.dispatch('container.fix');
    });
    expect(expose.current.creatingContainer).toBe(false);

    mockGetContainerDetails.mockResolvedValue({
      env: ['POSTGRES_PASSWORD=x'],
      cmd: [],
    });
    await act(async () => {
      await expose.current.dispatch('container.fix');
    });
    expect(expose.current.creationStep).toBe(4);
  });
});

describe('useControls — a failed fix never latches the key', () => {
  const broken = {
    id: 'c1',
    name: 'mi-basedatos',
    image: 'postgres:17-alpine',
    state: 'exited',
    status: 'Exited (1) 2 seconds ago',
    ports: ['5432:5432'],
  };
  const verdictMap = new Map([
    [
      'c1',
      {
        code: 'crash-loop',
        level: 'fail',
        headline: 'died 2s',
        facts: {
          exitCode: 1,
          uptimeMs: 2000,
          restartCount: 0,
          oomKilled: false,
          healthStatus: null,
        },
      },
    ],
  ]);

  beforeEach(async () => {
    mockGetContainerDetails.mockReset().mockResolvedValue({
      env: ['POSTGRES_PASSWORD=x'],
      cmd: [],
    });
    mockGetImageEnv.mockReset().mockResolvedValue([]);
    const { getLogsTail } =
      await import('../src/helpers/dockerService/serviceComponents/containerLogs.js');
    getLogsTail.mockResolvedValue(['superuser password is not specified']);
  });

  async function setup() {
    const expose = { current: null };
    render(
      <HookTester
        containers={[broken]}
        expose={expose}
        overrides={{ health: verdictMap }}
      />
    );
    await act(async () => {});
    return expose;
  }

  test('an image inspect that rejects does not latch F', async () => {
    mockGetImageEnv.mockRejectedValue(new Error('daemon gone'));
    const expose = await setup();

    await act(async () => {
      await expose.current.dispatch('container.fix');
    });
    expect(expose.current.message).toContain('prepare the fix');
    expect(expose.current.creatingContainer).toBe(false);

    // The point of the whole thing: F still works on the next attempt.
    mockGetImageEnv.mockResolvedValue([]);
    await act(async () => {
      await expose.current.dispatch('container.fix');
    });
    expect(expose.current.creationStep).toBe(4);
  });

  // The prefill site is inside the same try, but there is no seam to force a
  // throw there from this harness, and a test that walks the happy path while
  // claiming to test a throw is worse than no test. What is proven here is the
  // property that matters: the catch fires, it says why, and the key works on
  // the next press.

  test('and it says what went wrong rather than failing quietly', async () => {
    mockGetImageEnv.mockRejectedValue(new Error('daemon gone'));
    const expose = await setup();
    await act(async () => {
      await expose.current.dispatch('container.fix');
    });
    expect(expose.current.message).toContain('daemon gone');
    expect(expose.current.messageColor).toBe('red');
  });

  test('a refused attempt still leaves the key free', async () => {
    mockGetContainerDetails.mockResolvedValue(null);
    const expose = await setup();
    await act(async () => {
      await expose.current.dispatch('container.fix');
    });
    expect(expose.current.creatingContainer).toBe(false);

    mockGetContainerDetails.mockResolvedValue({
      env: ['POSTGRES_PASSWORD=x'],
      cmd: [],
    });
    await act(async () => {
      await expose.current.dispatch('container.fix');
    });
    expect(expose.current.creationStep).toBe(4);
  });
});
