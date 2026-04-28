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
  useInput: (fn) => { _inputHandler = fn; },
  useApp: () => ({ exit: () => {} }),
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

// Mock getLogsStream to avoid side effects
await jest.unstable_mockModule(
  '../src/helpers/dockerService/serviceComponents/containerLogs.js',
  () => ({ getLogsStream: () => {} })
);

const { useControls } = await import('../src/hooks/useControls.js');

function HookTester({ containers, expose, overrides }) {
  const hook = useControls(containers, overrides);
  useEffect(() => {
    if (expose) expose.current = hook;
  });
  return null;
}

// Helper: advance creation wizard to the final step and trigger onCreate
async function completeCreationWizard(expose, imageName = 'nginx') {
  act(() => { expose.current.creation.setImageName(imageName); });
  act(() => { expose.current.creation.nextStep(); }); // step 0 → 1
  act(() => { expose.current.creation.nextStep(); }); // step 1 → 2
  act(() => { expose.current.creation.nextStep(); }); // step 2 → 3
  // step 3: call nextStep to trigger onCreate (async)
  await act(async () => { expose.current.creation.nextStep(); });
}

describe('useControls (FR6 — port mapping in success message)', () => {
  beforeEach(() => {
    mockSvcCreateContainer.mockReset();
  });

  test('success message includes port mapping after container creation', async () => {
    const ports = [
      { containerPort: '3306', hostPort: '3306', protocol: 'tcp', source: 'auto' },
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
      { containerPort: '80', hostPort: '8080', protocol: 'tcp', source: 'user' },
      { containerPort: '443', hostPort: '8443', protocol: 'tcp', source: 'user' },
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

    act(() => { expose.current.creation.updateImageInput('ng'); });

    expect(expose.current.creation.suggestions).toContain('nginx');
    expect(expose.current.creation.selectedSuggestionIndex).toBe(-1);
  });

  test('moveSuggestionSelection(1) then applyFocusedSuggestion() fills imageName', () => {
    const expose = { current: null };
    render(<HookTester containers={[]} expose={expose} />);

    act(() => { expose.current.creation.updateImageInput('ng'); });
    act(() => { expose.current.creation.moveSuggestionSelection(1); });
    act(() => { expose.current.creation.applyFocusedSuggestion(); });

    expect(expose.current.creation.imageName).toBe('nginx:1.27-alpine');
    expect(expose.current.creation.step).toBe(0);
    expect(expose.current.creation.suggestions).toHaveLength(0);
  });

  test('applyFocusedSuggestion() does not advance step (Enter with focus uses suggestion not nextStep)', () => {
    const expose = { current: null };
    render(<HookTester containers={[]} expose={expose} />);

    act(() => { expose.current.creation.updateImageInput('ng'); });
    act(() => { expose.current.creation.moveSuggestionSelection(1); });
    act(() => { expose.current.creation.applyFocusedSuggestion(); });

    // Step must remain 0 — autocomplete applied, wizard did not advance
    expect(expose.current.creation.step).toBe(0);
  });

  test('nextStep() with imageName set advances to step 1 (normal flow without suggestions)', () => {
    const expose = { current: null };
    render(<HookTester containers={[]} expose={expose} />);

    act(() => { expose.current.creation.setImageName('nginx'); });
    act(() => { expose.current.creation.nextStep(); });

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
    act(() => { triggerInput('c', {}); });
    return expose;
  }

  // ── FR4: ↑/↓ only intercepted on step 0 with suggestions ────────────────

  test('FR4 — ↓ arrow on step 0 with suggestions moves selection down', () => {
    const expose = renderAndStartCreation();

    // Type 'n' to get suggestions (nginx, node, etc.)
    act(() => { triggerInput('n', {}); });
    const suggestionsAfterType = expose.current.creation.suggestions;
    expect(suggestionsAfterType.length).toBeGreaterThan(0);

    act(() => { triggerInput('', { downArrow: true }); });
    expect(expose.current.creation.selectedSuggestionIndex).toBe(0);
  });

  test('FR4 — ↑ arrow on step 0 with suggestions moves selection up', () => {
    const expose = renderAndStartCreation();

    act(() => { triggerInput('n', {}); });
    // Move down twice, then up once → index should be 0
    act(() => { triggerInput('', { downArrow: true }); });
    act(() => { triggerInput('', { downArrow: true }); });
    act(() => { triggerInput('', { upArrow: true }); });
    expect(expose.current.creation.selectedSuggestionIndex).toBe(0);
  });

  test('FR4 — ↑/↓ are ignored on step 0 when suggestions list is empty', () => {
    const expose = renderAndStartCreation();

    // Type something unlikely to match → no suggestions
    act(() => { triggerInput('x', {}); });
    act(() => { triggerInput('x', {}); });
    act(() => { triggerInput('x', {}); });
    expect(expose.current.creation.suggestions).toHaveLength(0);

    act(() => { triggerInput('', { downArrow: true }); });
    // selectedSuggestionIndex stays at -1 (ignored)
    expect(expose.current.creation.selectedSuggestionIndex).toBe(-1);
  });

  test('FR4 — ↑/↓ are ignored when step > 0 (no suggestions navigation on other steps)', () => {
    const expose = renderAndStartCreation();

    // Advance to step 1 by typing an image name and pressing Enter
    act(() => { triggerInput('n', {}); }); // type → imageName='n'
    act(() => { triggerInput('g', {}); }); // type → imageName='ng', suggestions appear
    // Clear suggestions by pressing Escape then re-enter (shortcut: directly set step)
    // Instead, clear imageName and press Enter with no suggestions
    // Set imageName via direct API, advance step
    act(() => { expose.current.creation.setImageName('nginx'); });
    // Simulate Enter (\r) with no focused suggestion → should advance step
    act(() => { triggerInput('\r', {}); });
    expect(expose.current.creation.step).toBe(1);

    const prevSelection = expose.current.creation.selectedSuggestionIndex;
    act(() => { triggerInput('', { downArrow: true }); });
    // selection is unchanged — arrow ignored on step 1
    expect(expose.current.creation.selectedSuggestionIndex).toBe(prevSelection);
  });

  // ── FR5: Enter with focused suggestion → apply, NOT nextStep ─────────────

  test('FR5 — Enter with selectedSuggestionIndex >= 0 applies suggestion and stays on step 0', () => {
    const expose = renderAndStartCreation();

    act(() => { triggerInput('n', {}); }); // type to get suggestions
    expect(expose.current.creation.suggestions.length).toBeGreaterThan(0);

    act(() => { triggerInput('', { downArrow: true }); }); // select first suggestion
    expect(expose.current.creation.selectedSuggestionIndex).toBe(0);

    // Press Enter → should apply suggestion, NOT advance step
    act(() => { triggerInput('\r', {}); });

    expect(expose.current.creation.step).toBe(0);
    expect(expose.current.creation.imageName).not.toBe('');
    expect(expose.current.creation.imageName).not.toBe('n');
  });

  test('FR5 — Enter with focused suggestion does NOT call nextStep (step stays 0)', () => {
    const expose = renderAndStartCreation();

    act(() => { triggerInput('n', {}); });
    act(() => { triggerInput('', { downArrow: true }); }); // focus first

    act(() => { triggerInput('\r', {}); }); // Enter with focus

    // FR5: step must be 0 (nextStep was NOT called)
    expect(expose.current.creation.step).toBe(0);
  });

  // ── FR6: Enter without focused suggestion → nextStep ─────────────────────

  test('FR6 — Enter with selectedSuggestionIndex === -1 advances step', () => {
    const expose = renderAndStartCreation();

    act(() => { expose.current.creation.setImageName('nginx'); });
    // No suggestion focused (index -1)
    expect(expose.current.creation.selectedSuggestionIndex).toBe(-1);

    act(() => { triggerInput('\r', {}); }); // Enter without focus
    expect(expose.current.creation.step).toBe(1);
  });

  test('FR6 — Enter without focus does NOT apply suggestion (imageName unchanged)', () => {
    const expose = renderAndStartCreation();

    act(() => { expose.current.creation.setImageName('nginx'); });

    act(() => { triggerInput('\r', {}); }); // advance to step 1

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
    act(() => { triggerInput('c', {}); });
    // Advance to step 3
    act(() => { expose.current.creation.setImageName('postgres'); });
    act(() => { triggerInput('\r', {}); }); // step 0 → 1
    act(() => { triggerInput('\r', {}); }); // step 1 → 2
    act(() => { triggerInput('\r', {}); }); // step 2 → 3
    expect(expose.current.creation.step).toBe(3);

    act(() => { triggerInput('', { tab: true }); });

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
    act(() => { triggerInput('c', {}); });
    act(() => { expose.current.creation.setImageName('nginx'); });
    act(() => { triggerInput('\r', {}); });
    act(() => { triggerInput('\r', {}); });
    act(() => { triggerInput('\r', {}); });

    // Should not throw
    expect(() => {
      act(() => { triggerInput('', { tab: true }); });
    }).not.toThrow();
  });
});
describe('useControls — FR7 Tab triggers hub search on step 0', () => {
  beforeEach(() => {
    _inputHandler = null;
    mockSvcCreateContainer.mockReset();
  });

  /** Helper: render in creation mode with a triggerHubSearch mock override */
  function renderCreationWithSearch({ isSearchingHub = false, imageName: initialImageName = '' } = {}) {
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
    act(() => { triggerInput('c', {}); });
    // Set imageName if provided
    if (initialImageName) {
      act(() => { expose.current.creation.setImageName(initialImageName); });
    }
    return { expose, mockTriggerHubSearch };
  }

  test('FR7 — Tab on step 0 calls triggerHubSearch()', () => {
    const { mockTriggerHubSearch } = renderCreationWithSearch({ imageName: 'nginx' });

    act(() => { triggerInput('', { tab: true }); });

    expect(mockTriggerHubSearch).toHaveBeenCalledTimes(1);
  });

  test('FR7 — Tab on step 0 when isSearchingHub=true does NOT call triggerHubSearch (guard)', () => {
    const { mockTriggerHubSearch } = renderCreationWithSearch({
      isSearchingHub: true,
      imageName: 'nginx',
    });

    act(() => { triggerInput('', { tab: true }); });

    expect(mockTriggerHubSearch).not.toHaveBeenCalled();
  });

  test('FR7 — Tab on step 0 when imageName is empty string does NOT call triggerHubSearch (guard)', () => {
    const { mockTriggerHubSearch } = renderCreationWithSearch({ imageName: '' });

    act(() => { triggerInput('', { tab: true }); });

    expect(mockTriggerHubSearch).not.toHaveBeenCalled();
  });

  test('FR7 — Tab on step > 0 does NOT call triggerHubSearch (only active on step 0)', () => {
    const { expose, mockTriggerHubSearch } = renderCreationWithSearch({ imageName: 'nginx' });

    // Advance to step 1
    act(() => { triggerInput('\r', {}); });
    expect(expose.current.creation.step).toBe(1);

    act(() => { triggerInput('', { tab: true }); });

    expect(mockTriggerHubSearch).not.toHaveBeenCalled();
  });
});
