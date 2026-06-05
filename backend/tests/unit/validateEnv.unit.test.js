'use strict';

/**
 * tests/unit/validateEnv.unit.test.js
 *
 * Unit tests for utils/validateEnv.js.
 * Manipulates process.env directly and mocks process.exit so the test
 * runner is never killed.
 * No network, no DB, no external services.
 * Conforms to guidelines/test.md.
 */

// ── Minimal set of env vars that satisfy every validation rule ──────────────
const VALID_ENV = {
  PORT: '3000',
  JWT_SECRET: 'a-sufficiently-long-jwt-secret-that-is-at-least-32-chars', // gitleaks:allow
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/shopyos',
  STORAGE_ENDPOINT: 'https://s3.example.com',
  STORAGE_REGION: 'us-east-1',
  STORAGE_BUCKET: 'my-bucket',
  STORAGE_ACCESS_KEY: 'AKIAIOSFODNN7EXAMPLE',
  STORAGE_SECRET_KEY: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  STORAGE_PUBLIC_URL: 'https://cdn.example.com',
  EMAIL_HOST: 'smtp.example.com',
  EMAIL_PORT: '587',
  EMAIL_USER: 'no-reply@example.com',
  EMAIL_PASSWORD: 'email-password',
  EMAIL_FROM: 'no-reply@example.com',
  EMAIL_FROM_NAME: 'Shopyos',
  ARKESEL_API_KEY: 'arkesel-api-key',
  ARKESEL_SENDER_ID: 'SHOPYOS',
  PAYSTACK_SECRET_KEY: 'sk_test_paystack',
  PAYSTACK_PUBLIC_KEY: 'pk_test_paystack',
  FRONTEND_URL: 'https://app.shopyos.com',
};

