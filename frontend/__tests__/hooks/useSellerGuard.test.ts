/**
 * __tests__/hooks/useSellerGuard.test.ts
 *
 * Unit tests for the useSellerGuard hook.
 * expo-router, useBusiness, and the API storage service are mocked.
 * Conforms to guidelines/test.md.
 */

// ── expo-router mock ──────────────────────────────────────────────────────────
const mockRouterReplace = jest.fn();
jest.mock('expo-router', () => ({
  __esModule: true,
  useRouter: jest.fn().mockReturnValue({ replace: mockRouterReplace }),
  usePathname: jest.fn(),
}));

// ── useBusiness mock ──────────────────────────────────────────────────────────
// useMyBusinesses is the only export the guard relies on.
jest.mock('../../hooks/useBusiness', () => ({
  __esModule: true,
  useMyBusinesses: jest.fn(),
}));

// ── @/services/api mock (storage) ────────────────────────────────────────────
jest.mock('@/services/api', () => ({
  __esModule: true,
  storage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

import { useRouter, usePathname } from 'expo-router';
import { useMyBusinesses } from '../../hooks/useBusiness';
import * as ApiService from '@/services/api';
import { useSellerGuard } from '../../hooks/useSellerGuard';

// Helper: run useEffect callbacks synchronously so we can assert without
// async timers.
beforeAll(() => {
  jest.spyOn(require('react'), 'useEffect').mockImplementation((cb: any, _deps?: any) => {
    // Execute immediately; capture the optional cleanup return
    cb();
  });
});

afterAll(() => {
  (require('react').useEffect as jest.Mock).mockRestore?.();
});

describe('useSellerGuard Hook Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default storage: no cached verification status
    (ApiService.storage.getItem as jest.Mock).mockResolvedValue(null);
  });

  // ── Still loading — checking remains true ─────────────────────────────────
  test('test_useSellerGuard_isLoading_setsIsCheckingTrueAndDoesNotRedirect', () => {
    // Arrange
    (usePathname as jest.Mock).mockReturnValue('/business/dashboard');
    (useMyBusinesses as jest.Mock).mockReturnValue({ data: undefined, isLoading: true });

    // Act
    const result = useSellerGuard();

    // Assert: guard stays in checking state, no redirect
    expect(result.isChecking).toBe(true);
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  // ── Unguarded route — always passes through ───────────────────────────────
  test('test_useSellerGuard_unguardedRoute_setsIsVerifiedAndDoesNotRedirect', () => {
    // Arrange
    (usePathname as jest.Mock).mockReturnValue('/business/verification');
    (useMyBusinesses as jest.Mock).mockReturnValue({ data: undefined, isLoading: false });

    // Act
    const result = useSellerGuard();

    // Assert
    expect(result.isVerified).toBe(true);
    expect(result.isChecking).toBe(false);
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  test('test_useSellerGuard_verificationStatusRoute_setsIsVerifiedAndDoesNotRedirect', () => {
    // Arrange
    (usePathname as jest.Mock).mockReturnValue('/business/verification-status');
    (useMyBusinesses as jest.Mock).mockReturnValue({ data: undefined, isLoading: false });

    // Act
    const result = useSellerGuard();

    // Assert
    expect(result.isVerified).toBe(true);
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  test('test_useSellerGuard_registerRoute_setsIsVerifiedAndDoesNotRedirect', () => {
    // Arrange
    (usePathname as jest.Mock).mockReturnValue('/business/register');
    (useMyBusinesses as jest.Mock).mockReturnValue({ data: undefined, isLoading: false });

    // Act
    const result = useSellerGuard();

    // Assert
    expect(result.isVerified).toBe(true);
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  // ── Rejected business — redirects to verification-status ─────────────────
  test('test_useSellerGuard_rejectedBusiness_redirectsToVerificationStatus', async () => {
    // Arrange
    (usePathname as jest.Mock).mockReturnValue('/business/products');
    (useMyBusinesses as jest.Mock).mockReturnValue({
      data: { businesses: [{ verificationStatus: 'rejected' }] },
      isLoading: false,
    });

    // Act
    useSellerGuard();

    // Allow async checkVerification to settle
    await new Promise(process.nextTick);

    // Assert
    expect(mockRouterReplace).toHaveBeenCalledWith('/business/verification-status');
  });

  // ── Rejected but already on verification-status — no double redirect ──────
  test('test_useSellerGuard_rejectedBusinessAlreadyOnVerificationStatus_doesNotRedirect', async () => {
    // Arrange
    (usePathname as jest.Mock).mockReturnValue('/business/verification-status');
    (useMyBusinesses as jest.Mock).mockReturnValue({
      data: { businesses: [{ verificationStatus: 'rejected' }] },
      isLoading: false,
    });

    // Act
    useSellerGuard();
    await new Promise(process.nextTick);

    // Assert: already on the right screen, no replace called
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  // ── Pending business — allowed on dashboard ───────────────────────────────
  test('test_useSellerGuard_pendingBusiness_doesNotRedirectAndSetsIsVerified', async () => {
    // Arrange
    (usePathname as jest.Mock).mockReturnValue('/business/dashboard');
    (useMyBusinesses as jest.Mock).mockReturnValue({
      data: { businesses: [{ verificationStatus: 'pending' }] },
      isLoading: false,
    });

    // Act
    const result = useSellerGuard();
    await new Promise(process.nextTick);

    // Assert
    expect(mockRouterReplace).not.toHaveBeenCalled();
    expect(result.isVerified).toBe(true);
  });

  // ── Verified business — passes through ────────────────────────────────────
  test('test_useSellerGuard_verifiedBusiness_setsIsVerifiedAndDoesNotRedirect', async () => {
    // Arrange
    (usePathname as jest.Mock).mockReturnValue('/business/analytics');
    (useMyBusinesses as jest.Mock).mockReturnValue({
      data: { businesses: [{ verificationStatus: 'verified' }] },
      isLoading: false,
    });

    // Act
    const result = useSellerGuard();
    await new Promise(process.nextTick);

    // Assert
    expect(result.isVerified).toBe(true);
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  // ── No business data, cached unverified status (not dashboard) — redirects ─
  test('test_useSellerGuard_noBusiness_cachedNonVerifiedStatus_redirectsToVerificationStatus', async () => {
    // Arrange
    (usePathname as jest.Mock).mockReturnValue('/business/products');
    (useMyBusinesses as jest.Mock).mockReturnValue({ data: undefined, isLoading: false });
    (ApiService.storage.getItem as jest.Mock).mockResolvedValueOnce('pending');

    // Act
    useSellerGuard();
    await new Promise(process.nextTick);

    // Assert
    expect(mockRouterReplace).toHaveBeenCalledWith('/business/verification-status');
  });

  // ── No business data, no cached status — allows access ────────────────────
  test('test_useSellerGuard_noBusiness_noCachedStatus_setsIsVerified', async () => {
    // Arrange
    (usePathname as jest.Mock).mockReturnValue('/business/products');
    (useMyBusinesses as jest.Mock).mockReturnValue({ data: undefined, isLoading: false });
    (ApiService.storage.getItem as jest.Mock).mockResolvedValueOnce(null);

    // Act
    const result = useSellerGuard();
    await new Promise(process.nextTick);

    // Assert: no redirect, isVerified set
    expect(mockRouterReplace).not.toHaveBeenCalled();
    expect(result.isVerified).toBe(true);
  });

  // ── No business data, cached 'verified' status — allows access ────────────
  test('test_useSellerGuard_noBusiness_cachedVerifiedStatus_setsIsVerified', async () => {
    // Arrange
    (usePathname as jest.Mock).mockReturnValue('/business/orders');
    (useMyBusinesses as jest.Mock).mockReturnValue({ data: undefined, isLoading: false });
    (ApiService.storage.getItem as jest.Mock).mockResolvedValueOnce('verified');

    // Act
    const result = useSellerGuard();
    await new Promise(process.nextTick);

    // Assert
    expect(mockRouterReplace).not.toHaveBeenCalled();
    expect(result.isVerified).toBe(true);
  });

  // ── Dashboard route — skips storage redirect even with non-verified cache ──
  test('test_useSellerGuard_dashboardRoute_doesNotRedirectDespiteNonVerifiedCachedStatus', async () => {
    // Arrange: no businesses yet, but cached status is 'pending'
    (usePathname as jest.Mock).mockReturnValue('/business/dashboard');
    (useMyBusinesses as jest.Mock).mockReturnValue({ data: undefined, isLoading: false });
    (ApiService.storage.getItem as jest.Mock).mockResolvedValueOnce('pending');

    // Act
    useSellerGuard();
    await new Promise(process.nextTick);

    // Assert: dashboard is exempt from storage-based redirect
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  // ── Return shape ──────────────────────────────────────────────────────────
  test('test_useSellerGuard_validCall_returnsIsCheckingAndIsVerifiedState', () => {
    // Arrange
    (usePathname as jest.Mock).mockReturnValue('/business/verification');
    (useMyBusinesses as jest.Mock).mockReturnValue({ data: undefined, isLoading: false });

    // Act
    const result = useSellerGuard();

    // Assert
    expect(result).toHaveProperty('isChecking');
    expect(result).toHaveProperty('isVerified');
    expect(typeof result.isChecking).toBe('boolean');
    expect(typeof result.isVerified).toBe('boolean');
  });
});
