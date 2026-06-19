'use strict';

/**
 * tests/unit/auditMiddleware.unit.test.js
 *
 * Unit tests for the auditLog middleware factory in backend/middleware/auditMiddleware.js.
 *
 * How the middleware works:
 *   1. Intercepts res.json to capture the response body.
 *   2. Registers a 'finish' listener on res to write the audit log.
 *   3. Only creates a log when req.user is present.
 *   4. statusCode < 400  → status: 'success'
 *      statusCode >= 400 → status: 'failed', failureReason from captured body
 *
 * res is built from Node's EventEmitter so we can emit 'finish' manually.
 */

const { EventEmitter } = require('events');

jest.mock('../../db/repositories', () => ({
  auditLogs: { createLog: jest.fn().mockResolvedValue({}) },
}));

const repositories = require('../../db/repositories');
const { auditLog } = require('../../middleware/auditMiddleware');

// ── helpers ───────────────────────────────────────────────────────────────────

/**
 * Creates a mock `res` object backed by EventEmitter so we can call
 * res.emit('finish') to trigger the middleware's 'finish' handler.
 */
function mockRes(statusCode = 200) {
  const emitter = new EventEmitter();
  emitter.statusCode = statusCode;
  emitter.json = jest.fn((body) => {
    // Simulate Express: call any override then return res
    return emitter;
  });
  return emitter;
}

function mockReq(overrides = {}) {
  return {
    params:     {},
    query:      {},
    body:       {},
    user:       { id: 'user-123' },
    ip:         '127.0.0.1',
    connection: { remoteAddress: '127.0.0.1' },
    headers:    { 'user-agent': 'jest-test' },
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
describe('auditLog middleware unit tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── no user → skip logging ──────────────────────────────────────────────────
  test('test_auditLog_noUser_doesNotCreateLog', () => {
    // Arrange
    const req  = mockReq({ user: null });
    const res  = mockRes(200);
    const next = jest.fn();

    const middleware = auditLog('test_action', 'test_entity');

    // Act
    middleware(req, res, next);
    res.emit('finish');

    // Assert
    expect(next).toHaveBeenCalledTimes(1);
    expect(repositories.auditLogs.createLog).not.toHaveBeenCalled();
  });

  // ── 2xx → status: 'success' ─────────────────────────────────────────────────
  test('test_auditLog_successResponse_logsSuccessStatus', async () => {
    // Arrange
    const req  = mockReq();
    const res  = mockRes(200);
    const next = jest.fn();

    const middleware = auditLog('create_product', 'product');

    // Act
    middleware(req, res, next);
    // Simulate sending a JSON body (intercepted by the middleware)
    res.json({ success: true });
    res.emit('finish');

    // Allow the Promise inside the 'finish' handler to settle
    await Promise.resolve();

    // Assert
    expect(repositories.auditLogs.createLog).toHaveBeenCalledTimes(1);
    expect(repositories.auditLogs.createLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId:        'user-123',
        action:        'create_product',
        entityType:    'product',
        status:        'success',
        failureReason: null,
      })
    );
  });

  // ── 4xx → status: 'failed', failureReason from body.error ──────────────────
  test('test_auditLog_failedResponse_logsFailedStatusWithReason', async () => {
    // Arrange
    const req  = mockReq();
    const res  = mockRes(422);
    const next = jest.fn();

    const middleware = auditLog('update_product', 'product');

    // Act
    middleware(req, res, next);
    res.json({ error: 'Validation failed' });
    res.emit('finish');

    await Promise.resolve();

    // Assert
    expect(repositories.auditLogs.createLog).toHaveBeenCalledWith(
      expect.objectContaining({
        status:        'failed',
        failureReason: 'Validation failed',
      })
    );
  });

  // ── password stripped from metadata ────────────────────────────────────────
  test('test_auditLog_stripsPasswordFromMetadata', async () => {
    // Arrange
    const req = mockReq({
      body: { email: 'user@test.com', password: 'supersecret', full_name: 'Tester' },
    });
    const res  = mockRes(200);
    const next = jest.fn();

    const middleware = auditLog('login', 'auth');

    // Act
    middleware(req, res, next);
    res.json({ success: true });
    res.emit('finish');

    await Promise.resolve();

    // Assert
    const callArg = repositories.auditLogs.createLog.mock.calls[0][0];
    expect(callArg.metadata).not.toHaveProperty('password');
    expect(callArg.metadata).toHaveProperty('email', 'user@test.com');
    expect(callArg.metadata).toHaveProperty('full_name', 'Tester');
  });

  // ── entityId sourced from req.params.id ────────────────────────────────────
  test('test_auditLog_entityIdFromParams_usesParamId', async () => {
    // Arrange
    const req = mockReq({ params: { id: 'entity-123' } });
    const res  = mockRes(200);
    const next = jest.fn();

    const middleware = auditLog('delete_product', 'product');

    // Act
    middleware(req, res, next);
    res.json({ success: true });
    res.emit('finish');

    await Promise.resolve();

    // Assert
    expect(repositories.auditLogs.createLog).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: 'entity-123' })
    );
  });

  // ── createLog rejects → error swallowed, no crash ──────────────────────────
  test('test_auditLog_createLogThrows_doesNotCrash', async () => {
    // Arrange
    repositories.auditLogs.createLog.mockRejectedValueOnce(new Error('DB down'));

    const req  = mockReq();
    const res  = mockRes(200);
    const next = jest.fn();

    const middleware = auditLog('view_orders', 'order');

    // Act — should not throw
    middleware(req, res, next);
    res.json({ data: [] });
    res.emit('finish');

    // Allow rejection to propagate and be caught inside the middleware
    await new Promise((r) => setImmediate(r));

    // Assert — next was still called normally, no unhandled error
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalledWith(expect.any(Error));
  });

  // ── token / refresh_token also stripped ─────────────────────────────────────
  test('test_auditLog_stripsTokenFieldsFromMetadata', async () => {
    // Arrange
    const req = mockReq({
      body: { token: 'tok_abc', refresh_token: 'ref_xyz', amount: 100 },
    });
    const res  = mockRes(200);
    const next = jest.fn();

    const middleware = auditLog('refresh_session', 'auth');

    // Act
    middleware(req, res, next);
    res.json({ success: true });
    res.emit('finish');

    await Promise.resolve();

    // Assert
    const callArg = repositories.auditLogs.createLog.mock.calls[0][0];
    expect(callArg.metadata).not.toHaveProperty('token');
    expect(callArg.metadata).not.toHaveProperty('refresh_token');
    expect(callArg.metadata).toHaveProperty('amount', 100);
  });
});
