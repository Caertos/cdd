module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['./test/jest.setup.js'],
  transform: {
    '^.+\\.[tj]sx?$': 'babel-jest'
  }
};
