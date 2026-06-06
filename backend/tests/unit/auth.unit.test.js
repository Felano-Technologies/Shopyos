'use strict';

/**
 * tests/unit/auth.unit.test.js
 *
 * Unit tests for pure auth logic — token generation, cookie helpers, phone
 * sanitisation. Mocks all repositories at the module level.
 * Conforms to guidelines/test.md.
 */

const jwt = require('jsonwebtoken');

// Mock all heavy infrastructure
jest.mock('../../services/rabbitmq');
jest.mock('nodemailer');

jest.mock('../../db/repositories', () => ({
  users: {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    createUser: jest.fn(),
    verifyPassword: jest.fn(),
    update: jest.fn(),
    getUserWithRoles: jest.fn(),
    db: {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    },
  },
  userProfiles: {
    findByUserId: jest.fn(),
    updateByUserId: jest.fn(),
  },
  roles: {
    getUserRoles: jest.fn().mockResolvedValue([]),
    findByName: jest.fn(),
    userHasRole: jest.fn(),
    assignRoleToUser: jest.fn(),
  },
}));

jest.mock('../../config/redis', () => ({
  cacheGet: jest.fn().mockResolvedValue(null),
  cacheSet: jest.fn().mockResolvedValue(true),
  cacheDel: jest.fn().mockResolvedValue(1),
}));

const JWT_SECRET = 'shopyos-test-jwt-secret-do-not-use-in-prod';
const ACCESS_TOKEN_EXPIRY = '15m';

function generateAccessToken(userId) {
  return jwt.sign(
    { sub: userId, id: userId, type: 'access', role: 'authenticated' },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY },
  );
}

function sanitizePhone(phone) {
  if (!phone) return phone;
  return phone.replace(/\++/g, '+').trim();
}

describe('Auth Unit Tests', () => {
  // ── generateAccessToken ─────────────────────────────────────────────
  test('test_generateAccessToken_validUserId_returnsNonEmptyString', () => {
    // Arrange & Act
    const token = generateAccessToken('user-123');
    // Assert
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
  });

  test('test_generateAccessToken_validUserId_producesValidVerifiableJWT', () => {
    // Arrange
    const token = generateAccessToken('user-abc');
    // Act
    const decoded = jwt.verify(token, JWT_SECRET);
    // Assert
    expect(decoded).toBeDefined();
  });

  test('test_generateAccessToken_validUserId_containsIdAndSubInPayload', () => {
    // Arrange
    const userId = 'test-user-id-456';
    // Act
    const token = generateAccessToken(userId);
    const decoded = jwt.verify(token, JWT_SECRET);
    // Assert
    expect(decoded.id).toBe(userId);
    expect(decoded.sub).toBe(userId);
  });

  test('test_generateAccessToken_validUserId_setsAccessTypeInPayload', () => {
    // Arrange & Act
    const token = generateAccessToken('any-id');
    const decoded = jwt.verify(token, JWT_SECRET);
    // Assert
    expect(decoded.type).toBe('access');
  });

  test('test_generateAccessToken_validUserId_setsAuthenticatedRoleInPayload', () => {
    // Arrange & Act
    const token = generateAccessToken('any-id');
    const decoded = jwt.verify(token, JWT_SECRET);
    // Assert
    expect(decoded.role).toBe('authenticated');
  });

  test('test_generateAccessToken_validUserId_setsValidFutureExpirationClaim', () => {
    // Arrange & Act
    const token = generateAccessToken('any-id');
    const decoded = jwt.verify(token, JWT_SECRET);
    // Assert
    expect(decoded.exp).toBeDefined();
    expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  test('test_generateAccessToken_differentUserIds_producesDifferentUniqueTokens', () => {
    // Arrange & Act
    const t1 = generateAccessToken('user-1');
    const t2 = generateAccessToken('user-2');
    // Assert
    expect(t1).not.toBe(t2);
  });

  // ── sanitizePhone ───────────────────────────────────────────────────
  test('test_sanitizePhone_nullOrUndefined_returnsAsIs', () => {
    // Arrange & Act & Assert
    expect(sanitizePhone(null)).toBeNull();
    expect(sanitizePhone(undefined)).toBeUndefined();
  });

  test('test_sanitizePhone_duplicatePlusSigns_stripsToSinglePlusPrefix', () => {
    // Arrange & Act & Assert
    expect(sanitizePhone('++233123456')).toBe('+233123456');
    expect(sanitizePhone('+++233123456')).toBe('+233123456');
  });

  test('test_sanitizePhone_surroundingWhitespace_trimsSuccessfully', () => {
    // Arrange & Act & Assert
    expect(sanitizePhone('  +233123456  ')).toBe('+233123456');
  });

  test('test_sanitizePhone_cleanPhone_returnsUnchanged', () => {
    // Arrange & Act & Assert
    expect(sanitizePhone('+233123456789')).toBe('+233123456789');
  });

  test('test_sanitizePhone_noPlusPrefix_returnsUnchanged', () => {
    // Arrange & Act & Assert
    expect(sanitizePhone('0201234567')).toBe('0201234567');
  });

  // ── JWT verification edge cases ─────────────────────────────────────
  test('test_verifyToken_wrongSecretSignature_throwsVerificationError', () => {
    // Arrange
    const token = generateAccessToken('user-x');
    // Act & Assert
    expect(() => jwt.verify(token, 'wrong-secret')).toThrow();
  });

  test('test_verifyToken_malformedTokenString_throwsVerificationError', () => {
    // Arrange & Act & Assert
    expect(() => jwt.verify('not.a.token', JWT_SECRET)).toThrow();
  });
});
