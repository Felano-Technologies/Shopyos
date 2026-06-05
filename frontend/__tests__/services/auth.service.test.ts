/**
 * __tests__/services/auth.service.test.ts
 *
 * Unit tests for the auth service functions.
 * All API calls are mocked — no real network.
 * Conforms to guidelines/test.md.
 */

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('@/lib/query/client', () => ({
  queryClient: { clear: jest.fn(), invalidateQueries: jest.fn(), removeQueries: jest.fn() },
}));
jest.mock('../../components/InAppToastHost', () => ({ CustomInAppToast: { show: jest.fn() } }));

const mockSecureStorage = {
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
};
const mockStorage = {
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
  clear: jest.fn().mockResolvedValue(undefined),
};

jest.mock('../../services/storage', () => ({
  storage: mockStorage,
  secureStorage: mockSecureStorage,
}));

// Mock the axios instance used by the api
const mockApiPost = jest.fn();
const mockApiGet = jest.fn();
const mockApiPut = jest.fn();
const mockApiDelete = jest.fn();

jest.mock('../../services/client', () => ({
  api: {
    post: mockApiPost,
    get: mockApiGet,
    put: mockApiPut,
    delete: mockApiDelete,
    defaults: { headers: { common: {} } },
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  },
  extractErrorMessage: (err: any) => err?.message || 'Unknown error',
  API_URL: 'http://localhost:5000/api/v1/',
  secureStorage: mockSecureStorage,
  storage: mockStorage,
  CustomInAppToast: { show: jest.fn() },
  baseURL: 'http://localhost:5000',
}));

import {
  registerUser,
  loginUser,
  requestPasswordReset,
  confirmResetPassword,
  updateProfile,
  updateUserRole,
} from '../../services/auth';

