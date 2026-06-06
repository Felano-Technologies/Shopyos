'use strict';

/**
 * tests/unit/authController.unit.test.js
 *
 * Unit tests for authController — no real DB, no HTTP server, no real Redis.
 * Every external dependency is mocked. Conforms to guidelines/test.md.
 */

// ── DB chain helper — shared across all tests ────────────────────────────────
const mockDbChain = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  gt: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn(),
  single: jest.fn(),
};

// ── Mock repositories ────────────────────────────────────────────────────────
jest.mock('../../db/repositories', () => ({
  users: {
    db: mockDbChain,
    findByEmail: jest.fn(),
    findById: jest.fn(),
    createUser: jest.fn(),
    update: jest.fn(),
    updatePassword: jest.fn(),
    setPasswordResetToken: jest.fn(),
    verifyPassword: jest.fn(),
    setRole: jest.fn(),
  },
  userProfiles: {
    findByUserId: jest.fn(),
    updateByUserId: jest.fn(),
  },
  roles: {
    getUserRoles: jest.fn(),
    userHasRole: jest.fn(),
    findByName: jest.fn(),
    assignRoleToUser: jest.fn(),
  },
}));

// ── Mock config/storage ──────────────────────────────────────────────────────
jest.mock('../../config/storage', () => ({
  toPublicUrl: jest.fn((url) => (url ? `https://cdn.example.com/${url}` : null)),
}));

// ── Mock config/logger ───────────────────────────────────────────────────────
jest.mock('../../config/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// ── Mock config/redis ────────────────────────────────────────────────────────
jest.mock('../../config/redis', () => ({
  cacheSet: jest.fn().mockResolvedValue(true),
  cacheDel: jest.fn().mockResolvedValue(1),
}));

// ── Mock config/auth ─────────────────────────────────────────────────────────
jest.mock('../../config/auth', () => ({
  ACCESS_TOKEN_EXPIRY: '15m',
  REFRESH_TOKEN_EXPIRY_MS: 7 * 24 * 60 * 60 * 1000,
  ACCESS_TOKEN_BLACKLIST_PREFIX: 'shopyos:blacklist:access:',
  COOKIE_OPTIONS: { httpOnly: true, secure: false, sameSite: 'lax', path: '/' },
  ACCESS_COOKIE_NAME: 'access_token',
  REFRESH_COOKIE_NAME: 'refresh_token',
  generateRefreshToken: jest.fn().mockReturnValue('raw-refresh-token-hex'),
  hashToken: jest.fn((t) => `hashed:${t}`),
}));

// ── Mock jsonwebtoken ────────────────────────────────────────────────────────
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock-access-token'),
  verify: jest.fn().mockReturnValue({ id: 'user-123', sub: 'user-123', exp: Math.floor(Date.now() / 1000) + 900 }),
}));

// ── Mock nodemailer ──────────────────────────────────────────────────────────
const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'msg-1' });
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: mockSendMail })),
}));

// ── Mock RabbitMQ service ────────────────────────────────────────────────────
jest.mock('../../services/rabbitmq', () => ({
  publishMessage: jest.fn(),
}));

// ── Load controller AFTER all mocks are in place ─────────────────────────────
const repositories = require('../../db/repositories');
const {
  register,
  login,
  refreshAccessToken,
  logout,
  logoutAll,
  getSessions,
  revokeSession,
  resetPassword,
  confirmResetPassword,
  getUserData,
  addRole,
  getUserRoles,
  updateUserRole,
  updateProfile,
  updateUserLocation,
  updateOnboardingState,
} = require('../../controllers/authController');

// ── Test helpers ─────────────────────────────────────────────────────────────
function mockReq(overrides = {}) {
  return {
    user: { id: 'user-123' },
    body: {},
    params: {},
    query: {},
    headers: {},
    cookies: {},
    ip: '127.0.0.1',
    get: jest.fn((header) => (header === 'user-agent' ? 'test-agent' : undefined)),
    ...overrides,
  };
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  return res;
}

