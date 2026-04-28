/**
 * Docker Hub search helper.
 * Pure function — no side effects beyond HTTP. All state management
 * lives in the calling hook (useContainerCreation).
 */

const DOCKER_HUB_SEARCH_URL =
  'https://hub.docker.com/v2/search/repositories/';

/**
 * Format a Docker Hub search result object into a display string.
 *
 * Format rules:
 *   - Official: "name [★ official] [Npulls+]" (if pullCount > 0)
 *   - Non-official with pulls: "name [Npulls+]"
 *   - Otherwise: "name"
 *
 * Pull count suffixes: ≥1B → "1B+", ≥1M → "1M+", ≥1K → "1K+", else raw number
 *
 * @param {{ name: string, isOfficial: boolean, pullCount: number }} result
 * @returns {string}
 */
export function formatHubResult(result) {
  const { name, isOfficial, pullCount } = result;

  let pullSuffix = '';
  if (pullCount >= 1e9) {
    pullSuffix = ` [1B+ pulls]`;
  } else if (pullCount >= 1e6) {
    pullSuffix = ` [${Math.floor(pullCount / 1e6)}M+ pulls]`;
  } else if (pullCount >= 1e3) {
    pullSuffix = ` [${Math.floor(pullCount / 1e3)}K+ pulls]`;
  } else if (pullCount > 0) {
    pullSuffix = ` [${pullCount} pulls]`;
  }

  if (isOfficial) {
    return `${name} [★ official]${pullSuffix}`;
  }

  return `${name}${pullSuffix}`;
}

/**
 * Search Docker Hub for images matching the given query.
 *
 * @param {string} query - Search term (will be trimmed and encoded)
 * @param {Object} [options]
 * @param {AbortSignal} [options.signal] - Abort signal; defaults to AbortSignal.timeout(5000)
 * @returns {Promise<Array<{ name: string, isOfficial: boolean, pullCount: number, description: string }>>}
 * @throws {Error} If response.ok is false or the network call rejects
 */
export async function searchDockerHub(query, options = {}) {
  const q = query.trim();
  if (!q) return [];

  const url = `${DOCKER_HUB_SEARCH_URL}?query=${encodeURIComponent(q)}&page_size=10`;
  const signal = options.signal ?? AbortSignal.timeout(5000);

  const response = await fetch(url, { signal });

  if (!response.ok) {
    throw new Error(`Docker Hub search failed: ${response.status}`);
  }

  const data = await response.json();
  const results = data.results ?? [];

  return results.map((item) => ({
    name: item.repo_name,
    isOfficial: item.is_official,
    pullCount: item.pull_count,
    description: item.short_description,
  }));
}
