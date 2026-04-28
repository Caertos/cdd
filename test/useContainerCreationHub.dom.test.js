/**
 * @jest-environment jsdom
 *
 * Tests for Hub-search additions to useContainerCreation:
 *   - isSearchingHub state
 *   - hubResults state (string[] after formatHubResult mapping)
 *   - triggerHubSearch() guards (empty input, already searching)
 *   - stale response ignored via requestId
 *   - updateImageInput() aborts in-flight search and clears hubResults
 */
import React, { useEffect } from 'react';
import { render, act } from '@testing-library/react';
import { jest } from '@jest/globals';

// ── Mock dockerHubService BEFORE any import that might pull it in ─────────────
jest.unstable_mockModule('../src/helpers/dockerHubService.js', () => ({
  searchDockerHub: jest.fn(),
  formatHubResult: jest.fn((r) => r.name), // identity-like stub: returns name string
}));

// Dynamic import resolves AFTER jest.unstable_mockModule is registered
const { useContainerCreation } = await import('../src/hooks/creation/useContainerCreation.js');
const { searchDockerHub } = await import('../src/helpers/dockerHubService.js');

const mockSearchDockerHub = searchDockerHub;

// ── Test harness ─────────────────────────────────────────────────────────────

function HookTester({ onCreate, onCancel, dbImages, imageProfiles, expose }) {
  const hook = useContainerCreation({
    onCreate: onCreate ?? (() => {}),
    onCancel: onCancel ?? (() => {}),
    dbImages: dbImages ?? [],
    imageProfiles: imageProfiles ?? {},
  });
  useEffect(() => {
    if (expose) expose.current = hook;
  });
  return null;
}

function makeExpose() {
  const expose = { current: null };
  render(<HookTester expose={expose} />);
  return expose;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useContainerCreation — Hub search state', () => {
  beforeEach(() => {
    mockSearchDockerHub.mockReset();
  });

  test('exposes isSearchingHub (initially false) and hubResults (initially null)', () => {
    const expose = makeExpose();

    expect(expose.current.isSearchingHub).toBe(false);
    expect(expose.current.hubResults).toBeNull();
  });

  test('triggerHubSearch() ignores empty imageName', async () => {
    const expose = makeExpose();
    // imageName is '' by default
    await act(async () => {
      expose.current.triggerHubSearch();
    });
    expect(mockSearchDockerHub).not.toHaveBeenCalled();
    expect(expose.current.isSearchingHub).toBe(false);
  });

  test('triggerHubSearch() sets isSearchingHub=true during the request', async () => {
    const expose = makeExpose();
    let resolveSearch;
    mockSearchDockerHub.mockReturnValue(
      new Promise((res) => { resolveSearch = res; })
    );

    act(() => { expose.current.updateImageInput('nginx'); });

    let searchPromise;
    act(() => { searchPromise = expose.current.triggerHubSearch(); });

    expect(expose.current.isSearchingHub).toBe(true);

    await act(async () => { resolveSearch([]); await searchPromise; });
    expect(expose.current.isSearchingHub).toBe(false);
  });

  test('triggerHubSearch() ignores call when isSearchingHub is already true', async () => {
    const expose = makeExpose();
    let resolveFirst;
    mockSearchDockerHub.mockReturnValue(
      new Promise((res) => { resolveFirst = res; })
    );

    act(() => { expose.current.updateImageInput('nginx'); });
    act(() => { expose.current.triggerHubSearch(); }); // first call — now searching
    expect(expose.current.isSearchingHub).toBe(true);

    // second call — should be ignored
    act(() => { expose.current.triggerHubSearch(); });
    expect(mockSearchDockerHub).toHaveBeenCalledTimes(1);

    // cleanup
    await act(async () => { resolveFirst([]); });
  });

  test('triggerHubSearch() stores formatted results (strings) in hubResults on success', async () => {
    const expose = makeExpose();
    const fakeResults = [
      { name: 'library/nginx', isOfficial: true, pullCount: 1e9, description: 'official' },
    ];
    mockSearchDockerHub.mockResolvedValue(fakeResults);

    act(() => { expose.current.updateImageInput('nginx'); });
    await act(async () => { await expose.current.triggerHubSearch(); });

    // hubResults should be string[] (after formatHubResult mapping)
    expect(Array.isArray(expose.current.hubResults)).toBe(true);
    expect(expose.current.hubResults).toHaveLength(1);
    expect(typeof expose.current.hubResults[0]).toBe('string');
    expect(expose.current.isSearchingHub).toBe(false);
  });

  test('stale response is ignored — only the latest requestId wins', async () => {
    const expose = makeExpose();

    let resolveFirst;
    let resolveSecond;

    mockSearchDockerHub
      .mockReturnValueOnce(new Promise((res) => { resolveFirst = res; }))
      .mockReturnValueOnce(new Promise((res) => { resolveSecond = res; }));

    act(() => { expose.current.updateImageInput('nginx'); });
    act(() => { expose.current.triggerHubSearch(); }); // request #1 starts, isSearchingHub=true

    // Simulate user typing (aborts #1, clears hub state)
    act(() => { expose.current.updateImageInput('ngi'); });
    // Now trigger again (request #2)
    act(() => { expose.current.triggerHubSearch(); });

    const secondResults = [{ name: 'ngi/x', isOfficial: false, pullCount: 0, description: '' }];

    // Resolve second first (fresh), then first (stale)
    await act(async () => { resolveSecond(secondResults); });
    await act(async () => { resolveFirst([{ name: 'stale', isOfficial: false, pullCount: 0, description: '' }]); });

    // Only second results should be stored (as strings)
    expect(Array.isArray(expose.current.hubResults)).toBe(true);
    expect(expose.current.hubResults).toHaveLength(1);
    expect(expose.current.hubResults[0]).toBe('ngi/x');
  });

  test('updateImageInput() clears hubResults and sets isSearchingHub=false', async () => {
    const expose = makeExpose();
    mockSearchDockerHub.mockResolvedValue([
      { name: 'library/nginx', isOfficial: true, pullCount: 1e9, description: '' },
    ]);

    act(() => { expose.current.updateImageInput('nginx'); });
    await act(async () => { await expose.current.triggerHubSearch(); });
    expect(expose.current.hubResults).not.toBeNull();

    // Typing clears Hub results
    act(() => { expose.current.updateImageInput('nginy'); });
    expect(expose.current.hubResults).toBeNull();
    expect(expose.current.isSearchingHub).toBe(false);
  });

  test('failed Hub search (non-abort) sets hubResults=null silently', async () => {
    const expose = makeExpose();
    mockSearchDockerHub.mockRejectedValue(new Error('Network Error'));

    act(() => { expose.current.updateImageInput('nginx'); });
    await act(async () => {
      try { await expose.current.triggerHubSearch(); } catch (_) { /* silenced */ }
    });

    expect(expose.current.hubResults).toBeNull();
    expect(expose.current.isSearchingHub).toBe(false);
  });
});
