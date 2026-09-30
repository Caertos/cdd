module.exports = {
  testEnvironment: 'node',
  // Without this, a .jsx is loaded as CJS and cannot import local .js helpers
  // (package.json declares "type": "module").
  extensionsToTreatAsEsm: ['.jsx'],
  setupFilesAfterEnv: ['./test/jest.setup.js'],
  // E2E tests live in test/e2e/ and run against a REAL Docker daemon via
  // jest.config.e2e.cjs; keep them out of the fast unit suite (`pnpm test`).
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/test/e2e/'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text-summary', 'lcov', 'json-summary'],
  // index.js and App.jsx are bootstrap/composition with no logic of their own.
  collectCoverageFrom: ['src/**/*.{js,jsx}', '!src/index.js', '!src/App.jsx'],
  // Floors = coverage measured on 2026-09-30 (rounded down), so it cannot drop.
  // Only enforced by `pnpm test:coverage`; plain `pnpm test` does not collect.
  // With a path entry, Jest measures `global` over everything outside it
  // (components + hooks here).
  coverageThreshold: {
    global: { statements: 71, branches: 68, functions: 65, lines: 72 },
    './src/helpers/': { statements: 96, branches: 91, functions: 96, lines: 98 },
  },
  transform: {
    '^.+\\.[tj]sx?$': 'babel-jest'
  },
  // Allow babel-jest to transform ESM-only packages used by components
  transformIgnorePatterns: [
    '/node_modules/(?!(ink|ink-testing-library|ansi-styles|chalk|cli-cursor|cli-spinners|is-unicode-supported|restore-cursor|signal-exit|slice-ansi|strip-ansi|wrap-ansi|yoga-layout-prebuilt)/)'
  ],
  moduleNameMapper: {
    '^ink$': '<rootDir>/__mocks__/ink.cjs',
    // Socket override is dual ESM/CJS; Jest require must hit index.cjs
    '^indent-string$': '<rootDir>/__mocks__/indent-string.cjs'
  }
};
