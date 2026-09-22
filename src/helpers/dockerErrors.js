import { STRINGS } from './strings.js';

/**
 * @typedef {'not-running'|'permission'|'timeout'|'unknown'} DockerErrorKind
 *
 * @typedef {Object} DockerErrorInfo
 * @property {DockerErrorKind} kind
 * @property {string} title      - Short headline
 * @property {string} detail     - One or two sentence explanation
 * @property {string[]} hints    - Concrete fix suggestions, adapted to platform
 * @property {string} technical  - Original error message, for the footer
 */

/** Maps error kind (kebab-case) to STRINGS.connection key (camelCase). */
const KIND_TO_KEY = {
  'not-running': 'notRunning',
  permission: 'permission',
  timeout: 'timeout',
  unknown: 'unknown',
};

/**
 * Classify a Docker connection error into a user-presentable category.
 * Pure function: receives platform as an argument so it can be tested without Docker.
 *
 * @param {Error & {code?: string, statusCode?: number}} err
 * @param {string} [platform=process.platform]
 * @returns {DockerErrorInfo}
 */
export function classifyDockerError(err, platform = process.platform) {
  const code = err.code;
  const msg = err.message ?? '';

  let kind;

  if (code === 'ENOENT' || code === 'ECONNREFUSED') {
    kind = 'not-running';
  } else if (code === 'EACCES' || code === 'EPERM' || err.statusCode === 403) {
    kind = 'permission';
  } else if (code === 'ETIMEDOUT' || /operation timed out/i.test(msg)) {
    kind = 'timeout';
  } else {
    kind = 'unknown';
  }

  const template = STRINGS.connection[KIND_TO_KEY[kind]];

  return {
    kind,
    title: template.title,
    detail: template.detail,
    hints: template.hints[platform] ?? template.hints.linux,
    technical: `${code ? code + ': ' : ''}${msg}`,
  };
}
