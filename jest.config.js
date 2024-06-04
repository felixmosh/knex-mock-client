const packageJson = require('./package.json');

/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  displayName: packageJson.name,
  testEnvironment: 'node',
  preset: 'ts-jest',
  testMatch: ['<rootDir>/tests/**/?(*.)+(spec|test).[jt]s?(x)'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: { moduleResolution: 'classic' },
        isolatedModules: true,
      },
    ],
  },
};
