'use strict';

/** @type {import('jest').Config} */
module.exports = {
  // Projects — separate unit vs integration with their own matchers
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/tests/unit/**/*.test.js'],
      testEnvironment: 'node',
      setupFiles: ['<rootDir>/tests/setup.js'],
      globalSetup: '<rootDir>/tests/globalSetup.js',
      globalTeardown: '<rootDir>/tests/globalTeardown.js',
      clearMocks: true,
      restoreMocks: true,
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/integration/**/*.test.js'],
      testEnvironment: 'node',
      setupFiles: ['<rootDir>/tests/setup.js'],
      globalSetup: '<rootDir>/tests/globalSetup.js',
      globalTeardown: '<rootDir>/tests/globalTeardown.js',
      // Run integration tests serially — one server instance, one DB
      runner: 'jest-runner',
      clearMocks: true,
      restoreMocks: true,
    },
  ],

  // Coverage (collected when running with --coverage flag)
  collectCoverageFrom: [
    'controllers/**/*.js',
    'middleware/**/*.js',
    'services/**/*.js',
    'utils/**/*.js',
    '!**/__mocks__/**',
    '!**/node_modules/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      lines: 50,
      branches: 40,
    },
  },

  // JUnit reporter output path (consumed by CI artifact upload)
  reporters: [
    'default',
    ['jest-junit', { outputDirectory: '.', outputName: 'junit.xml' }],
  ],

  testTimeout: 30000,
  verbose: true,

  // socket.io lives in socket/node_modules, not backend/node_modules.
  // Map it to a stub so integration tests can load server.js without failing.
  moduleNameMapper: {
    '^socket\\.io$': '<rootDir>/tests/__mocks__/socket.io.js',
  },
};
