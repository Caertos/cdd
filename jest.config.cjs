module.exports = {
  testEnvironment: 'node',
  // Without this, a .jsx is loaded as CJS and cannot import local .js helpers
  // (package.json declares "type": "module").
  extensionsToTreatAsEsm: ['.jsx'],
  setupFilesAfterEnv: ['./test/jest.setup.js'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text-summary', 'lcov', 'json-summary'],
  // index.js and App.jsx are bootstrap/composition with no logic of their own.
  collectCoverageFrom: ['src/**/*.{js,jsx}', '!src/index.js', '!src/App.jsx'],
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
