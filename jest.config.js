const packageJson = require('./package.json');

module.exports = {
  name: packageJson.name,
  displayName: packageJson.name,
  testEnvironment: 'node',
  preset: 'ts-jest',
  testMatch: ['<rootDir>/tests/**/?(*.)+(spec|test).[jt]s?(x)']
};
