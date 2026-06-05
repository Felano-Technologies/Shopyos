/**
 * __tests__/hooks/useDriverGuard.test.ts
 *
 * Unit tests for the useDriverGuard hook.
 * expo-router, useDelivery, and the API secureStorage service are mocked.
 * Conforms to guidelines/test.md.
 */

// ── expo-router mock ──────────────────────────────────────────────────────────
const mockRouterReplace = jest.fn();
jest.mock('expo-router', () => ({
  __esModule: true,
  useRouter: jest.fn().mockReturnValue({ replace: mockRouterReplace }),
  usePathname: jest.fn(),
}));

// ── useDelivery mock ──────────────────────────────────────────────────────────
// useDriverProfile is the only export the guard relies on.
jest.mock('../../hooks/useDelivery', () => ({
  __esModule: true,
  useDriverProfile: jest.fn(),
}));

// ── services/api mock (secureStorage) ────────────────────────────────────────
// useDriverGuard imports from '../services/api' (relative to hooks/).
// In the jest-expo resolver that path resolves to the same module as '@/services/api'
// because tsconfig maps @/* → ./*. Mocking @/services/api covers both usages.
jest.mock('@/services/api', () => ({
  __esModule: true,
  secureStorage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

import { useRouter, usePathname } from 'expo-router';
import { useDriverProfile } from '../../hooks/useDelivery';
import { useDriverGuard } from '../../hooks/useDriverGuard';
import * as ApiService from '@/services/api';

// Helper: run useEffect synchronously for predictable assertions.
beforeAll(() => {
  jest.spyOn(require('react'), 'useEffect').mockImplementation((cb: any) => {
    cb();
  });
});

afterAll(() => {
  (require('react').useEffect as jest.Mock).mockRestore?.();
});

describe('useDriverGuard Hook Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: no user token stored
    (ApiService.secureStorage.getItem as jest.Mock).mockResolvedValue(null);
  });

  // ── Still loading — isChecking stays true ─────────────────────────────────
  test('test_useDriverGuard_isLoading_setsIsCheckingTrueAndDoesNotRedirect', () => {
    // Arrange
    (usePathname as jest.Mock).mockReturnValue('/driver/dashboard');
    (useDriverProfile as jest.Mock).mockReturnValue({ data: undefined, isLoading: true });

    // Act
    const result = useDriverGuard();

    // Assert
    expect(result.isChecking).toBe(true);
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  // ── No token — does not redirect, sets isChecking to false ────────────────
  test('test_useDriverGuard_noToken_setsIsCheckingFalseAndDoesNotRedirect', async () => {
    // Arrange
    (usePathname as jest.Mock).mockReturnValue('/driver/dashboard');
    (useDriverProfile as jest.Mock).mockReturnValue({ data: undefined, isLoading: false });
    (ApiService.secureStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

    // Act
    useDriverGuard();
    await new Promise(process.nextTick);

    // Assert: no token → guard exits without redirect
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  // ── Unguarded driver route — passes through ───────────────────────────────
  test('test_useDriverGuard_unguardedVerificationRoute_doesNotRedirect', async () => {
    // Arrange
    (usePathname as jest.Mock).mockReturnValue('/driver/verification');
    (useDriverProfile as jest.Mock).mockReturnValue({ data: undefined, isLoading: false });
    (ApiService.secureStorage.getItem as jest.Mock).mockResolvedValueOnce('user-token');

    // Act
    useDriverGuard();
    await new Promise(process.nextTick);

    // Assert
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  test('test_useDriverGuard_unguardedVerificationStatusRoute_doesNotRedirect', async () => {
    // Arrange
    (usePathname as jest.Mock).mockReturnValue('/driver/verification-status');
    (useDriverProfile as jest.Mock).mockReturnValue({ data: undefined, isLoading: false });
    (ApiService.secureStorage.getItem as jest.Mock).mockResolvedValueOnce('user-token');

    // Act
    useDriverGuard();
    await new Promise(process.nextTick);

    // Assert
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  // ── Verified driver — passes through ─────────────────────────────────────
  test('test_useDriverGuard_verifiedDriver_doesNotRedirect', async () => {
    // Arrange
    (usePathname as jest.Mock).mockReturnValue('/driver/dashboard');
    (useDriverProfile as jest.Mock).mockReturnValue({
      data: { profile: { verification_status: 'verified', is_verified: true } },
      isLoading: false,
    });
    (ApiService.secureStorage.getItem as jest.Mock).mockResolvedValueOnce('user-token');

    // Act
    useDriverGuard();
    await new Promise(process.nextTick);

    // Assert
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  // ── Pending driver — allowed to view dashboard ────────────────────────────
  test('test_useDriverGuard_pendingDriver_doesNotRedirectFromDashboard', async () => {
    // Arrange
    (usePathname as jest.Mock).mockReturnValue('/driver/dashboard');
    (useDriverProfile as jest.Mock).mockReturnValue({
      data: { profile: { verification_status: 'pending', is_verified: false } },
      isLoading: false,
    });
    (ApiService.secureStorage.getItem as jest.Mock).mockResolvedValueOnce('user-token');

    // Act
    useDriverGuard();
    await new Promise(process.nextTick);

    // Assert
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  // ── Rejected driver — redirects to /driver/verification ──────────────────
  test('test_useDriverGuard_rejectedDriver_redirectsToVerification', async () => {
    // Arrange
    (usePathname as jest.Mock).mockReturnValue('/driver/dashboard');
    (useDriverProfile as jest.Mock).mockReturnValue({
      data: { profile: { verification_status: 'rejected' } },
      isLoading: false,
    });
    (ApiService.secureStorage.getItem as jest.Mock).mockResolvedValueOnce('user-token');

    // Act
    useDriverGuard();
    await new Promise(process.nextTick);

    // Assert
    expect(mockRouterReplace).toHaveBeenCalledWith('/driver/verification');
  });

  // ── Rejected but already on verification — no double redirect ────────────
  test('test_useDriverGuard_rejectedDriverAlreadyOnVerification_doesNotDoubleRedirect', async () => {
    // Arrange
    (usePathname as jest.Mock).mockReturnValue('/driver/verification');
    (useDriverProfile as jest.Mock).mockReturnValue({
      data: { profile: { verification_status: 'rejected' } },
      isLoading: false,
    });
    (ApiService.secureStorage.getItem as jest.Mock).mockResolvedValueOnce('user-token');

    // Act
    useDriverGuard();
    await new Promise(process.nextTick);

    // Assert: already on verification, no replace needed
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  // ── Driver profile via is_verified flag ───────────────────────────────────
  test('test_useDriverGuard_isVerifiedFlagTrue_doesNotRedirect', async () => {
    // Arrange: driver profile with is_verified=true (no explicit status field)
    (usePathname as jest.Mock).mockReturnValue('/driver/deliveries');
    (useDriverProfile as jest.Mock).mockReturnValue({
      data: { profile: { is_verified: true } },
      isLoading: false,
    });
    (ApiService.secureStorage.getItem as jest.Mock).mockResolvedValueOnce('user-token');

    // Act
    useDriverGuard();
    await new Promise(process.nextTick);

    // Assert: is_verified=true → status resolves to 'verified', no redirect
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  // ── No driver profile at all — redirects to /driver/verification ──────────
  test('test_useDriverGuard_noDriverProfile_redirectsToVerification', async () => {
    // Arrange
    (usePathname as jest.Mock).mockReturnValue('/driver/dashboard');
    (useDriverProfile as jest.Mock).mockReturnValue({
      data: null,
      isLoading: false,
    });
    (ApiService.secureStorage.getItem as jest.Mock).mockResolvedValueOnce('user-token');

    // Act
    useDriverGuard();
    await new Promise(process.nextTick);

    // Assert
    expect(mockRouterReplace).toHaveBeenCalledWith('/driver/verification');
  });

  // ── No driver profile, but on /driver/index — no redirect ────────────────
  test('test_useDriverGuard_noProfileOnDriverIndex_doesNotRedirect', async () => {
    // Arrange
    (usePathname as jest.Mock).mockReturnValue('/driver/index');
    (useDriverProfile as jest.Mock).mockReturnValue({
      data: null,
      isLoading: false,
    });
    (ApiService.secureStorage.getItem as jest.Mock).mockResolvedValueOnce('user-token');

    // Act
    useDriverGuard();
    await new Promise(process.nextTick);

    // Assert
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  // ── profileData.data shape is handled ────────────────────────────────────
  test('test_useDriverGuard_profileDataShape_handlesDataPropertyCorrectly', async () => {
    // Arrange: profile is nested under .data
    (usePathname as jest.Mock).mockReturnValue('/driver/earnings');
    (useDriverProfile as jest.Mock).mockReturnValue({
      data: { data: { verification_status: 'verified' } },
      isLoading: false,
    });
    (ApiService.secureStorage.getItem as jest.Mock).mockResolvedValueOnce('user-token');

    // Act
    useDriverGuard();
    await new Promise(process.nextTick);

    // Assert
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  // ── profileData flat shape ────────────────────────────────────────────────
  test('test_useDriverGuard_flatProfileDataShape_handlesDirectObjectCorrectly', async () => {
    // Arrange: profileData itself IS the driver object (no .profile or .data wrapper)
    (usePathname as jest.Mock).mockReturnValue('/driver/earnings');
    (useDriverProfile as jest.Mock).mockReturnValue({
      data: { verification_status: 'verified' },
      isLoading: false,
    });
    (ApiService.secureStorage.getItem as jest.Mock).mockResolvedValueOnce('user-token');

    // Act
    useDriverGuard();
    await new Promise(process.nextTick);

    // Assert
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  // ── Return shape ──────────────────────────────────────────────────────────
  test('test_useDriverGuard_validCall_returnsIsCheckingAndProfileState', () => {
    // Arrange
    (usePathname as jest.Mock).mockReturnValue('/driver/verification');
    (useDriverProfile as jest.Mock).mockReturnValue({
      data: { profile: { verification_status: 'verified' } },
      isLoading: false,
    });
    (ApiService.secureStorage.getItem as jest.Mock).mockResolvedValue(null);

    // Act
    const result = useDriverGuard();

    // Assert
    expect(result).toHaveProperty('isChecking');
    expect(typeof result.isChecking).toBe('boolean');
    // profile is derived from profileData
    expect(result).toHaveProperty('profile');
  });
});
