/**
 * tests/setup.js
 * Runs in each Jest worker before tests start.
 * Sets test environment variables and silences noisy modules.
 */

// ── Environment ─────────────────────────────────────────────────────────────
process.env.NODE_ENV = 'test';

// JWT secret for token generation in tests
process.env.JWT_SECRET = process.env.JWT_SECRET || 'shopyos-test-jwt-secret-do-not-use-in-prod';

// Disable Socket.IO bridge so server.js doesn't try to start it
process.env.ENABLE_LOCAL_SOCKET = 'false';

// Disable Redis in unit tests — integration tests override this
process.env.REDIS_URL = process.env.REDIS_URL || '';

// Stub email credentials so nodemailer doesn't throw on init
process.env.EMAIL_USERNAME = process.env.EMAIL_USERNAME || 'test@shopyos.local';
process.env.EMAIL_PASSWORD = process.env.EMAIL_PASSWORD || 'test-password';
process.env.EMAIL_FROM = process.env.EMAIL_FROM || 'no-reply@shopyos.local';

// ── Suppress console noise during tests ─────────────────────────────────────
// Keep errors visible but silence info/warn/debug spam from winston etc.
if (!process.env.TEST_VERBOSE) {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'info').mockImplementation(() => {});
  jest.spyOn(console, 'debug').mockImplementation(() => {});
  // Keep console.error visible so we can see real failures
}