// ── Setup ─────────────────────────────────────────────────────────────────────
beforeEach(() => {
  jest.clearAllMocks();

  // Reset the db chain so every test starts fresh
  mockDbChain.from.mockReturnThis();
  mockDbChain.select.mockReturnThis();
  mockDbChain.insert.mockReturnThis();
  mockDbChain.update.mockReturnThis();
  mockDbChain.delete.mockReturnThis();
  mockDbChain.eq.mockReturnThis();
  mockDbChain.gt.mockReturnThis();
  mockDbChain.order.mockReturnThis();
  mockDbChain.maybeSingle.mockResolvedValue({ data: null, error: null });
  mockDbChain.single.mockResolvedValue({ data: null, error: null });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('AuthController Unit Tests', () => {

  // ── register ───────────────────────────────────────────────────────────────
  describe('register', () => {
    test('test_register_emailAlreadyExists_returns400BadRequest', async () => {
      repositories.users.findByEmail.mockResolvedValueOnce({ id: 'existing-user' });

      const req = mockReq({ body: { name: 'Alice', email: 'alice@test.com', password: 'pass123' } });
      const res = mockRes();
      const next = jest.fn();

      await register(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'User already exists' });
      expect(next).not.toHaveBeenCalled();
    });

    test('test_register_validNewUser_createsUserAndReturns201', async () => {
      repositories.users.findByEmail.mockResolvedValueOnce(null);
      repositories.users.createUser.mockResolvedValueOnce({ id: 'new-user-id' });
      repositories.userProfiles.updateByUserId.mockResolvedValueOnce({});
      mockDbChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
      // createRefreshToken insert chain
      mockDbChain.single.mockResolvedValueOnce({ data: { id: 'token-id', family_id: 'family-1' }, error: null });

      const req = mockReq({
        body: { name: 'Alice', email: 'alice@test.com', password: 'pass123', fullPhoneNumber: '+233201234567' },
      });
      const res = mockRes();
      const next = jest.fn();

      await register(req, res, next);

      expect(repositories.users.createUser).toHaveBeenCalledWith({ email: 'alice@test.com', password: 'pass123' });
      expect(repositories.userProfiles.updateByUserId).toHaveBeenCalledWith(
        'new-user-id',
        expect.objectContaining({ full_name: 'Alice' })
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'User created successfully', requiresRoleSelection: true })
      );
      expect(next).not.toHaveBeenCalled();
    });

    test('test_register_withValidReferralCode_logsReferralRecord', async () => {
      repositories.users.findByEmail.mockResolvedValueOnce(null);
      repositories.users.createUser.mockResolvedValueOnce({ id: 'new-user-id' });
      repositories.userProfiles.updateByUserId.mockResolvedValueOnce({});

      // maybeSingle for referral code lookup returns a matching referrer
      mockDbChain.maybeSingle.mockResolvedValueOnce({ data: { user_id: 'referrer-id' }, error: null });
      // insert for referrals table
      mockDbChain.insert.mockReturnThis();
      // insert for referrals resolves (no select/single needed)
      // createRefreshToken insert chain
      mockDbChain.single.mockResolvedValueOnce({ data: { id: 'token-id', family_id: 'family-1' }, error: null });

      const req = mockReq({
        body: { name: 'Bob', email: 'bob@test.com', password: 'pass', referralCode: 'SHPY-ABC123' },
      });
      const res = mockRes();
      const next = jest.fn();

      await register(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(next).not.toHaveBeenCalled();
    });

    test('test_register_dbCreateUserThrows_callsNextWithError', async () => {
      repositories.users.findByEmail.mockResolvedValueOnce(null);
      repositories.users.createUser.mockRejectedValueOnce(new Error('DB create error'));

      const req = mockReq({ body: { name: 'Alice', email: 'alice@test.com', password: 'pass123' } });
      const res = mockRes();
      const next = jest.fn();

      await register(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    test('test_register_withoutPhone_doesNotPublishSmsMessage', async () => {
      const rabbitMQ = require('../../services/rabbitmq');
      repositories.users.findByEmail.mockResolvedValueOnce(null);
      repositories.users.createUser.mockResolvedValueOnce({ id: 'new-user-id' });
      repositories.userProfiles.updateByUserId.mockResolvedValueOnce({});
      mockDbChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
      mockDbChain.single.mockResolvedValueOnce({ data: { id: 'token-id', family_id: 'family-1' }, error: null });

      const req = mockReq({ body: { name: 'Alice', email: 'alice@test.com', password: 'pass123' } });
      const res = mockRes();
      const next = jest.fn();

      await register(req, res, next);

      const smsCalls = rabbitMQ.publishMessage.mock.calls.filter(([channel]) => channel === 'sms');
      expect(smsCalls).toHaveLength(0);
    });
  });

  // ── login ──────────────────────────────────────────────────────────────────
  describe('login', () => {
    test('test_login_userNotFound_returns400InvalidCredentials', async () => {
      repositories.users.findByEmail.mockResolvedValueOnce(null);

      const req = mockReq({ body: { email: 'nobody@test.com', password: 'pass' } });
      const res = mockRes();
      const next = jest.fn();

      await login(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid credentials' });
      expect(next).not.toHaveBeenCalled();
    });

    test('test_login_wrongPassword_returns400InvalidCredentials', async () => {
      repositories.users.findByEmail.mockResolvedValueOnce({ id: 'user-123', email: 'alice@test.com' });
      repositories.users.verifyPassword.mockResolvedValueOnce(false);

      const req = mockReq({ body: { email: 'alice@test.com', password: 'wrongpass' } });
      const res = mockRes();
      const next = jest.fn();

      await login(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid credentials' });
    });

    test('test_login_validCredentials_returnsTokensAndRole', async () => {
      repositories.users.findByEmail.mockResolvedValueOnce({ id: 'user-123', email: 'alice@test.com' });
      repositories.users.verifyPassword.mockResolvedValueOnce(true);
      repositories.users.update.mockResolvedValueOnce({});
      repositories.roles.getUserRoles.mockResolvedValueOnce([
        { role: { name: 'buyer' } },
      ]);
      mockDbChain.single.mockResolvedValueOnce({ data: { id: 'token-id', family_id: 'family-1' }, error: null });

      const req = mockReq({ body: { email: 'alice@test.com', password: 'correctpass' } });
      const res = mockRes();
      const next = jest.fn();

      await login(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Login successful',
          role: 'buyer',
          requiresRoleSelection: false,
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    test('test_login_noRolesAssigned_setsRequiresRoleSelectionTrue', async () => {
      repositories.users.findByEmail.mockResolvedValueOnce({ id: 'user-123', email: 'alice@test.com' });
      repositories.users.verifyPassword.mockResolvedValueOnce(true);
      repositories.users.update.mockResolvedValueOnce({});
      repositories.roles.getUserRoles.mockResolvedValueOnce([]);
      mockDbChain.single.mockResolvedValueOnce({ data: { id: 'token-id', family_id: 'family-1' }, error: null });

      const req = mockReq({ body: { email: 'alice@test.com', password: 'pass' } });
      const res = mockRes();
      const next = jest.fn();

      await login(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ requiresRoleSelection: true, role: 'none' })
      );
    });

    test('test_login_multipleRoles_picksHighestPriorityRole', async () => {
      repositories.users.findByEmail.mockResolvedValueOnce({ id: 'user-123', email: 'alice@test.com' });
      repositories.users.verifyPassword.mockResolvedValueOnce(true);
      repositories.users.update.mockResolvedValueOnce({});
      repositories.roles.getUserRoles.mockResolvedValueOnce([
        { role: { name: 'buyer' } },
        { role: { name: 'seller' } },
        { role: { name: 'driver' } },
      ]);
      mockDbChain.single.mockResolvedValueOnce({ data: { id: 'token-id', family_id: 'family-1' }, error: null });

      const req = mockReq({ body: { email: 'alice@test.com', password: 'pass' } });
      const res = mockRes();
      const next = jest.fn();

      await login(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ role: 'driver' }));
    });

    test('test_login_withLocationInBody_updatesUserProfile', async () => {
      repositories.users.findByEmail.mockResolvedValueOnce({ id: 'user-123', email: 'alice@test.com' });
      repositories.users.verifyPassword.mockResolvedValueOnce(true);
      repositories.userProfiles.updateByUserId.mockResolvedValueOnce({});
      repositories.users.update.mockResolvedValueOnce({});
      repositories.roles.getUserRoles.mockResolvedValueOnce([]);
      mockDbChain.single.mockResolvedValueOnce({ data: { id: 'token-id', family_id: 'family-1' }, error: null });

      const req = mockReq({ body: { email: 'alice@test.com', password: 'pass', latitude: 5.6, longitude: -0.2 } });
      const res = mockRes();
      const next = jest.fn();

      await login(req, res, next);

      expect(repositories.userProfiles.updateByUserId).toHaveBeenCalledWith('user-123', {
        latitude: 5.6,
        longitude: -0.2,
      });
    });

    test('test_login_dbThrows_callsNextWithError', async () => {
      repositories.users.findByEmail.mockRejectedValueOnce(new Error('DB connection lost'));

      const req = mockReq({ body: { email: 'alice@test.com', password: 'pass' } });
      const res = mockRes();
      const next = jest.fn();

      await login(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // ── refreshAccessToken ─────────────────────────────────────────────────────
  describe('refreshAccessToken', () => {
    test('test_refreshAccessToken_noTokenProvided_returns401', async () => {
      const req = mockReq({ body: {}, cookies: {} });
      const res = mockRes();
      const next = jest.fn();

      await refreshAccessToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Refresh token required' });
    });

    test('test_refreshAccessToken_tokenNotFoundInDb_returns401', async () => {
      mockDbChain.single.mockResolvedValueOnce({ data: null, error: new Error('not found') });

      const req = mockReq({ body: { refreshToken: 'some-raw-token' } });
      const res = mockRes();
      const next = jest.fn();

      await refreshAccessToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid refresh token' });
    });

    test('test_refreshAccessToken_revokedToken_revokesEntireFamilyAndReturns401', async () => {
      mockDbChain.single.mockResolvedValueOnce({
        data: { id: 'tok-1', user_id: 'user-123', family_id: 'fam-1', is_revoked: true },
        error: null,
      });
      // Subsequent eq chains for family revoke
      mockDbChain.eq.mockReturnThis();

      const req = mockReq({ body: { refreshToken: 'revoked-token' } });
      const res = mockRes();
      const next = jest.fn();

      await refreshAccessToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('compromised') })
      );
    });

    test('test_refreshAccessToken_expiredToken_returns401', async () => {
      mockDbChain.single.mockResolvedValueOnce({
        data: {
          id: 'tok-1',
          user_id: 'user-123',
          family_id: 'fam-1',
          is_revoked: false,
          expires_at: new Date(Date.now() - 1000).toISOString(), // already expired
        },
        error: null,
      });

      const req = mockReq({ body: { refreshToken: 'expired-token' } });
      const res = mockRes();
      const next = jest.fn();

      await refreshAccessToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Refresh token expired' });
    });

    test('test_refreshAccessToken_deactivatedUser_returns401', async () => {
      mockDbChain.single.mockResolvedValueOnce({
        data: {
          id: 'tok-1',
          user_id: 'user-123',
          family_id: 'fam-1',
          is_revoked: false,
          expires_at: new Date(Date.now() + 100000).toISOString(),
        },
        error: null,
      });
      repositories.users.findById.mockResolvedValueOnce({ id: 'user-123', is_active: false });

      const req = mockReq({ body: { refreshToken: 'valid-raw-token' } });
      const res = mockRes();
      const next = jest.fn();

      await refreshAccessToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Account not found or deactivated' });
    });

    test('test_refreshAccessToken_validToken_issuesNewTokenPair', async () => {
      const futureDate = new Date(Date.now() + 100000).toISOString();
      mockDbChain.single
        // First: lookup existing stored token
        .mockResolvedValueOnce({
          data: { id: 'tok-1', user_id: 'user-123', family_id: 'fam-1', is_revoked: false, expires_at: futureDate },
          error: null,
        })
        // Second: insert new refresh token record
        .mockResolvedValueOnce({ data: { id: 'tok-2', family_id: 'fam-1' }, error: null });

      repositories.users.findById.mockResolvedValueOnce({ id: 'user-123', is_active: true });

      const req = mockReq({ body: { refreshToken: 'valid-raw-token' } });
      const res = mockRes();
      const next = jest.fn();

      await refreshAccessToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Tokens refreshed successfully' })
      );
      expect(next).not.toHaveBeenCalled();
    });

    test('test_refreshAccessToken_dbThrows_callsNextWithError', async () => {
      mockDbChain.single.mockRejectedValueOnce(new Error('DB error'));

      const req = mockReq({ body: { refreshToken: 'some-token' } });
      const res = mockRes();
      const next = jest.fn();

      await refreshAccessToken(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // ── logout ─────────────────────────────────────────────────────────────────
  describe('logout', () => {
    test('test_logout_withValidBearerToken_blacklistsTokenAndClears', async () => {
      const jwt = require('jsonwebtoken');
      jwt.verify.mockReturnValueOnce({ id: 'user-123', exp: Math.floor(Date.now() / 1000) + 900 });

      const req = mockReq({
        headers: { authorization: 'Bearer mock-access-token' },
        body: { refreshToken: 'some-refresh' },
        user: { id: 'user-123' },
      });
      const res = mockRes();
      const next = jest.fn();

      await logout(req, res, next);

      const { cacheSet } = require('../../config/redis');
      expect(cacheSet).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Logged out successfully' });
    });

    test('test_logout_expiredBearerToken_stillSucceeds', async () => {
      const jwt = require('jsonwebtoken');
      jwt.verify.mockImplementationOnce(() => { throw new Error('jwt expired'); });

      const req = mockReq({ headers: { authorization: 'Bearer expired-token' }, user: { id: 'user-123' } });
      const res = mockRes();
      const next = jest.fn();

      await logout(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Logged out successfully' });
    });

    test('test_logout_withRefreshTokenInBody_revokesRefreshToken', async () => {
      const req = mockReq({ body: { refreshToken: 'raw-rt' }, user: { id: 'user-123' } });
      const res = mockRes();
      const next = jest.fn();

      await logout(req, res, next);

      expect(mockDbChain.from).toHaveBeenCalledWith('refresh_tokens');
      expect(mockDbChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ is_revoked: true, revoked_reason: 'logout' })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('test_logout_noTokens_stillSucceeds', async () => {
      const req = mockReq({ headers: {}, body: {}, cookies: {}, user: { id: 'user-123' } });
      const res = mockRes();
      const next = jest.fn();

      await logout(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ── logoutAll ──────────────────────────────────────────────────────────────
  describe('logoutAll', () => {
    test('test_logoutAll_validUser_revokesAllSessionsAndClears', async () => {
      mockDbChain.select.mockResolvedValueOnce({ data: [{ id: 'tok-1' }, { id: 'tok-2' }], error: null });

      const req = mockReq({ user: { id: 'user-123' } });
      const res = mockRes();
      const next = jest.fn();

      await logoutAll(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, revokedSessions: 2 })
      );
    });

    test('test_logoutAll_noActiveSessions_returnsZeroRevoked', async () => {
      mockDbChain.select.mockResolvedValueOnce({ data: [], error: null });

      const req = mockReq({ user: { id: 'user-123' } });
      const res = mockRes();
      const next = jest.fn();

      await logoutAll(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ revokedSessions: 0 })
      );
    });

    test('test_logoutAll_dbError_callsNextWithError', async () => {
      mockDbChain.select.mockResolvedValueOnce({ data: null, error: new Error('DB error') });

      const req = mockReq({ user: { id: 'user-123' } });
      const res = mockRes();
      const next = jest.fn();

      await logoutAll(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // ── getSessions ────────────────────────────────────────────────────────────
  describe('getSessions', () => {
    test('test_getSessions_activeSessions_returnsSessionList', async () => {
      const mockSessions = [
        { id: 'sess-1', device_info: 'Chrome/120', ip_address: '1.2.3.4', created_at: '2026-01-01', expires_at: '2026-01-08' },
      ];
      mockDbChain.order.mockResolvedValueOnce({ data: mockSessions, error: null });

      const req = mockReq({ user: { id: 'user-123' } });
      const res = mockRes();
      const next = jest.fn();

      await getSessions(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        sessions: [
          { id: 'sess-1', device: 'Chrome/120', ip: '1.2.3.4', createdAt: '2026-01-01', expiresAt: '2026-01-08' },
        ],
        count: 1,
      });
    });

    test('test_getSessions_noActiveSessions_returnsEmptyList', async () => {
      mockDbChain.order.mockResolvedValueOnce({ data: [], error: null });

      const req = mockReq({ user: { id: 'user-123' } });
      const res = mockRes();
      const next = jest.fn();

      await getSessions(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, sessions: [], count: 0 });
    });

    test('test_getSessions_dbError_callsNextWithError', async () => {
      mockDbChain.order.mockResolvedValueOnce({ data: null, error: new Error('DB error') });

      const req = mockReq({ user: { id: 'user-123' } });
      const res = mockRes();
      const next = jest.fn();

      await getSessions(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // ── revokeSession ──────────────────────────────────────────────────────────
  describe('revokeSession', () => {
    test('test_revokeSession_validSessionId_revokesSuccessfully', async () => {
      mockDbChain.select.mockResolvedValueOnce({ data: [{ id: 'sess-1' }], error: null });

      const req = mockReq({ user: { id: 'user-123' }, params: { sessionId: 'sess-1' } });
      const res = mockRes();
      const next = jest.fn();

      await revokeSession(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Session revoked' });
    });

    test('test_revokeSession_sessionNotFound_returns404', async () => {
      mockDbChain.select.mockResolvedValueOnce({ data: [], error: null });

      const req = mockReq({ user: { id: 'user-123' }, params: { sessionId: 'ghost-session' } });
      const res = mockRes();
      const next = jest.fn();

      await revokeSession(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Session not found' });
    });

    test('test_revokeSession_dbError_callsNextWithError', async () => {
      mockDbChain.select.mockResolvedValueOnce({ data: null, error: new Error('DB error') });

      const req = mockReq({ user: { id: 'user-123' }, params: { sessionId: 'sess-1' } });
      const res = mockRes();
      const next = jest.fn();

      await revokeSession(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // ── resetPassword ──────────────────────────────────────────────────────────
  describe('resetPassword', () => {
    test('test_resetPassword_emailNotFound_returns400', async () => {
      repositories.users.findByEmail.mockResolvedValueOnce(null);

      const req = mockReq({ body: { email: 'ghost@test.com' } });
      const res = mockRes();
      const next = jest.fn();

      await resetPassword(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'User not found' });
    });

    test('test_resetPassword_validEmail_sendsResetEmailAndReturns200', async () => {
      repositories.users.findByEmail.mockResolvedValueOnce({ id: 'user-123', email: 'alice@test.com' });
      repositories.users.setPasswordResetToken.mockResolvedValueOnce({});

      const req = mockReq({ body: { email: 'alice@test.com' } });
      const res = mockRes();
      const next = jest.fn();

      await resetPassword(req, res, next);

      expect(repositories.users.setPasswordResetToken).toHaveBeenCalledWith(
        'user-123',
        expect.any(String),
        expect.any(Date)
      );
      expect(mockSendMail).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Recovery email sent' });
    });

    test('test_resetPassword_mailerThrows_callsNextWithError', async () => {
      repositories.users.findByEmail.mockResolvedValueOnce({ id: 'user-123', email: 'alice@test.com' });
      repositories.users.setPasswordResetToken.mockResolvedValueOnce({});
      mockSendMail.mockRejectedValueOnce(new Error('SMTP error'));

      const req = mockReq({ body: { email: 'alice@test.com' } });
      const res = mockRes();
      const next = jest.fn();

      await resetPassword(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // ── confirmResetPassword ───────────────────────────────────────────────────
  describe('confirmResetPassword', () => {
    test('test_confirmResetPassword_missingTokenOrPassword_returns400', async () => {
      const req = mockReq({ body: { token: 'abc' } }); // missing newPassword
      const res = mockRes();
      const next = jest.fn();

      await confirmResetPassword(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Token and new password are required' })
      );
    });

    test('test_confirmResetPassword_passwordTooShort_returns400', async () => {
      const req = mockReq({ body: { token: 'abc', newPassword: 'ab' } });
      const res = mockRes();
      const next = jest.fn();

      await confirmResetPassword(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Password must be at least 6 characters' })
      );
    });

    test('test_confirmResetPassword_invalidToken_returns400', async () => {
      mockDbChain.single.mockResolvedValueOnce({ data: null, error: new Error('not found') });

      const req = mockReq({ body: { token: 'bad-token', newPassword: 'newpass123' } });
      const res = mockRes();
      const next = jest.fn();

      await confirmResetPassword(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Invalid or expired reset token' })
      );
    });

    test('test_confirmResetPassword_expiredToken_returns400', async () => {
      mockDbChain.single.mockResolvedValueOnce({
        data: {
          id: 'user-123',
          password_reset_token: 'valid-token',
          password_reset_expires: new Date(Date.now() - 1000).toISOString(),
        },
        error: null,
      });

      const req = mockReq({ body: { token: 'valid-token', newPassword: 'newpass123' } });
      const res = mockRes();
      const next = jest.fn();

      await confirmResetPassword(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Reset token has expired. Please request a new one.' })
      );
    });

    test('test_confirmResetPassword_validTokenAndPassword_resetsPasswordAndRevokesAllSessions', async () => {
      mockDbChain.single.mockResolvedValueOnce({
        data: {
          id: 'user-123',
          password_reset_token: 'valid-token',
          password_reset_expires: new Date(Date.now() + 3600000).toISOString(),
        },
        error: null,
      });
      repositories.users.updatePassword.mockResolvedValueOnce({});

      const req = mockReq({ body: { token: 'valid-token', newPassword: 'newpass123' } });
      const res = mockRes();
      const next = jest.fn();

      await confirmResetPassword(req, res, next);

      expect(repositories.users.updatePassword).toHaveBeenCalledWith('user-123', 'newpass123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: expect.stringContaining('Password reset successful') })
      );
    });

    test('test_confirmResetPassword_dbThrows_callsNextWithError', async () => {
      mockDbChain.single.mockRejectedValueOnce(new Error('DB error'));

      const req = mockReq({ body: { token: 'abc', newPassword: 'newpass123' } });
      const res = mockRes();
      const next = jest.fn();

      await confirmResetPassword(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // ── getUserData ────────────────────────────────────────────────────────────
  describe('getUserData', () => {
    test('test_getUserData_userNotFound_returns404', async () => {
      repositories.users.findById.mockResolvedValueOnce(null);

      const req = mockReq({ user: { id: 'user-123' } });
      const res = mockRes();
      const next = jest.fn();

      await getUserData(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'User not found' });
    });

    test('test_getUserData_validUser_returnsFullUserObject', async () => {
      repositories.users.findById.mockResolvedValueOnce({
        id: 'user-123',
        email: 'alice@test.com',
        email_verified: true,
        is_active: true,
        last_login_at: '2026-01-01',
        created_at: '2025-01-01',
      });
      repositories.userProfiles.findByUserId.mockResolvedValueOnce({
        full_name: 'Alice',
        phone: '+233201234567',
        avatar_url: 'avatars/alice.jpg',
        address_line1: '1 Main St',
        address_line2: null,
        city: 'Accra',
        state_province: 'Greater Accra',
        postal_code: '00233',
        country: 'Ghana',
        latitude: 5.6,
        longitude: -0.2,
        onboarding_state: { welcome: true },
        referral_code: 'SHPY-ABC',
        wallet_balance: 50,
      });
      repositories.roles.getUserRoles.mockResolvedValueOnce([
        { id: 'ur-1', role: { name: 'buyer', display_name: 'Buyer' }, assigned_at: '2026-01-01' },
      ]);

      const req = mockReq({ user: { id: 'user-123' } });
      const res = mockRes();
      const next = jest.fn();

      await getUserData(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const payload = res.json.mock.calls[0][0];
      expect(payload.id).toBe('user-123');
      expect(payload.email).toBe('alice@test.com');
      expect(payload.name).toBe('Alice');
      expect(payload.role).toBe('buyer');
      expect(payload.roles).toHaveLength(1);
      expect(payload.wallet_balance).toBe(50);
    });

    test('test_getUserData_noProfile_usesEmailAsName', async () => {
      repositories.users.findById.mockResolvedValueOnce({
        id: 'user-123',
        email: 'alice@test.com',
        email_verified: false,
        is_active: true,
        last_login_at: null,
        created_at: '2025-01-01',
      });
      repositories.userProfiles.findByUserId.mockResolvedValueOnce(null);
      repositories.roles.getUserRoles.mockResolvedValueOnce([]);

      const req = mockReq({ user: { id: 'user-123' } });
      const res = mockRes();
      const next = jest.fn();

      await getUserData(req, res, next);

      const payload = res.json.mock.calls[0][0];
      expect(payload.name).toBe('alice@test.com');
      expect(payload.role).toBe('none');
      expect(payload.wallet_balance).toBe(0);
    });

    test('test_getUserData_dbThrows_callsNextWithError', async () => {
      repositories.users.findById.mockRejectedValueOnce(new Error('DB error'));

      const req = mockReq({ user: { id: 'user-123' } });
      const res = mockRes();
      const next = jest.fn();

      await getUserData(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // ── addRole ────────────────────────────────────────────────────────────────
  describe('addRole', () => {
    test('test_addRole_invalidRole_returns400', async () => {
      const req = mockReq({ user: { id: 'user-123' }, body: { role: 'admin' } });
      const res = mockRes();
      const next = jest.fn();

      await addRole(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Invalid role. Must be buyer, seller, or driver' })
      );
    });

    test('test_addRole_userAlreadyHasRole_returns400', async () => {
      repositories.roles.userHasRole.mockResolvedValueOnce(true);

      const req = mockReq({ user: { id: 'user-123' }, body: { role: 'buyer' } });
      const res = mockRes();
      const next = jest.fn();

      await addRole(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'You already have the buyer role' })
      );
    });

    test('test_addRole_roleNotFoundInDb_returns404', async () => {
      repositories.roles.userHasRole.mockResolvedValueOnce(false);
      repositories.roles.findByName.mockResolvedValueOnce(null);

      const req = mockReq({ user: { id: 'user-123' }, body: { role: 'seller' } });
      const res = mockRes();
      const next = jest.fn();

      await addRole(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Role not found' })
      );
    });

    test('test_addRole_validRole_assignsRoleAndPublishesMessages', async () => {
      const rabbitMQ = require('../../services/rabbitmq');
      repositories.roles.userHasRole.mockResolvedValueOnce(false);
      repositories.roles.findByName.mockResolvedValueOnce({ id: 'role-buyer-id', name: 'buyer' });
      repositories.roles.assignRoleToUser.mockResolvedValueOnce({});
      repositories.users.findById.mockResolvedValueOnce({ id: 'user-123', email: 'alice@test.com' });
      repositories.userProfiles.findByUserId.mockResolvedValueOnce({ full_name: 'Alice', phone: '+233201234567' });

      const req = mockReq({ user: { id: 'user-123' }, body: { role: 'buyer' } });
      const res = mockRes();
      const next = jest.fn();

      await addRole(req, res, next);

      expect(repositories.roles.assignRoleToUser).toHaveBeenCalledWith('user-123', 'role-buyer-id');
      expect(rabbitMQ.publishMessage).toHaveBeenCalledWith('email', expect.objectContaining({ eventType: 'ROLE_SELECTED_EMAIL' }));
      expect(rabbitMQ.publishMessage).toHaveBeenCalledWith('sms', expect.objectContaining({ eventType: 'ROLE_SELECTED_SMS' }));
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Buyer role added successfully' });
    });

    test('test_addRole_dbThrows_callsNextWithError', async () => {
      repositories.roles.userHasRole.mockRejectedValueOnce(new Error('DB error'));

      const req = mockReq({ user: { id: 'user-123' }, body: { role: 'buyer' } });
      const res = mockRes();
      const next = jest.fn();

      await addRole(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // ── getUserRoles ───────────────────────────────────────────────────────────
  describe('getUserRoles', () => {
    test('test_getUserRoles_validUser_returnsMappedRoles', async () => {
      repositories.roles.getUserRoles.mockResolvedValueOnce([
        { id: 'ur-1', role: { name: 'buyer', display_name: 'Buyer', description: 'A buyer' }, assigned_at: '2026-01-01' },
        { id: 'ur-2', role: null }, // should be filtered out
      ]);

      const req = mockReq({ user: { id: 'user-123' } });
      const res = mockRes();
      const next = jest.fn();

      await getUserRoles(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const { roles } = res.json.mock.calls[0][0];
      expect(roles).toHaveLength(1);
      expect(roles[0]).toMatchObject({ name: 'buyer', displayName: 'Buyer' });
    });

    test('test_getUserRoles_noRoles_returnsEmptyArray', async () => {
      repositories.roles.getUserRoles.mockResolvedValueOnce([]);

      const req = mockReq({ user: { id: 'user-123' } });
      const res = mockRes();
      const next = jest.fn();

      await getUserRoles(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, roles: [] });
    });

    test('test_getUserRoles_dbThrows_callsNextWithError', async () => {
      repositories.roles.getUserRoles.mockRejectedValueOnce(new Error('DB error'));

      const req = mockReq({ user: { id: 'user-123' } });
      const res = mockRes();
      const next = jest.fn();

      await getUserRoles(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // ── updateUserRole ─────────────────────────────────────────────────────────
  describe('updateUserRole', () => {
    test('test_updateUserRole_missingRole_returns400', async () => {
      const req = mockReq({ user: { id: 'user-123' }, body: {} });
      const res = mockRes();
      const next = jest.fn();

      await updateUserRole(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Role is required' });
    });

    test('test_updateUserRole_invalidRoleValue_returns400', async () => {
      const req = mockReq({ user: { id: 'user-123' }, body: { role: 'wizard' } });
      const res = mockRes();
      const next = jest.fn();

      await updateUserRole(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('Invalid role') })
      );
    });

    test('test_updateUserRole_userNotFound_returns404', async () => {
      repositories.users.findById.mockResolvedValueOnce(null);

      const req = mockReq({ user: { id: 'user-123' }, body: { role: 'seller' } });
      const res = mockRes();
      const next = jest.fn();

      await updateUserRole(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'User not found' });
    });

    test('test_updateUserRole_validRole_updatesAndClears', async () => {
      repositories.users.findById.mockResolvedValueOnce({ id: 'user-123' });
      repositories.users.setRole.mockResolvedValueOnce({});

      const req = mockReq({ user: { id: 'user-123' }, body: { role: 'customer' } }); // maps to buyer
      const res = mockRes();
      const next = jest.fn();

      await updateUserRole(req, res, next);

      expect(repositories.users.setRole).toHaveBeenCalledWith('user-123', 'buyer');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Role updated successfully' });
    });

    test('test_updateUserRole_dbThrows_callsNextWithError', async () => {
      repositories.users.findById.mockRejectedValueOnce(new Error('DB error'));

      const req = mockReq({ user: { id: 'user-123' }, body: { role: 'buyer' } });
      const res = mockRes();
      const next = jest.fn();

      await updateUserRole(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // ── updateProfile ──────────────────────────────────────────────────────────
  describe('updateProfile', () => {
    test('test_updateProfile_validFields_updatesProfileAndClears', async () => {
      repositories.userProfiles.updateByUserId.mockResolvedValueOnce({
        full_name: 'Alice Updated',
        phone: '+233201234567',
      });

      const req = mockReq({
        user: { id: 'user-123' },
        body: { name: 'Alice Updated', phone: '+233201234567', city: 'Kumasi' },
      });
      const res = mockRes();
      const next = jest.fn();

      await updateProfile(req, res, next);

      expect(repositories.userProfiles.updateByUserId).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({ full_name: 'Alice Updated', city: 'Kumasi' })
      );
      const { cacheDel } = require('../../config/redis');
      expect(cacheDel).toHaveBeenCalledWith('shopyos:users:user-123:auth');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Profile updated successfully' })
      );
    });

    test('test_updateProfile_onlyUndefinedFields_updatesNothing', async () => {
      repositories.userProfiles.updateByUserId.mockResolvedValueOnce({});

      const req = mockReq({ user: { id: 'user-123' }, body: {} });
      const res = mockRes();
      const next = jest.fn();

      await updateProfile(req, res, next);

      expect(repositories.userProfiles.updateByUserId).toHaveBeenCalledWith('user-123', {});
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('test_updateProfile_phoneSanitization_removesExtraPlusSigns', async () => {
      repositories.userProfiles.updateByUserId.mockResolvedValueOnce({});

      const req = mockReq({ user: { id: 'user-123' }, body: { phone: '++233201234567' } });
      const res = mockRes();
      const next = jest.fn();

      await updateProfile(req, res, next);

      expect(repositories.userProfiles.updateByUserId).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({ phone: '+233201234567' })
      );
    });

    test('test_updateProfile_dbThrows_callsNextWithError', async () => {
      repositories.userProfiles.updateByUserId.mockRejectedValueOnce(new Error('DB error'));

      const req = mockReq({ user: { id: 'user-123' }, body: { name: 'Alice' } });
      const res = mockRes();
      const next = jest.fn();

      await updateProfile(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // ── updateUserLocation ─────────────────────────────────────────────────────
  describe('updateUserLocation', () => {
    test('test_updateUserLocation_missingLatOrLng_returns400', async () => {
      const req = mockReq({ user: { id: 'user-123' }, body: { latitude: 5.6 } }); // missing longitude
      const res = mockRes();
      const next = jest.fn();

      await updateUserLocation(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Latitude and longitude are required' });
    });

    test('test_updateUserLocation_validCoords_updatesProfileAndReturns200', async () => {
      repositories.userProfiles.updateByUserId.mockResolvedValueOnce({});

      const req = mockReq({ user: { id: 'user-123' }, body: { latitude: '5.6037', longitude: '-0.1870' } });
      const res = mockRes();
      const next = jest.fn();

      await updateUserLocation(req, res, next);

      expect(repositories.userProfiles.updateByUserId).toHaveBeenCalledWith('user-123', {
        latitude: 5.6037,
        longitude: -0.187,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Location updated successfully' });
    });

    test('test_updateUserLocation_dbThrows_callsNextWithError', async () => {
      repositories.userProfiles.updateByUserId.mockRejectedValueOnce(new Error('DB error'));

      const req = mockReq({ user: { id: 'user-123' }, body: { latitude: 5.6, longitude: -0.2 } });
      const res = mockRes();
      const next = jest.fn();

      await updateUserLocation(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // ── updateOnboardingState ──────────────────────────────────────────────────
  describe('updateOnboardingState', () => {
    test('test_updateOnboardingState_missingScreen_returns400', async () => {
      const req = mockReq({ user: { id: 'user-123' }, body: {} });
      const res = mockRes();
      const next = jest.fn();

      await updateOnboardingState(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Screen key is required' });
    });

    test('test_updateOnboardingState_validScreen_mergesAndPersistsState', async () => {
      repositories.userProfiles.findByUserId.mockResolvedValueOnce({
        onboarding_state: { welcome: true },
      });
      repositories.userProfiles.updateByUserId.mockResolvedValueOnce({
        onboarding_state: { welcome: true, profile_setup: true },
      });

      const req = mockReq({ user: { id: 'user-123' }, body: { screen: 'profile_setup', completed: true } });
      const res = mockRes();
      const next = jest.fn();

      await updateOnboardingState(req, res, next);

      expect(repositories.userProfiles.updateByUserId).toHaveBeenCalledWith('user-123', {
        onboarding_state: { welcome: true, profile_setup: true },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Onboarding for profile_setup updated' })
      );
    });

    test('test_updateOnboardingState_noExistingState_createsNewState', async () => {
      repositories.userProfiles.findByUserId.mockResolvedValueOnce(null); // no profile yet
      repositories.userProfiles.updateByUserId.mockResolvedValueOnce({
        onboarding_state: { welcome: false },
      });

      const req = mockReq({ user: { id: 'user-123' }, body: { screen: 'welcome', completed: false } });
      const res = mockRes();
      const next = jest.fn();

      await updateOnboardingState(req, res, next);

      expect(repositories.userProfiles.updateByUserId).toHaveBeenCalledWith('user-123', {
        onboarding_state: { welcome: false },
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('test_updateOnboardingState_defaultsCompletedToTrue', async () => {
      repositories.userProfiles.findByUserId.mockResolvedValueOnce({ onboarding_state: {} });
      repositories.userProfiles.updateByUserId.mockResolvedValueOnce({
        onboarding_state: { payment_setup: true },
      });

      const req = mockReq({ user: { id: 'user-123' }, body: { screen: 'payment_setup' } }); // no completed field
      const res = mockRes();
      const next = jest.fn();

      await updateOnboardingState(req, res, next);

      expect(repositories.userProfiles.updateByUserId).toHaveBeenCalledWith('user-123', {
        onboarding_state: { payment_setup: true },
      });
    });

    test('test_updateOnboardingState_dbThrows_callsNextWithError', async () => {
      repositories.userProfiles.findByUserId.mockRejectedValueOnce(new Error('DB error'));

      const req = mockReq({ user: { id: 'user-123' }, body: { screen: 'welcome' } });
      const res = mockRes();
      const next = jest.fn();

      await updateOnboardingState(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
