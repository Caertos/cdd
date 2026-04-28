/**
 * @jest-environment node
 */
import { jest } from '@jest/globals';
import { formatHubResult } from '../src/helpers/dockerHubService.js';

// We mock fetch at the global level using jest.spyOn
// The module under test is imported dynamically after spy setup

describe('searchDockerHub — unit tests', () => {
  let searchDockerHub;
  let fetchSpy;

  beforeEach(async () => {
    // Reset modules so each test gets fresh state
    jest.resetModules();
    // Dynamically import after setting up spy
    ({ searchDockerHub } = await import('../src/helpers/dockerHubService.js'));
  });

  afterEach(() => {
    if (fetchSpy) fetchSpy.mockRestore();
    fetchSpy = null;
  });

  // ── 1. Query trim & encode ──────────────────────────────────────────────

  test('trims whitespace from query before encoding', async () => {
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    });

    await searchDockerHub('  nginx  ');

    const calledUrl = fetchSpy.mock.calls[0][0];
    expect(calledUrl).toContain('query=nginx');
    expect(calledUrl).not.toContain('query=+nginx');
    expect(calledUrl).not.toContain('  ');
  });

  test('encodes special characters in query', async () => {
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    });

    await searchDockerHub('hello world');

    const calledUrl = fetchSpy.mock.calls[0][0];
    expect(calledUrl).toContain('query=hello%20world');
  });

  test('returns [] immediately for empty query (no fetch call)', async () => {
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    });

    const result = await searchDockerHub('   ');

    expect(result).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // ── 2. AbortSignal.timeout(5000) default ──────────────────────────────

  test('uses AbortSignal.timeout(5000) by default when no signal provided', async () => {
    const timeoutSignalSpy = jest.spyOn(AbortSignal, 'timeout');
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    });

    await searchDockerHub('nginx');

    expect(timeoutSignalSpy).toHaveBeenCalledWith(5000);
    timeoutSignalSpy.mockRestore();
  });

  test('does NOT call AbortSignal.timeout when signal is injected', async () => {
    const timeoutSignalSpy = jest.spyOn(AbortSignal, 'timeout');
    const controller = new AbortController();
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    });

    await searchDockerHub('nginx', { signal: controller.signal });

    expect(timeoutSignalSpy).not.toHaveBeenCalled();
    timeoutSignalSpy.mockRestore();
  });

  // ── 3. Injected signal is passed to fetch ──────────────────────────────

  test('passes injected signal to fetch', async () => {
    const controller = new AbortController();
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    });

    await searchDockerHub('nginx', { signal: controller.signal });

    const fetchOptions = fetchSpy.mock.calls[0][1];
    expect(fetchOptions.signal).toBe(controller.signal);
  });

  // ── 4. Result mapping ──────────────────────────────────────────────────

  test('maps results to normalized objects with name, isOfficial, pullCount, description', async () => {
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            repo_name: 'library/nginx',
            is_official: true,
            pull_count: 1000000000,
            short_description: 'Official nginx image',
          },
          {
            repo_name: 'bitnami/nginx',
            is_official: false,
            pull_count: 50000000,
            short_description: 'Bitnami nginx image',
          },
        ],
      }),
    });

    const results = await searchDockerHub('nginx');

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      name: 'library/nginx',
      isOfficial: true,
      pullCount: 1000000000,
      description: 'Official nginx image',
    });
    expect(results[1]).toEqual({
      name: 'bitnami/nginx',
      isOfficial: false,
      pullCount: 50000000,
      description: 'Bitnami nginx image',
    });
  });

  test('returns empty array when results is missing from response', async () => {
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    const results = await searchDockerHub('nginx');
    expect(results).toEqual([]);
  });

  // ── 5. Non-OK rejection ────────────────────────────────────────────────

  test('throws when response.ok is false', async () => {
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({}),
    });

    await expect(searchDockerHub('nginx')).rejects.toThrow(
      'Docker Hub search failed: 429'
    );
  });

  test('re-throws AbortError from fetch', async () => {
    const abortErr = new DOMException('Aborted', 'AbortError');
    fetchSpy = jest.spyOn(global, 'fetch').mockRejectedValue(abortErr);

    await expect(searchDockerHub('nginx')).rejects.toThrow('Aborted');
  });
});

describe('formatHubResult — unit tests', () => {
  test('official repo includes [★ official]', () => {
    const result = formatHubResult({ name: 'library/nginx', isOfficial: true, pullCount: 0 });
    expect(result).toContain('[★ official]');
    expect(result).toContain('library/nginx');
  });

  test('high pull count (≥1B) is formatted as 1B+', () => {
    const result = formatHubResult({ name: 'nginx', isOfficial: true, pullCount: 1e9 });
    expect(result).toContain('[1B+ pulls]');
  });

  test('pull count ≥1M is formatted as NM+', () => {
    const result = formatHubResult({ name: 'myimage', isOfficial: false, pullCount: 500e6 });
    expect(result).toContain('[500M+ pulls]');
  });

  test('pull count ≥1K is formatted as NK+', () => {
    const result = formatHubResult({ name: 'myimage', isOfficial: false, pullCount: 500e3 });
    expect(result).toContain('[500K+ pulls]');
  });

  test('no pull count → just name (no suffix)', () => {
    const result = formatHubResult({ name: 'myimage', isOfficial: false, pullCount: 0 });
    expect(result).toBe('myimage');
  });

  test('unofficial + low pull count → just name with raw count', () => {
    const result = formatHubResult({ name: 'myimage', isOfficial: false, pullCount: 42 });
    expect(result).toBe('myimage [42 pulls]');
  });
});
