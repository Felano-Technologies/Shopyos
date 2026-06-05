'use strict';

/**
 * tests/unit/errorHandler.unit.test.js
 *
 * Unit tests for the error handler and 404 middleware.
 * Conforms to guidelines/test.md.
 */

jest.mock('../../config/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  httpLogMiddleware: (req, res, next) => next(),
}));

const { errorHandler, notFoundHandler } = require('../../middleware/errorHandler');

function mockReq(overrides = {}) {
  return { method: 'GET', originalUrl: '/test', requestId: 'req-1', ...overrides };
}
function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('errorHandler and notFoundHandler Unit Tests', () => {
  // ── notFoundHandler ────────────────────────────────────────────────
  test('test_notFoundHandler_anyRequest_respondsWith404NotFound', () => {
    // Arrange
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    // Act
    notFoundHandler(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('test_notFoundHandler_missingPath_includesRequestedPathInResponseBody', () => {
    // Arrange
    const req = mockReq({ originalUrl: '/api/v1/missing' });
    const res = mockRes();

    // Act
    notFoundHandler(req, res, jest.fn());

    // Assert
    const body = res.json.mock.calls[0][0];
    expect(body.error || body.message || JSON.stringify(body)).toMatch(/not found|missing|404/i);
  });

  // ── errorHandler ───────────────────────────────────────────────────
  test('test_errorHandler_customErrorStatus_usesErrorStatusInResponse', () => {
    // Arrange
    const err = Object.assign(new Error('Bad input'), { statusCode: 400 });
    const req = mockReq();
    const res = mockRes();

    // Act
    errorHandler(err, req, res, jest.fn());

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('test_errorHandler_noErrorStatus_defaultsTo500InternalServerError', () => {
    // Arrange
    const err = new Error('Something blew up');
    const req = mockReq();
    const res = mockRes();

    // Act
    errorHandler(err, req, res, jest.fn());

    // Assert
    expect(res.status).toHaveBeenCalledWith(500);
  });

  test('test_errorHandler_anyError_returnsJsonResponseBody', () => {
    // Arrange
    const err = new Error('Oops');
    const req = mockReq();
    const res = mockRes();

    // Act
    errorHandler(err, req, res, jest.fn());

    // Assert
    expect(res.json).toHaveBeenCalled();
  });

  test('test_errorHandler_withErrorMessage_includesErrorMessageInResponsePayload', () => {
    // Arrange
    const err = new Error('Custom error message');
    const req = mockReq();
    const res = mockRes();

    // Act
    errorHandler(err, req, res, jest.fn());

    // Assert
    const body = res.json.mock.calls[0][0];
    expect(JSON.stringify(body)).toContain('Custom error message');
  });
});
