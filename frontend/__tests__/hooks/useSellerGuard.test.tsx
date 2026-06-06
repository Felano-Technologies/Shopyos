const mockRouterReplace = jest.fn();
jest.mock('expo-router', () => ({
  __esModule: true,
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}));

jest.mock('../../hooks/useBusiness', () => ({
  __esModule: true,
  useMyBusinesses: jest.fn(),
}));

jest.mock('@/services/api', () => ({
  __esModule: true,
  storage: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
}));

import React from 'react';
import { render, act } from '@testing-library/react-native';
import { useRouter, usePathname } from 'expo-router';
import { useMyBusinesses } from '../../hooks/useBusiness';
import * as ApiService from '@/services/api';
import { useSellerGuard } from '../../hooks/useSellerGuard';

// Capture hook output via a test component — renderHook doesn't flush effects in React 19
let hookOutput: ReturnType<typeof useSellerGuard> | null = null;
function TestHook() { hookOutput = useSellerGuard(); return null; }

async function mountAndFlush() {
  await act(async () => {
    render(<TestHook />);
    await new Promise(process.nextTick);
  });
}

describe('useSellerGuard Hook Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    hookOutput = null;
    (useRouter as jest.Mock).mockReturnValue({ replace: mockRouterReplace });
    (ApiService.storage.getItem as jest.Mock).mockResolvedValue(null);
  });

  test('test_useSellerGuard_isLoading_setsIsCheckingTrueAndDoesNotRedirect', async () => {
    (usePathname as jest.Mock).mockReturnValue('/business/dashboard');
    (useMyBusinesses as jest.Mock).mockReturnValue({ data: undefined, isLoading: true });
    await mountAndFlush();
    expect(hookOutput!.isChecking).toBe(true);
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  test('test_useSellerGuard_unguardedRoute_setsIsVerifiedAndDoesNotRedirect', async () => {
    (usePathname as jest.Mock).mockReturnValue('/business/verification');
    (useMyBusinesses as jest.Mock).mockReturnValue({ data: undefined, isLoading: false });
    await mountAndFlush();
    expect(hookOutput!.isVerified).toBe(true);
    expect(hookOutput!.isChecking).toBe(false);
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  test('test_useSellerGuard_verificationStatusRoute_setsIsVerifiedAndDoesNotRedirect', async () => {
    (usePathname as jest.Mock).mockReturnValue('/business/verification-status');
    (useMyBusinesses as jest.Mock).mockReturnValue({ data: undefined, isLoading: false });
    await mountAndFlush();
    expect(hookOutput!.isVerified).toBe(true);
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  test('test_useSellerGuard_registerRoute_setsIsVerifiedAndDoesNotRedirect', async () => {
    (usePathname as jest.Mock).mockReturnValue('/business/register');
    (useMyBusinesses as jest.Mock).mockReturnValue({ data: undefined, isLoading: false });
    await mountAndFlush();
    expect(hookOutput!.isVerified).toBe(true);
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  test('test_useSellerGuard_rejectedBusiness_redirectsToVerificationStatus', async () => {
    (usePathname as jest.Mock).mockReturnValue('/business/products');
    (useMyBusinesses as jest.Mock).mockReturnValue({
      data: { businesses: [{ verificationStatus: 'rejected' }] }, isLoading: false,
    });
    await mountAndFlush();
    expect(mockRouterReplace).toHaveBeenCalledWith('/business/verification-status');
  });

  test('test_useSellerGuard_rejectedBusinessAlreadyOnVerificationStatus_doesNotRedirect', async () => {
    (usePathname as jest.Mock).mockReturnValue('/business/verification-status');
    (useMyBusinesses as jest.Mock).mockReturnValue({
      data: { businesses: [{ verificationStatus: 'rejected' }] }, isLoading: false,
    });
    await mountAndFlush();
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  test('test_useSellerGuard_pendingBusiness_doesNotRedirectAndSetsIsVerified', async () => {
    (usePathname as jest.Mock).mockReturnValue('/business/dashboard');
    (useMyBusinesses as jest.Mock).mockReturnValue({
      data: { businesses: [{ verificationStatus: 'pending' }] }, isLoading: false,
    });
    await mountAndFlush();
    expect(mockRouterReplace).not.toHaveBeenCalled();
    expect(hookOutput!.isVerified).toBe(true);
  });

  test('test_useSellerGuard_verifiedBusiness_setsIsVerifiedAndDoesNotRedirect', async () => {
    (usePathname as jest.Mock).mockReturnValue('/business/analytics');
    (useMyBusinesses as jest.Mock).mockReturnValue({
      data: { businesses: [{ verificationStatus: 'verified' }] }, isLoading: false,
    });
    await mountAndFlush();
    expect(hookOutput!.isVerified).toBe(true);
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  test('test_useSellerGuard_noBusiness_cachedNonVerifiedStatus_redirectsToVerificationStatus', async () => {
    (usePathname as jest.Mock).mockReturnValue('/business/products');
    (useMyBusinesses as jest.Mock).mockReturnValue({ data: undefined, isLoading: false });
    (ApiService.storage.getItem as jest.Mock).mockResolvedValueOnce('pending');
    await mountAndFlush();
    expect(mockRouterReplace).toHaveBeenCalledWith('/business/verification-status');
  });

  test('test_useSellerGuard_noBusiness_noCachedStatus_setsIsVerified', async () => {
    (usePathname as jest.Mock).mockReturnValue('/business/products');
    (useMyBusinesses as jest.Mock).mockReturnValue({ data: undefined, isLoading: false });
    (ApiService.storage.getItem as jest.Mock).mockResolvedValueOnce(null);
    await mountAndFlush();
    expect(mockRouterReplace).not.toHaveBeenCalled();
    expect(hookOutput!.isVerified).toBe(true);
  });

  test('test_useSellerGuard_noBusiness_cachedVerifiedStatus_setsIsVerified', async () => {
    (usePathname as jest.Mock).mockReturnValue('/business/orders');
    (useMyBusinesses as jest.Mock).mockReturnValue({ data: undefined, isLoading: false });
    (ApiService.storage.getItem as jest.Mock).mockResolvedValueOnce('verified');
    await mountAndFlush();
    expect(mockRouterReplace).not.toHaveBeenCalled();
    expect(hookOutput!.isVerified).toBe(true);
  });

  test('test_useSellerGuard_dashboardRoute_doesNotRedirectDespiteNonVerifiedCachedStatus', async () => {
    (usePathname as jest.Mock).mockReturnValue('/business/dashboard');
    (useMyBusinesses as jest.Mock).mockReturnValue({ data: undefined, isLoading: false });
    (ApiService.storage.getItem as jest.Mock).mockResolvedValueOnce('pending');
    await mountAndFlush();
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  test('test_useSellerGuard_validCall_returnsIsCheckingAndIsVerifiedState', async () => {
    (usePathname as jest.Mock).mockReturnValue('/business/verification');
    (useMyBusinesses as jest.Mock).mockReturnValue({ data: undefined, isLoading: false });
    await mountAndFlush();
    expect(hookOutput).toHaveProperty('isChecking');
    expect(hookOutput).toHaveProperty('isVerified');
    expect(typeof hookOutput!.isChecking).toBe('boolean');
    expect(typeof hookOutput!.isVerified).toBe('boolean');
  });
});
