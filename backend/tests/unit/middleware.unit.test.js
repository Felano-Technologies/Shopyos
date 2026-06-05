'use strict';

/**
 * tests/unit/middleware.unit.test.js
 *
 * Unit tests for auth middleware, role guards, and hasAnyRole.
 * Mocks all repositories and Redis caching.
 * Conforms to guidelines/test.md.
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

const { protect, admin, seller, hasAnyRole } = require('../../middleware/authMiddleware');
const { cacheGet } = require('../../config/redis');
const repositories = require('../../db/repositories');

function mockReq(overrides = {}) {
  return {
    headers: {},
    requestId: 'test-req-id',
    ...overrides,
  };
}

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

describe('Middleware Unit Tests', () => {
  // ── protect middleware ─────────────────────────────────────────────
  describe('protect', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('test_protect_missingAuthorizationHeader_returns401Unauthorized', async () => {
      // Arrange
      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      // Act
      await protect(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    test('test_protect_invalidAuthorizationScheme_returns401Unauthorized', async () => {
      // Arrange
      const req = mockReq({ headers: { authorization: 'Basic sometoken' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await protect(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    test('test_protect_blacklistedToken_returns401UnauthorizedWithRevokedError', async () => {
      // Arrange
      cacheGet.mockResolvedValueOnce({ userId: 'user-123' }); // Token is blacklisted
      const token = makeValidToken();
      const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await protect(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('revoked') }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    test('test_protect_malformedTokenString_returns401Unauthorized', async () => {
      // Arrange
      const req = mockReq({ headers: { authorization: 'Bearer not.a.valid.token' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await protect(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    test('test_protect_validTokenAndExistingUser_callsNextAndSetsReqUser', async () => {
      // Arrange
      cacheGet.mockResolvedValueOnce(null); // Not blacklisted
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

      // Act
      await protect(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledTimes(1);
      expect(req.user).toBeDefined();
      expect(req.user.id).toBe('user-123');
      expect(req.user.roles).toContain('buyer');
    });

    test('test_protect_userNotFoundInDb_returns401Unauthorized', async () => {
      // Arrange
      cacheGet.mockResolvedValueOnce(null);
      repositories.users.findById.mockResolvedValueOnce(null);
      repositories.users.getUserWithRoles.mockResolvedValueOnce(null);

      const token = makeValidToken('ghost-user');
      const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await protect(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    test('test_protect_accountDeactivated_returns401UnauthorizedWithDeactivatedError', async () => {
      // Arrange
      cacheGet.mockResolvedValueOnce(null);
      repositories.users.findById.mockResolvedValueOnce({
        id: 'user-456',
        email: 'banned@shopyos.com',
        is_active: false,
      });
      repositories.users.getUserWithRoles.mockResolvedValueOnce({ user_roles: [] });

      const token = makeValidToken('user-456');
      const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await protect(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('deactivated') }),
      );
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ── Role guards (admin) ────────────────────────────────────────────
  describe('admin role guard', () => {
    test('test_adminGuard_missingReqUser_returns401Unauthorized', () => {
      // Arrange
      const req = mockReq({ user: undefined });
      const res = mockRes();
      const next = jest.fn();

      // Act
      admin(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    test('test_adminGuard_userNotAdmin_returns403Forbidden', () => {
      // Arrange
      const req = mockReq({ user: { id: 'u1', roles: ['buyer'] } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      admin(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    test('test_adminGuard_userIsAdmin_callsNextSuccessful', () => {
      // Arrange
      const req = mockReq({ user: { id: 'u1', roles: ['admin'] } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      admin(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  // ── Role guards (seller) ───────────────────────────────────────────
  describe('seller role guard', () => {
    test('test_sellerGuard_userIsSeller_callsNextSuccessful', () => {
      // Arrange
      const req = mockReq({ user: { id: 'u1', roles: ['buyer', 'seller'] } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      seller(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledTimes(1);
    });

    test('test_sellerGuard_userNotSeller_returns403Forbidden', () => {
      // Arrange
      const req = mockReq({ user: { id: 'u1', roles: ['buyer'] } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      seller(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ── hasAnyRole ─────────────────────────────────────────────────────
  describe('hasAnyRole', () => {
    test('test_hasAnyRole_userLacksAllRequiredRoles_returns403Forbidden', () => {
      // Arrange
      const middleware = hasAnyRole('seller', 'admin');
      const req = mockReq({ user: { id: 'u1', roles: ['buyer'] } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      middleware(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
    });

    test('test_hasAnyRole_userHasAtLeastOneRequiredRole_callsNextSuccessful', () => {
      // Arrange
      const middleware = hasAnyRole('seller', 'admin');
      const req = mockReq({ user: { id: 'u1', roles: ['seller'] } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      middleware(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledTimes(1);
    });

    test('test_hasAnyRole_userHasAllRequiredRoles_callsNextSuccessful', () => {
      // Arrange
      const middleware = hasAnyRole('seller', 'admin');
      const req = mockReq({ user: { id: 'u1', roles: ['seller', 'admin'] } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      middleware(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledTimes(1);
    });

    test('test_hasAnyRole_missingReqUser_returns401Unauthorized', () => {
      // Arrange
      const middleware = hasAnyRole('seller');
      const req = mockReq({ user: null });
      const res = mockRes();
      const next = jest.fn();

      // Act
      middleware(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });
});
