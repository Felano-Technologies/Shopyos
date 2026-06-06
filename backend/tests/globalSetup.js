/**
 * tests/globalSetup.js
 * Runs once before the entire Jest test suite (in the main process, not workers).
 * Safe place for one-time setup that doesn't need to be repeated per-worker.
 */
module.exports = async () => {
  process.env.NODE_ENV = 'test';
  // Any one-time setup (e.g. starting a test server) goes here.
  // For now we rely on per-test supertest instances.
};
