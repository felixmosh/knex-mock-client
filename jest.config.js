const packageJson = require('./package.json');

module.exports = {
  displayName: packageJson.name,
  testEnvironment: 'node',
  preset: 'ts-jest',
  testMatch: ['<rootDir>/tests/**/?(*.)+(spec|test).[jt]s?(x)'],
  globals: {
    'ts-jest': {
      isolatedModules: true
    }
  }
};
