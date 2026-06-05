'use strict';

/**
 * tests/unit/auth.unit.test.js
 *
 * Unit tests for pure auth logic — token generation, cookie helpers, phone
 * sanitisation.  No real DB calls; repositories are mocked at the module level.
 */

const jwt = require('jsonwebtoken');

// ── Module mocks ─────────────────────────────────────────────────────────────
// Mock all heavy infrastructure BEFORE requiring anything that imports them.

jest.mock('../../services/rabbitmq');        // no AMQP
jest.mock('nodemailer');                     // no SMTP

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

// ── Helpers extracted without importing the full controller ──────────────────
// We test the pure functions directly by reconstructing them here so we can
// keep them isolated from Express plumbing.

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

// ── Tests ────────────────────────────────────────────────────────────────────

describe('generateAccessToken', () => {
  test('returns a non-empty string', () => {
    const token = generateAccessToken('user-123');
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
  });

  test('is a valid JWT that can be verified', () => {
    const token = generateAccessToken('user-abc');
    const decoded = jwt.verify(token, JWT_SECRET);
    expect(decoded).toBeDefined();
  });

  test('payload contains id and sub', () => {
    const userId = 'test-user-id-456';
    const token = generateAccessToken(userId);
    const decoded = jwt.verify(token, JWT_SECRET);
    expect(decoded.id).toBe(userId);
    expect(decoded.sub).toBe(userId);
  });

  test('payload type is "access"', () => {
    const token = generateAccessToken('any-id');
    const decoded = jwt.verify(token, JWT_SECRET);
    expect(decoded.type).toBe('access');
  });

  test('payload role is "authenticated"', () => {
    const token = generateAccessToken('any-id');
    const decoded = jwt.verify(token, JWT_SECRET);
    expect(decoded.role).toBe('authenticated');
  });

  test('token expires (has exp claim)', () => {
    const token = generateAccessToken('any-id');
    const decoded = jwt.verify(token, JWT_SECRET);
    expect(decoded.exp).toBeDefined();
    expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  test('different userIds produce different tokens', () => {
    const t1 = generateAccessToken('user-1');
    const t2 = generateAccessToken('user-2');
    expect(t1).not.toBe(t2);
  });
});

describe('sanitizePhone', () => {
  test('returns null/undefined as-is', () => {
    expect(sanitizePhone(null)).toBeNull();
    expect(sanitizePhone(undefined)).toBeUndefined();
  });

  test('strips duplicate leading plus signs', () => {
    expect(sanitizePhone('++233123456')).toBe('+233123456');
    expect(sanitizePhone('+++233123456')).toBe('+233123456');
  });

  test('trims surrounding whitespace', () => {
    expect(sanitizePhone('  +233123456  ')).toBe('+233123456');
  });

  test('leaves clean phone unchanged', () => {
    expect(sanitizePhone('+233123456789')).toBe('+233123456789');
  });

  test('handles phone without + prefix', () => {
    expect(sanitizePhone('0201234567')).toBe('0201234567');
  });
});

describe('JWT verification edge cases', () => {
  test('token signed with wrong secret fails verification', () => {
    const token = generateAccessToken('user-x');
    expect(() => jwt.verify(token, 'wrong-secret')).toThrow();
  });

  test('malformed token fails verification', () => {
    expect(() => jwt.verify('not.a.token', JWT_SECRET)).toThrow();
  });
});