describe('validateEnv Unit Tests', () => {
  let originalEnv;
  let exitSpy;
  let warnSpy;
  let errorSpy;
  let validateEnv;

  beforeEach(() => {
    // Snapshot original env and replace with a clean copy
    originalEnv = { ...process.env };
    // Clear all required keys so tests start from a known blank slate
    Object.assign(process.env, VALID_ENV);

    // Prevent process.exit from actually exiting and capture calls
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => { });
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => { });
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

    // Re-require so module-level code uses the current process.env
    jest.resetModules();
    validateEnv = require('../../utils/validateEnv');
  });

  afterEach(() => {
    // Restore original env exactly
    Object.keys(process.env).forEach(k => {
      if (!(k in originalEnv)) delete process.env[k];
    });
    Object.assign(process.env, originalEnv);
    jest.restoreAllMocks();
  });

  // ── passes when all required vars present ───────────────────────────────────
  describe('valid environment', () => {
    test('test_validateEnv_allRequiredVarsPresent_doesNotCallProcessExit', () => {
      // Arrange — VALID_ENV already set in beforeEach
      // Act
      validateEnv();
      // Assert
      expect(exitSpy).not.toHaveBeenCalled();
    });

    test('test_validateEnv_allRequiredVarsPresent_doesNotThrow', () => {
      // Arrange & Act & Assert
      expect(() => validateEnv()).not.toThrow();
    });

    test('test_validateEnv_longJwtSecret_doesNotWarn', () => {
      // Arrange — JWT_SECRET is already ≥ 32 chars from VALID_ENV
      // Act
      validateEnv();
      // Assert — no JWT warning
      const calls = warnSpy.mock.calls.map(c => c.join(' '));
      const jwtWarning = calls.some(c => c.includes('JWT_SECRET'));
      expect(jwtWarning).toBe(false);
    });
  });

  // ── required variable missing ───────────────────────────────────────────────
  describe('missing required variables', () => {
    test('test_validateEnv_missingPort_callsProcessExitWith1', () => {
      // Arrange
      delete process.env.PORT;
      // Act
      validateEnv();
      // Assert
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    test('test_validateEnv_missingJwtSecret_callsProcessExitWith1', () => {
      // Arrange
      delete process.env.JWT_SECRET;
      // Act — validateEnv.js calls process.exit(1) for the missing-var check
      // but continues executing (exit is mocked).  Line 26 then crashes trying
      // to read .length on undefined, so we catch that TypeError.
      try { validateEnv(); } catch (_) { /* swallow crash from mocked exit */ }
      // Assert
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    test('test_validateEnv_missingDatabaseUrl_callsProcessExitWith1', () => {
      // Arrange
      delete process.env.DATABASE_URL;
      // Act
      validateEnv();
      // Assert
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    test('test_validateEnv_missingPaystackSecretKey_callsProcessExitWith1', () => {
      // Arrange
      delete process.env.PAYSTACK_SECRET_KEY;
      // Act
      validateEnv();
      // Assert
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    test('test_validateEnv_missingEmailHost_callsProcessExitWith1', () => {
      // Arrange
      delete process.env.EMAIL_HOST;
      // Act
      validateEnv();
      // Assert
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    test('test_validateEnv_multipleMissingVars_callsProcessExitWith1', () => {
      // Arrange — removing JWT_SECRET means line 26 will crash after the mocked
      // exit, so also remove a non-JWT var to confirm the missing-var path fires
      delete process.env.PORT;
      delete process.env.ARKESEL_API_KEY;
      // Act
      validateEnv();
      // Assert
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    test('test_validateEnv_missingVar_logsErrorWithMissingKeyName', () => {
      // Arrange
      delete process.env.ARKESEL_SENDER_ID;
      // Act
      validateEnv();
      // Assert
      const errorArgs = errorSpy.mock.calls.flat().join(' ');
      expect(errorArgs).toContain('ARKESEL_SENDER_ID');
    });
  });

  // ── URL format validation ───────────────────────────────────────────────────
  describe('URL format validation', () => {
    test('test_validateEnv_invalidDatabaseUrl_callsProcessExitWith1', () => {
      // Arrange
      process.env.DATABASE_URL = 'mysql://user:pass@localhost/db';
      // Act
      validateEnv();
      // Assert
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    test('test_validateEnv_invalidFrontendUrl_callsProcessExitWith1', () => {
      // Arrange
      process.env.FRONTEND_URL = 'not-a-url';
      // Act
      validateEnv();
      // Assert
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    test('test_validateEnv_invalidStorageEndpoint_callsProcessExitWith1', () => {
      // Arrange
      process.env.STORAGE_ENDPOINT = 'ftp://storage.example.com';
      // Act
      validateEnv();
      // Assert
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    test('test_validateEnv_invalidStoragePublicUrl_callsProcessExitWith1', () => {
      // Arrange
      process.env.STORAGE_PUBLIC_URL = '//missing-scheme.example.com';
      // Act
      validateEnv();
      // Assert
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    test('test_validateEnv_postgresWithqlSuffix_passesUrlValidation', () => {
      // Arrange — "postgresql://" scheme must be accepted
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/shopyos';
      // Act
      validateEnv();
      // Assert
      expect(exitSpy).not.toHaveBeenCalled();
    });

    test('test_validateEnv_postgresShortScheme_passesUrlValidation', () => {
      // Arrange — "postgres://" (without ql) must also be accepted
      process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/shopyos';
      // Act
      validateEnv();
      // Assert
      expect(exitSpy).not.toHaveBeenCalled();
    });
  });

  // ── JWT_SECRET length warning ───────────────────────────────────────────────
  describe('JWT_SECRET length warning', () => {
    test('test_validateEnv_jwtSecretShorterThan32Chars_logsWarning', () => {
      // Arrange
      process.env.JWT_SECRET = 'short-secret';
      // Act
      validateEnv();
      // Assert — should emit a warning (not exit)
      expect(warnSpy).toHaveBeenCalled();
      expect(exitSpy).not.toHaveBeenCalled();
    });
  });

  // ── optional variable warnings ──────────────────────────────────────────────
  describe('optional variable warnings', () => {
    test('test_validateEnv_missingRedisUrl_logsWarningOnly', () => {
      // Arrange
      delete process.env.REDIS_URL;
      // Act
      validateEnv();
      // Assert — should warn but not exit
      expect(exitSpy).not.toHaveBeenCalled();
      const warnArgs = warnSpy.mock.calls.flat().join(' ');
      expect(warnArgs).toContain('REDIS_URL');
    });

    test('test_validateEnv_missingLogLevel_logsWarningOnly', () => {
      // Arrange
      delete process.env.LOG_LEVEL;
      // Act
      validateEnv();
      // Assert
      expect(exitSpy).not.toHaveBeenCalled();
      const warnArgs = warnSpy.mock.calls.flat().join(' ');
      expect(warnArgs).toContain('LOG_LEVEL');
    });

    test('test_validateEnv_missingCorsOrigins_logsWarningOnly', () => {
      // Arrange
      delete process.env.CORS_ORIGINS;
      // Act
      validateEnv();
      // Assert
      expect(exitSpy).not.toHaveBeenCalled();
      const warnArgs = warnSpy.mock.calls.flat().join(' ');
      expect(warnArgs).toContain('CORS_ORIGINS');
    });
  });
});
