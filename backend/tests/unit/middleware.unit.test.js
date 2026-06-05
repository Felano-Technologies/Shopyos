'use strict';

/**
 * tests/unit/middleware.unit.test.js
 *
 * Unit tests for auth middleware, role guards, and error handler.
 * Uses mock req/res/next objects — no real server or DB.
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = 'shopyos-test-jwt-secret-do-not-use-in-prod';
process.env.JWT_SECRET = JWT_SECRET;

// ── Mock heavy deps before requiring middleware ──────────────────────────────
jest.mock('../../config/redis', () => ({
  cacheGet: jest.fn().mockResolvedValue(null),
  cacheSet: jest.fn().mockResolvedValue(true),
  cacheDel: jest.fn().mockResolvedValue(1),
}));

jest.mock('../../db/repositories', () => ({
  users: {
    findById: jest.fn(),
    getUserWithRoles: jest.fn(),
  },
}));

jest.mock('../../config/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  httpLogMiddleware: (req, res, next) => next(),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────
const { protect, admin, seller, hasAnyRole } = require('../../middleware/authMiddleware');
// Note: checkRole is an internal factory — we test it via the exported
// role wrappers: admin (checkRole('admin')), seller (checkRole('seller'))
const { cacheGet } = require('../../config/redis');
const repositories = require('../../db/repositories');

/** Build a minimal mock Express request */
function mockReq(overrides = {}) {
  return {
    headers: {},
    requestId: 'test-req-id',
    ...overrides,
  };
}

/** Build a mock Express response with jest spies */
function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function makeValidToken(userId = 'user-123', extraClaims = {}) {
  return jwt.sign(
    { sub: userId, id: userId, type: 'access', role: 'authenticated', ...extraClaims },
    JWT_SECRET,
    { expiresIn: '15m' },
  );
}

// ── protect middleware ───────────────────────────────────────────────────────
describe('protect middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 401 when Authorization header is missing', async () => {
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    await protect(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 401 when Authorization header does not start with Bearer', async () => {
    const req = mockReq({ headers: { authorization: 'Basic sometoken' } });
    const res = mockRes();
    const next = jest.fn();

    await protect(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('returns 401 when token is blacklisted in Redis', async () => {
    cacheGet.mockResolvedValueOnce({ userId: 'user-123' }); // token is blacklisted

    const token = makeValidToken();
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = mockRes();
    const next = jest.fn();

    await protect(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('revoked') }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 401 with invalid (malformed) token', async () => {
    const req = mockReq({ headers: { authorization: 'Bearer not.a.valid.token' } });
    const res = mockRes();
    const next = jest.fn();

    await protect(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('calls next() and sets req.user when token is valid and user exists', async () => {
    cacheGet.mockResolvedValueOnce(null); // not blacklisted

    // Return user data from DB (first call = findById, second = getUserWithRoles)
    repositories.users.findById.mockResolvedValueOnce({
      id: 'user-123',
      email: 'test@shopyos.com',
      email_verified: true,
      is_active: true,
    });
    repositories.users.getUserWithRoles.mockResolvedValueOnce({
      user_roles: [{ is_active: true, roles: { name: 'buyer' } }],
    });

    const token = makeValidToken('user-123');
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = mockRes();
    const next = jest.fn();

    await protect(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toBeDefined();
    expect(req.user.id).toBe('user-123');
    expect(req.user.roles).toContain('buyer');
  });

  test('returns 401 when user is not found in DB', async () => {
    cacheGet.mockResolvedValueOnce(null);
    repositories.users.findById.mockResolvedValueOnce(null); // user not found
    repositories.users.getUserWithRoles.mockResolvedValueOnce(null);

    const token = makeValidToken('ghost-user');
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = mockRes();
    const next = jest.fn();

    await protect(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 401 when account is deactivated', async () => {
    cacheGet.mockResolvedValueOnce(null);
    repositories.users.findById.mockResolvedValueOnce({
      id: 'user-456',
      email: 'banned@shopyos.com',
      is_active: false,  // <-- deactivated
    });
    repositories.users.getUserWithRoles.mockResolvedValueOnce({ user_roles: [] });

    const token = makeValidToken('user-456');
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = mockRes();
    const next = jest.fn();

    await protect(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('deactivated') }),
    );
  });
});

// ── Role guards (testing via exported wrappers: admin, seller) ───────────────
describe('admin role guard (checkRole("admin"))', () => {
  test('returns 401 if req.user is not set', () => {
    const req = mockReq({ user: undefined });
    const res = mockRes();
    const next = jest.fn();

    admin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 403 if user does not have admin role', () => {
    const req = mockReq({ user: { id: 'u1', roles: ['buyer'] } });
    const res = mockRes();
    const next = jest.fn();

    admin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('calls next() when user has admin role', () => {
    const req = mockReq({ user: { id: 'u1', roles: ['admin'] } });
    const res = mockRes();
    const next = jest.fn();

    admin(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('seller role guard (checkRole("seller"))', () => {
  test('calls next() if user has seller role', () => {
    const req = mockReq({ user: { id: 'u1', roles: ['buyer', 'seller'] } });
    const res = mockRes();
    const next = jest.fn();

    seller(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  test('returns 403 if user only has buyer role', () => {
    const req = mockReq({ user: { id: 'u1', roles: ['buyer'] } });
    const res = mockRes();
    const next = jest.fn();

    seller(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('hasAnyRole', () => {
  test('returns 403 when user has none of the required roles', () => {
    const middleware = hasAnyRole('seller', 'admin');
    const req = mockReq({ user: { id: 'u1', roles: ['buyer'] } });
    const res = mockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('calls next() when user has at least one required role', () => {
    const middleware = hasAnyRole('seller', 'admin');
    const req = mockReq({ user: { id: 'u1', roles: ['seller'] } });
    const res = mockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  test('calls next() when user has all required roles', () => {
    const middleware = hasAnyRole('seller', 'admin');
    const req = mockReq({ user: { id: 'u1', roles: ['seller', 'admin'] } });
    const res = mockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  test('returns 401 when req.user is missing', () => {
    const middleware = hasAnyRole('seller');
    const req = mockReq({ user: null });
    const res = mockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});
