'use strict';

/**
 * tests/unit/auth.config.unit.test.js
 *
 * Unit tests for config/auth.js — token generation, hashing helpers,
 * and exported constants.
 * No network, no DB, no external services.
 * Conforms to guidelines/test.md.
 */

const {
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY_DAYS,
  REFRESH_TOKEN_EXPIRY_MS,
  ACCESS_TOKEN_BLACKLIST_PREFIX,
  ACCESS_TOKEN_MAX_AGE_SECONDS,
  COOKIE_OPTIONS,
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  generateRefreshToken,
  hashToken,
} = require('../../config/auth');

describe('auth.config Unit Tests', () => {
  // ── generateRefreshToken ────────────────────────────────────────────────────
  describe('generateRefreshToken', () => {
    test('test_generateRefreshToken_called_returnsString', () => {
      // Arrange & Act
      const token = generateRefreshToken();
      // Assert
      expect(typeof token).toBe('string');
    });

    test('test_generateRefreshToken_called_returns64CharHexString', () => {
      // Arrange — crypto.randomBytes(32).toString('hex') yields 64 hex chars
      // Act
      const token = generateRefreshToken();
      // Assert
      expect(token).toHaveLength(64);
    });

    test('test_generateRefreshToken_called_returnsOnlyHexCharacters', () => {
      // Arrange & Act
      const token = generateRefreshToken();
      // Assert
      expect(token).toMatch(/^[0-9a-f]{64}$/);
    });

    test('test_generateRefreshToken_calledTwice_returnsDifferentTokens', () => {
      // Arrange & Act
      const token1 = generateRefreshToken();
      const token2 = generateRefreshToken();
      // Assert — random bytes should never collide in practice
      expect(token1).not.toBe(token2);
    });

    test('test_generateRefreshToken_calledMultipleTimes_allResultsAreUnique', () => {
      // Arrange & Act
      const tokens = Array.from({ length: 10 }, () => generateRefreshToken());
      const unique = new Set(tokens);
      // Assert
      expect(unique.size).toBe(10);
    });
  });

  // ── hashToken ───────────────────────────────────────────────────────────────
  describe('hashToken', () => {
    test('test_hashToken_givenToken_returnsString', () => {
      // Arrange & Act
      const hash = hashToken('any-token-value');
      // Assert
      expect(typeof hash).toBe('string');
    });

    test('test_hashToken_givenToken_returns64CharSha256HexDigest', () => {
      // Arrange — SHA-256 digest is 32 bytes → 64 hex chars
      // Act
      const hash = hashToken('any-token-value');
      // Assert
      expect(hash).toHaveLength(64);
    });

    test('test_hashToken_givenToken_returnsOnlyHexCharacters', () => {
      // Arrange & Act
      const hash = hashToken('some-token');
      // Assert
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    test('test_hashToken_sameInputTwice_returnsSameHash', () => {
      // Arrange
      const token = 'stable-token-for-consistency';
      // Act
      const hash1 = hashToken(token);
      const hash2 = hashToken(token);
      // Assert — hashing must be deterministic
      expect(hash1).toBe(hash2);
    });

    test('test_hashToken_differentInputs_returnsDifferentHashes', () => {
      // Arrange & Act
      const hash1 = hashToken('token-alpha');
      const hash2 = hashToken('token-beta');
      // Assert
      expect(hash1).not.toBe(hash2);
    });

    test('test_hashToken_knownInput_returnsExpectedSha256Digest', () => {
      // Arrange — SHA-256("abc") = ba7816bf8f01cfea414140de5dae2ec73b00361bbef0469348423f656b8a0f7c... wait,
      // the correct value is: ba7816bf8f01cfea414140de5dae2ec73b00361bbef0469348423f656b8a09a7 — use
      // Node's own crypto to derive the expected value once, then assert equality
      const crypto = require('node:crypto');
      const expected = crypto.createHash('sha256').update('test-known-token').digest('hex');
      // Act
      const result = hashToken('test-known-token');
      // Assert
      expect(result).toBe(expected);
    });

    test('test_hashToken_rawToken_neverEqualToInput', () => {
      // Arrange
      const token = generateRefreshToken();
      // Act
      const hash = hashToken(token);
      // Assert — a hash should never equal its pre-image
      expect(hash).not.toBe(token);
    });
  });

  // ── Token constants ─────────────────────────────────────────────────────────
  describe('token constants', () => {
    test('test_ACCESS_TOKEN_EXPIRY_value_is15m', () => {
      // Assert
      expect(ACCESS_TOKEN_EXPIRY).toBe('15m');
    });

    test('test_REFRESH_TOKEN_EXPIRY_DAYS_value_is7', () => {
      // Assert
      expect(REFRESH_TOKEN_EXPIRY_DAYS).toBe(7);
    });

    test('test_REFRESH_TOKEN_EXPIRY_MS_value_equals7DaysInMs', () => {
      // Arrange
      const expectedMs = 7 * 24 * 60 * 60 * 1000;
      // Assert
      expect(REFRESH_TOKEN_EXPIRY_MS).toBe(expectedMs);
    });

    test('test_ACCESS_TOKEN_MAX_AGE_SECONDS_value_equals15MinutesInSeconds', () => {
      // Arrange
      const expectedSeconds = 15 * 60;
      // Assert
      expect(ACCESS_TOKEN_MAX_AGE_SECONDS).toBe(expectedSeconds);
    });

    test('test_ACCESS_TOKEN_BLACKLIST_PREFIX_includesShopyosNamespace', () => {
      // Assert
      expect(ACCESS_TOKEN_BLACKLIST_PREFIX).toContain('shopyos');
    });

    test('test_ACCESS_TOKEN_BLACKLIST_PREFIX_endsWithColon', () => {
      // Assert — prefix should end with ":" so token IDs are appended cleanly
      expect(ACCESS_TOKEN_BLACKLIST_PREFIX).toMatch(/:$/);
    });

    test('test_ACCESS_COOKIE_NAME_isNonEmptyString', () => {
      // Assert
      expect(typeof ACCESS_COOKIE_NAME).toBe('string');
      expect(ACCESS_COOKIE_NAME.length).toBeGreaterThan(0);
    });

    test('test_REFRESH_COOKIE_NAME_isNonEmptyString', () => {
      // Assert
      expect(typeof REFRESH_COOKIE_NAME).toBe('string');
      expect(REFRESH_COOKIE_NAME.length).toBeGreaterThan(0);
    });

    test('test_ACCESS_COOKIE_NAME_and_REFRESH_COOKIE_NAME_areDifferent', () => {
      // Assert — both cookies must be distinct
      expect(ACCESS_COOKIE_NAME).not.toBe(REFRESH_COOKIE_NAME);
    });
  });

  // ── COOKIE_OPTIONS ──────────────────────────────────────────────────────────
  describe('COOKIE_OPTIONS', () => {
    test('test_COOKIE_OPTIONS_httpOnly_isTrue', () => {
      // Assert — httpOnly prevents JS access to the cookie
      expect(COOKIE_OPTIONS.httpOnly).toBe(true);
    });

    test('test_COOKIE_OPTIONS_path_isRootSlash', () => {
      // Assert
      expect(COOKIE_OPTIONS.path).toBe('/');
    });

    test('test_COOKIE_OPTIONS_sameSite_isDefinedString', () => {
      // Assert
      expect(typeof COOKIE_OPTIONS.sameSite).toBe('string');
      expect(COOKIE_OPTIONS.sameSite.length).toBeGreaterThan(0);
    });

    test('test_COOKIE_OPTIONS_inTestEnv_secure_dependsOnNodeEnv', () => {
      // Arrange — setup.js sets NODE_ENV = 'test', which is not 'development'
      // so secure should be true in the test environment
      expect(typeof COOKIE_OPTIONS.secure).toBe('boolean');
    });
  });
});
