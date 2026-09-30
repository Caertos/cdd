// Jest config for end-to-end tests against a REAL Docker daemon.
// Extends the base config but:
//   - un-mocks `ink` (ink-testing-library needs real Ink to render frames)
//   - runs only test/e2e/**/*.e2e.test.js
//   - serializes execution (maxWorkers: 1) and raises the per-test timeout
//     (an image pull can exceed Jest's 5 s default).
const base = require('./jest.config.cjs');

module.exports = {
  ...base,
  displayName: 'e2e',
  testEnvironment: 'node',

  // Ink REAL: override the base config's mapping to __mocks__/ink.cjs.
  // Keep the indent-string override: dockerode's socket registry dependency
  // is dual ESM/CJS and Jest must hit index.cjs (same reason as the base).
  moduleNameMapper: {
    '^indent-string$': '<rootDir>/__mocks__/indent-string.cjs',
  },

  // Only the E2E suite, and only from its own directory.
  testPathIgnorePatterns: ['/node_modules/'],
  testMatch: ['<rootDir>/test/e2e/**/*.e2e.test.js'],

  // A pull can take a while; the default 5 s is too short.
  testTimeout: 120000,
  maxWorkers: 1,

  // Measured (Fase 0): App intervals are cleaned up by unmount(), so the
  // original withTimeout() reason for forceExit is gone. BUT the
  // connectionDown suite points DOCKER_HOST at a dead socket, and docker-modem
  // leaves a dangling connection that logs after the suite ends ("Cannot log
  // after tests are done", exit 1). forceExit keeps the runner from hanging on
  // that expected dead-socket handle.
  forceExit: true,
};
