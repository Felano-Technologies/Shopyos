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

  // The socket server and its dependencies (socket.io, jsonwebtoken) live in
  // socket/node_modules which is NOT installed when running backend tests.
  // Map both to stubs so server.js loads cleanly without external deps.
  moduleNameMapper: {
    // Mock the entire socketServer module — prevents loading socket.io, jwt, etc.
    '.*socket/src/config/socketServer.*': '<rootDir>/tests/__mocks__/socketServer.js',
    // Backup: mock socket.io itself in case anything requires it directly.
    '^socket\\.io$': '<rootDir>/tests/__mocks__/socket.io.js',
  },
};