describe('Auth Service Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── registerUser ──────────────────────────────────────────────────
  test('test_registerUser_successfulRegistration_storesTokensAndReturnsAccessToken', async () => {
    // Arrange
    mockApiPost.mockResolvedValueOnce({
      data: { token: 'access-token', refreshToken: 'refresh-token', message: 'User created successfully' },
    });

    // Act
    const result = await registerUser('John', 'john@test.com', 'password123', '+233123456');

    // Assert
    expect(mockApiPost).toHaveBeenCalledWith('/auth/register', expect.objectContaining({ email: 'john@test.com' }));
    expect(mockSecureStorage.setItem).toHaveBeenCalledWith('userToken', 'access-token');
    expect(mockSecureStorage.setItem).toHaveBeenCalledWith('refreshToken', 'refresh-token');
    expect(result.token).toBe('access-token');
  });

  test('test_registerUser_responseWithoutToken_doesNotStoreTokens', async () => {
    // Arrange
    mockApiPost.mockResolvedValueOnce({ data: { message: 'Registered but no token' } });

    // Act
    await registerUser('Jane', 'jane@test.com', 'password123', '+233999');

    // Assert
    expect(mockSecureStorage.setItem).not.toHaveBeenCalled();
  });

  test('test_registerUser_apiError400_throwsWithServerErrorMessage', async () => {
    // Arrange
    const apiError = { message: 'User already exists', response: { data: { error: 'User already exists' }, status: 400 } };
    mockApiPost.mockRejectedValueOnce(apiError);

    // Act & Assert
    await expect(registerUser('Dup', 'dup@test.com', 'password123', '')).rejects.toThrow('User already exists');
  });

  test('test_registerUser_noNetworkResponse_throwsNetworkError', async () => {
    // Arrange
    mockApiPost.mockRejectedValueOnce(new Error('Network Error'));

    // Act & Assert
    await expect(registerUser('Net', 'net@test.com', 'pass', '')).rejects.toThrow('Network Error');
  });

  // ── loginUser ─────────────────────────────────────────────────────
  test('test_loginUser_successfulCredentials_storesTokensAndReturnsLoginDetails', async () => {
    // Arrange
    mockApiPost.mockResolvedValueOnce({
      data: { token: 'login-token', refreshToken: 'refresh-token', role: 'buyer', roles: ['buyer'], requiresRoleSelection: false },
    });
    mockApiGet.mockResolvedValueOnce({ data: { id: 'user-123' } });
    mockApiGet.mockResolvedValueOnce(null);

    // Act
    const result = await loginUser('buyer@test.com', 'pass', 5.6, -0.2);

    // Assert
    expect(mockSecureStorage.setItem).toHaveBeenCalledWith('userToken', 'login-token');
    expect(result.needsRole).toBe(false);
    expect(result.role).toBe('buyer');
  });

  test('test_loginUser_roleIsNone_setsNeedsRoleTrue', async () => {
    // Arrange
    mockApiPost.mockResolvedValueOnce({
      data: { token: 't', refreshToken: 'r', role: 'none', roles: [], requiresRoleSelection: false },
    });
    mockApiGet.mockResolvedValueOnce({ data: { id: 'u-1' } });

    // Act
    const result = await loginUser('new@test.com', 'pass', 0, 0);

    // Assert
    expect(result.needsRole).toBe(true);
  });

  test('test_loginUser_invalidCredentials_throwsValidationError', async () => {
    // Arrange
    const apiError = { message: 'Invalid credentials', response: { data: { error: 'Invalid credentials' }, status: 400 } };
    mockApiPost.mockRejectedValueOnce(apiError);

    // Act & Assert
    await expect(loginUser('bad@test.com', 'wrong', 0, 0)).rejects.toThrow('Invalid credentials');
  });

  // ── requestPasswordReset ──────────────────────────────────────────
  test('test_requestPasswordReset_validEmail_callsResetEndpointAndReturnsSuccess', async () => {
    // Arrange
    mockApiPost.mockResolvedValueOnce({ data: { success: true, message: 'Recovery email sent' } });

    // Act
    const result = await requestPasswordReset('user@test.com');

    // Assert
    expect(mockApiPost).toHaveBeenCalledWith('/auth/reset-password', { email: 'user@test.com' });
    expect(result.success).toBe(true);
  });

  test('test_requestPasswordReset_nonExistentEmail_throwsRecoveryError', async () => {
    // Arrange
    const apiError = { message: 'User not found', response: { data: { error: 'User not found' }, status: 400 } };
    mockApiPost.mockRejectedValueOnce(apiError);

    // Act & Assert
    await expect(requestPasswordReset('ghost@test.com')).rejects.toThrow('User not found');
  });

  // ── confirmResetPassword ──────────────────────────────────────────
  test('test_confirmResetPassword_validTokenAndPassword_callsConfirmEndpointSuccessfully', async () => {
    // Arrange
    mockApiPost.mockResolvedValueOnce({ data: { success: true } });

    // Act
    await confirmResetPassword('reset-token-123', 'NewPass123!');

    // Assert
    expect(mockApiPost).toHaveBeenCalledWith('/auth/reset-password/confirm', {
      token: 'reset-token-123',
      newPassword: 'NewPass123!',
    });
  });

  test('test_confirmResetPassword_expiredToken_throwsExpirationError', async () => {
    // Arrange
    const apiError = { message: 'Invalid token', response: { data: { error: 'Invalid or expired reset token' }, status: 400 } };
    mockApiPost.mockRejectedValueOnce(apiError);

    // Act & Assert
    await expect(confirmResetPassword('bad-token', 'NewPass')).rejects.toThrow('Invalid token');
  });

  // ── updateProfile ─────────────────────────────────────────────────
  test('test_updateProfile_validDetails_sendsProfileDataToApi', async () => {
    // Arrange
    mockApiPut.mockResolvedValueOnce({ data: { success: true, data: { full_name: 'Jane' } } });

    // Act
    const result = await updateProfile({ name: 'Jane', city: 'Accra' });

    // Assert
    expect(mockApiPut).toHaveBeenCalledWith('/auth/profile', { name: 'Jane', city: 'Accra' });
    expect(result.success).toBe(true);
  });

  // ── updateUserRole ────────────────────────────────────────────────
  test('test_updateUserRole_validRole_callsAddRoleEndpointSuccessfully', async () => {
    // Arrange
    mockApiPost.mockResolvedValueOnce({ data: { success: true, message: 'Buyer role added' } });

    // Act
    await updateUserRole('buyer');

    // Assert
    expect(mockApiPost).toHaveBeenCalledWith('/auth/add-role', { role: 'buyer' });
  });

  test('test_updateUserRole_invalidRoleName_throwsValidationError', async () => {
    // Arrange
    const apiError = { message: 'Invalid role', response: { data: { error: 'Invalid role' }, status: 400 } };
    mockApiPost.mockRejectedValueOnce(apiError);

    // Act & Assert
    await expect(updateUserRole('superuser')).rejects.toThrow('Invalid role');
  });
});
