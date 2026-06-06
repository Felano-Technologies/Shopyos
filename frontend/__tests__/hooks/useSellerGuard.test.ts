/**
 * __tests__/hooks/useSellerGuard.test.ts
 */

const mockRouterReplace = jest.fn();
jest.mock('expo-router', () => ({
  __esModule: true,
  useRouter: jest.fn().mockReturnValue({ replace: mockRouterReplace }),
  usePathname: jest.fn(),
}));

jest.mock('../../hooks/useBusiness', () => ({
  __esModule: true,
  useMyBusinesses: jest.fn(),
}));

jest.mock('@/services/api', () => ({
  __esModule: true,
  storage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

import { renderHook, act } from '@testing-library/react-native';
import { useRouter, usePathname } from 'expo-router';
import { useMyBusinesses } from '../../hooks/useBusiness';
import * as ApiService from '@/services/api';
import { useSellerGuard } from '../../hooks/useSellerGuard';

describe('useSellerGuard Hook Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (ApiService.storage.getItem as jest.Mock).mockResolvedValue(null);
  });

  test('test_useSellerGuard_isLoading_setsIsCheckingTrueAndDoesNotRedirect', () => {
    (usePathname as jest.Mock).mockReturnValue('/business/dashboard');
    (useMyBusinesses as jest.Mock).mockReturnValue({ data: undefined, isLoading: true });

    const { result } = renderHook(() => useSellerGuard());

    expect(result.current.isChecking).toBe(true);
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  test('test_useSellerGuard_unguardedRoute_setsIsVerifiedAndDoesNotRedirect', async () => {
    (usePathname as jest.Mock).mockReturnValue('/business/verification');
    (useMyBusinesses as jest.Mock).mockReturnValue({ data: undefined, isLoading: false });

    const { result } = renderHook(() => useSellerGuard());
    await act(async () => { await new Promise(process.nextTick); });

    expect(result.current.isVerified).toBe(true);
    expect(result.current.isChecking).toBe(false);
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  test('test_useSellerGuard_verificationStatusRoute_setsIsVerifiedAndDoesNotRedirect', async () => {
    (usePathname as jest.Mock).mockReturnValue('/business/verification-status');
    (useMyBusinesses as jest.Mock).mockReturnValue({ data: undefined, isLoading: false });

    const { result } = renderHook(() => useSellerGuard());
    await act(async () => { await new Promise(process.nextTick); });

    expect(result.current.isVerified).toBe(true);
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  test('test_useSellerGuard_registerRoute_setsIsVerifiedAndDoesNotRedirect', async () => {
    (usePathname as jest.Mock).mockReturnValue('/business/register');
    (useMyBusinesses as jest.Mock).mockReturnValue({ data: undefined, isLoading: false });

    const { result } = renderHook(() => useSellerGuard());
    await act(async () => { await new Promise(process.nextTick); });

    expect(result.current.isVerified).toBe(true);
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  test('test_useSellerGuard_rejectedBusiness_redirectsToVerificationStatus', async () => {
    (usePathname as jest.Mock).mockReturnValue('/business/products');
    (useMyBusinesses as jest.Mock).mockReturnValue({
      data: { businesses: [{ verificationStatus: 'rejected' }] },
      isLoading: false,
    });

    renderHook(() => useSellerGuard());
    await act(async () => { await new Promise(process.nextTick); });

    expect(mockRouterReplace).toHaveBeenCalledWith('/business/verification-status');
  });

  test('test_useSellerGuard_rejectedBusinessAlreadyOnVerificationStatus_doesNotRedirect', async () => {
    (usePathname as jest.Mock).mockReturnValue('/business/verification-status');
    (useMyBusinesses as jest.Mock).mockReturnValue({
      data: { businesses: [{ verificationStatus: 'rejected' }] },
      isLoading: false,
    });

    renderHook(() => useSellerGuard());
    await act(async () => { await new Promise(process.nextTick); });

    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  test('test_useSellerGuard_pendingBusiness_doesNotRedirectAndSetsIsVerified', async () => {
    (usePathname as jest.Mock).mockReturnValue('/business/dashboard');
    (useMyBusinesses as jest.Mock).mockReturnValue({
      data: { businesses: [{ verificationStatus: 'pending' }] },
      isLoading: false,
    });

    const { result } = renderHook(() => useSellerGuard());
    await act(async () => { await new Promise(process.nextTick); });

    expect(mockRouterReplace).not.toHaveBeenCalled();
    expect(result.current.isVerified).toBe(true);
  });

  test('test_useSellerGuard_verifiedBusiness_setsIsVerifiedAndDoesNotRedirect', async () => {
    (usePathname as jest.Mock).mockReturnValue('/business/analytics');
    (useMyBusinesses as jest.Mock).mockReturnValue({
      data: { businesses: [{ verificationStatus: 'verified' }] },
      isLoading: false,
    });

    const { result } = renderHook(() => useSellerGuard());
    await act(async () => { await new Promise(process.nextTick); });

    expect(result.current.isVerified).toBe(true);
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  test('test_useSellerGuard_noBusiness_cachedNonVerifiedStatus_redirectsToVerificationStatus', async () => {
    (usePathname as jest.Mock).mockReturnValue('/business/products');
    (useMyBusinesses as jest.Mock).mockReturnValue({ data: undefined, isLoading: false });
    (ApiService.storage.getItem as jest.Mock).mockResolvedValueOnce('pending');

    renderHook(() => useSellerGuard());
    await act(async () => { await new Promise(process.nextTick); });

    expect(mockRouterReplace).toHaveBeenCalledWith('/business/verification-status');
  });

  test('test_useSellerGuard_noBusiness_noCachedStatus_setsIsVerified', async () => {
    (usePathname as jest.Mock).mockReturnValue('/business/products');
    (useMyBusinesses as jest.Mock).mockReturnValue({ data: undefined, isLoading: false });
    (ApiService.storage.getItem as jest.Mock).mockResolvedValueOnce(null);

    const { result } = renderHook(() => useSellerGuard());
    await act(async () => { await new Promise(process.nextTick); });

    expect(mockRouterReplace).not.toHaveBeenCalled();
    expect(result.current.isVerified).toBe(true);
  });

  test('test_useSellerGuard_noBusiness_cachedVerifiedStatus_setsIsVerified', async () => {
    (usePathname as jest.Mock).mockReturnValue('/business/orders');
    (useMyBusinesses as jest.Mock).mockReturnValue({ data: undefined, isLoading: false });
    (ApiService.storage.getItem as jest.Mock).mockResolvedValueOnce('verified');

    const { result } = renderHook(() => useSellerGuard());
    await act(async () => { await new Promise(process.nextTick); });

    expect(mockRouterReplace).not.toHaveBeenCalled();
    expect(result.current.isVerified).toBe(true);
  });

  test('test_useSellerGuard_dashboardRoute_doesNotRedirectDespiteNonVerifiedCachedStatus', async () => {
    (usePathname as jest.Mock).mockReturnValue('/business/dashboard');
    (useMyBusinesses as jest.Mock).mockReturnValue({ data: undefined, isLoading: false });
    (ApiService.storage.getItem as jest.Mock).mockResolvedValueOnce('pending');

    renderHook(() => useSellerGuard());
    await act(async () => { await new Promise(process.nextTick); });

    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  test('test_useSellerGuard_validCall_returnsIsCheckingAndIsVerifiedState', async () => {
    (usePathname as jest.Mock).mockReturnValue('/business/verification');
    (useMyBusinesses as jest.Mock).mockReturnValue({ data: undefined, isLoading: false });

    const { result } = renderHook(() => useSellerGuard());
    await act(async () => { await new Promise(process.nextTick); });

    expect(result.current).toHaveProperty('isChecking');
    expect(result.current).toHaveProperty('isVerified');
    expect(typeof result.current.isChecking).toBe('boolean');
    expect(typeof result.current.isVerified).toBe('boolean');
  });
});
