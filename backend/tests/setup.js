/**
 * tests/setup.js
 * Runs in each Jest worker before tests start.
 * Sets test environment variables and silences noisy modules.
 */

// ── External socket server stub ───────────────────────────────────────────────
// The socket server lives in socket/ (outside backend/) and requires packages
// (socket.io, jsonwebtoken) that are only in socket/node_modules — not installed
// during backend CI runs. Mock it globally so server.js loads cleanly.
jest.mock('../../socket/src/config/socketServer', () => ({
  getIO: jest.fn().mockReturnValue(null),
  initializeSocketBridge: jest.fn(),
  emitToUser: jest.fn(),
  emitToConversation: jest.fn(),
  emitToRoom: jest.fn(),
  broadcastToAll: jest.fn(),
}));

// Load local .env variables so custom local configurations are preserved
require('dotenv').config();

// ── Environment ─────────────────────────────────────────────────────────────
process.env.NODE_ENV = 'test';

// JWT secret for token generation in tests
process.env.JWT_SECRET = process.env.JWT_SECRET || 'shopyos-test-jwt-secret-do-not-use-in-prod';

// Disable Socket.IO bridge so server.js doesn't try to start it
process.env.ENABLE_LOCAL_SOCKET = 'false';

// Disable Redis in unit tests — integration tests override this
process.env.REDIS_URL = process.env.REDIS_URL || '';

// Stub DATABASE_URL to prevent startup crashes when modules load database pools (e.g. snapController)
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/shopyos_test';

// Stub email credentials so nodemailer doesn't throw on init
process.env.EMAIL_USERNAME = process.env.EMAIL_USERNAME || 'test@shopyos.local';
process.env.EMAIL_PASSWORD = process.env.EMAIL_PASSWORD || 'test-password';
process.env.EMAIL_FROM = process.env.EMAIL_FROM || 'no-reply@shopyos.local';

// Stub storage credentials to prevent S3 config errors
process.env.STORAGE_ENDPOINT = process.env.STORAGE_ENDPOINT || 'http://localhost:9000';
process.env.STORAGE_REGION = process.env.STORAGE_REGION || 'us-east-1';
process.env.STORAGE_BUCKET = process.env.STORAGE_BUCKET || 'test-bucket';
process.env.STORAGE_ACCESS_KEY = process.env.STORAGE_ACCESS_KEY || 'test-access-key';
process.env.STORAGE_SECRET_KEY = process.env.STORAGE_SECRET_KEY || 'test-secret-key';
process.env.STORAGE_PUBLIC_URL = process.env.STORAGE_PUBLIC_URL || 'http://localhost:9000/test-bucket';

// ── Suppress console noise during tests ─────────────────────────────────────
// Keep errors visible but silence info/warn/debug spam from winston etc.
if (!process.env.TEST_VERBOSE) {
  jest.spyOn(console, 'log').mockImplementation(() => { });
  jest.spyOn(console, 'info').mockImplementation(() => { });
  jest.spyOn(console, 'debug').mockImplementation(() => { });
  // Keep console.error visible so we can see real failures
}
