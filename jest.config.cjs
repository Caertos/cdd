module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['./test/jest.setup.js'],
  transform: {
    '^.+\\.[tj]sx?$': 'babel-jest'
  },
  // Allow babel-jest to transform ESM-only packages used by components
  transformIgnorePatterns: [
    '/node_modules/(?!(ink|ink-testing-library|ansi-styles|chalk|cli-cursor|cli-spinners|is-unicode-supported|restore-cursor|signal-exit|slice-ansi|strip-ansi|wrap-ansi|yoga-layout-prebuilt)/)'
  ],
  moduleNameMapper: {
    '^ink$': '<rootDir>/__mocks__/ink.cjs'
  }
};
