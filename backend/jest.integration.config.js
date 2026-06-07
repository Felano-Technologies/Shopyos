'use strict';

/**
 * jest.integration.config.js
 *
 * Jest configuration for integration-only runs (`npm run test:integration`).
 *
 * Key differences from jest.config.js (the full-suite config):
 *  - Only the 'integration' project is selected.
 *  - coverageThreshold is intentionally OMITTED — integration tests alone
 *    cannot hit the full-suite line/branch targets. Threshold enforcement
 *    is reserved for `npm run test:coverage` which runs all projects.
 */

const baseConfig = require('./jest.config');

/** @type {import('jest').Config} */
module.exports = {
  // Inherit shared settings (moduleNameMapper, reporters, testTimeout, etc.)
  ...baseConfig,

  // Override: run only the integration project
  projects: baseConfig.projects.filter(
    (p) => p.displayName === 'integration',
  ),

  // Override: no threshold enforcement for partial (integration-only) runs
  coverageThreshold: {},
};
