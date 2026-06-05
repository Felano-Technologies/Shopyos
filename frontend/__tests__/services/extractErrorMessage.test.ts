/**
 * __tests__/services/extractErrorMessage.test.ts
 *
 * Unit tests for the extractErrorMessage utility in services/client.ts.
 * No network requests — pure function tests.
 * Conforms to guidelines/test.md.
 */

// ── Mocks
jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('@/lib/query/client', () => ({ queryClient: { clear: jest.fn(), invalidateQueries: jest.fn(), removeQueries: jest.fn() } }));
jest.mock('../../services/storage', () => ({
  storage: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
  secureStorage: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
}));
jest.mock('../../components/InAppToastHost', () => ({ CustomInAppToast: { show: jest.fn() } }));

import { extractErrorMessage } from '../../services/client';

describe('extractErrorMessage Unit Tests', () => {
  function makeError(status: number, data: any = {}) {
    return { response: { status, data } };
  }

  // ── With Response Errors ───────────────────────────────────────────
  test('test_extractErrorMessage_responseWithCustomServerMessage_returnsServerMessage', () => {
    // Arrange
    const err = makeError(400, { error: 'Email already taken' });
    // Act
    const result = extractErrorMessage(err);
    // Assert
    expect(result).toBe('Email already taken');
  });

  test('test_extractErrorMessage_response400WithoutMessage_returnsInvalidRequestFallback', () => {
    // Arrange
    const err = makeError(400);
    // Act
    const result = extractErrorMessage(err);
    // Assert
    expect(result).toMatch(/invalid request/i);
  });

  test('test_extractErrorMessage_response401_returnsSessionExpiredMessage', () => {
    // Arrange
    const err = makeError(401);
    // Act
    const result = extractErrorMessage(err);
    // Assert
    expect(result).toMatch(/session|log in/i);
  });

  test('test_extractErrorMessage_response403_returnsPermissionDeniedMessage', () => {
    // Arrange
    const err = makeError(403);
    // Act
    const result = extractErrorMessage(err);
    // Assert
    expect(result).toMatch(/permission/i);
  });

  test('test_extractErrorMessage_response404_returnsNotFoundMessage', () => {
    // Arrange
    const err = makeError(404);
    // Act
    const result = extractErrorMessage(err);
    // Assert
    expect(result).toMatch(/not found/i);
  });

  test('test_extractErrorMessage_response408_returnsTimeoutMessage', () => {
    // Arrange
    const err = makeError(408);
    // Act
    const result = extractErrorMessage(err);
    // Assert
    expect(result).toMatch(/timed out/i);
  });

  test('test_extractErrorMessage_response429_returnsRateLimitMessage', () => {
    // Arrange
    const err = makeError(429);
    // Act
    const result = extractErrorMessage(err);
    // Assert
    expect(result).toMatch(/too many/i);
  });

  test('test_extractErrorMessage_response500_returnsServerErrorFallback', () => {
    // Arrange
    const err = makeError(500);
    // Act
    const result = extractErrorMessage(err);
    // Assert
    expect(result).toMatch(/server error/i);
  });

  test('test_extractErrorMessage_response503_returnsServiceUnavailableMessage', () => {
    // Arrange
    const err = makeError(503);
    // Act
    const result = extractErrorMessage(err);
    // Assert
    expect(result).toMatch(/unavailable/i);
  });

  test('test_extractErrorMessage_response500WithGenericErrorMessage_ignoresAndReturnsFallback', () => {
    // Arrange
    const err = makeError(500, { error: 'Internal Server Error' });
    // Act
    const result = extractErrorMessage(err);
    // Assert
    expect(result).toMatch(/server error/i);
  });

  test('test_extractErrorMessage_responseUnknownStatusWithCustomMessage_returnsCustomMessage', () => {
    // Arrange
    const err = makeError(418, { error: "I'm a teapot" });
    // Act
    const result = extractErrorMessage(err);
    // Assert
    expect(result).toBe("I'm a teapot");
  });

  // ── With Network/Request Errors ─────────────────────────────────────
  test('test_extractErrorMessage_requestExistsNoResponse_returnsNoInternetMessage', () => {
    // Arrange
    const err = { request: {} };
    // Act
    const result = extractErrorMessage(err);
    // Assert
    expect(result).toMatch(/no internet|network/i);
  });

  test('test_extractErrorMessage_requestTimeoutECONNABORTED_returnsTimeoutMessage', () => {
    // Arrange
    const err = { request: {}, code: 'ECONNABORTED' };
    // Act
    const result = extractErrorMessage(err);
    // Assert
    expect(result).toMatch(/timed out/i);
  });

  test('test_extractErrorMessage_networkErrorMessage_returnsNoInternetMessage', () => {
    // Arrange
    const err = { message: 'Network Error' };
    // Act
    const result = extractErrorMessage(err);
    // Assert
    expect(result).toMatch(/no internet|network/i);
  });

  test('test_extractErrorMessage_otherErrorMessage_returnsErrorMessageDirectly', () => {
    // Arrange
    const err = { message: 'Something specific went wrong' };
    // Act
    const result = extractErrorMessage(err);
    // Assert
    expect(result).toBe('Something specific went wrong');
  });

  // ── Null/Undefined Errors ──────────────────────────────────────────
  test('test_extractErrorMessage_nullError_returnsFallbackMessage', () => {
    // Arrange & Act & Assert
    expect(extractErrorMessage(null)).toMatch(/unexpected error/i);
  });

  test('test_extractErrorMessage_emptyObjectError_returnsFallbackMessage', () => {
    // Arrange & Act & Assert
    expect(extractErrorMessage({})).toMatch(/unexpected error/i);
  });
});
