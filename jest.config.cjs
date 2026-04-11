module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['./test/jest.setup.js'],
  transform: {
    '^.+\\.[tj]sx?$': 'babel-jest'
  }
};
