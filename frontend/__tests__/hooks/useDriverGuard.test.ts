/**
 * __tests__/hooks/useDriverGuard.test.ts
 */

const mockRouterReplace = jest.fn();
jest.mock('expo-router', () => ({
  __esModule: true,
  useRouter: jest.fn().mockReturnValue({ replace: mockRouterReplace }),
  usePathname: jest.fn(),
}));

jest.mock('../../hooks/useDelivery', () => ({
  __esModule: true,
  useDriverProfile: jest.fn(),
}));

jest.mock('@/services/api', () => ({
  __esModule: true,
  secureStorage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

import { renderHook, act } from '@testing-library/react-native';
import { usePathname } from 'expo-router';
import { useDriverProfile } from '../../hooks/useDelivery';
import { useDriverGuard } from '../../hooks/useDriverGuard';
import * as ApiService from '@/services/api';

describe('useDriverGuard Hook Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (ApiService.secureStorage.getItem as jest.Mock).mockResolvedValue(null);
  });

  test('test_useDriverGuard_isLoading_setsIsCheckingTrueAndDoesNotRedirect', () => {
    (usePathname as jest.Mock).mockReturnValue('/driver/dashboard');
    (useDriverProfile as jest.Mock).mockReturnValue({ data: undefined, isLoading: true });

    const { result } = renderHook(() => useDriverGuard());

    expect(result.current.isChecking).toBe(true);
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  test('test_useDriverGuard_noToken_setsIsCheckingFalseAndDoesNotRedirect', async () => {
    (usePathname as jest.Mock).mockReturnValue('/driver/dashboard');
    (useDriverProfile as jest.Mock).mockReturnValue({ data: undefined, isLoading: false });
    (ApiService.secureStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

    renderHook(() => useDriverGuard());
    await act(async () => { await new Promise(process.nextTick); });

    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  test('test_useDriverGuard_unguardedVerificationRoute_doesNotRedirect', async () => {
    (usePathname as jest.Mock).mockReturnValue('/driver/verification');
    (useDriverProfile as jest.Mock).mockReturnValue({ data: undefined, isLoading: false });
    (ApiService.secureStorage.getItem as jest.Mock).mockResolvedValueOnce('user-token');

    renderHook(() => useDriverGuard());
    await act(async () => { await new Promise(process.nextTick); });

    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  test('test_useDriverGuard_unguardedVerificationStatusRoute_doesNotRedirect', async () => {
    (usePathname as jest.Mock).mockReturnValue('/driver/verification-status');
    (useDriverProfile as jest.Mock).mockReturnValue({ data: undefined, isLoading: false });
    (ApiService.secureStorage.getItem as jest.Mock).mockResolvedValueOnce('user-token');

    renderHook(() => useDriverGuard());
    await act(async () => { await new Promise(process.nextTick); });

    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  test('test_useDriverGuard_verifiedDriver_doesNotRedirect', async () => {
    (usePathname as jest.Mock).mockReturnValue('/driver/dashboard');
    (useDriverProfile as jest.Mock).mockReturnValue({
      data: { profile: { verification_status: 'verified', is_verified: true } },
      isLoading: false,
    });
    (ApiService.secureStorage.getItem as jest.Mock).mockResolvedValueOnce('user-token');

    renderHook(() => useDriverGuard());
    await act(async () => { await new Promise(process.nextTick); });

    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  test('test_useDriverGuard_pendingDriver_doesNotRedirectFromDashboard', async () => {
    (usePathname as jest.Mock).mockReturnValue('/driver/dashboard');
    (useDriverProfile as jest.Mock).mockReturnValue({
      data: { profile: { verification_status: 'pending', is_verified: false } },
      isLoading: false,
    });
    (ApiService.secureStorage.getItem as jest.Mock).mockResolvedValueOnce('user-token');

    renderHook(() => useDriverGuard());
    await act(async () => { await new Promise(process.nextTick); });

    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  test('test_useDriverGuard_rejectedDriver_redirectsToVerification', async () => {
    (usePathname as jest.Mock).mockReturnValue('/driver/dashboard');
    (useDriverProfile as jest.Mock).mockReturnValue({
      data: { profile: { verification_status: 'rejected' } },
      isLoading: false,
    });
    (ApiService.secureStorage.getItem as jest.Mock).mockResolvedValueOnce('user-token');

    renderHook(() => useDriverGuard());
    await act(async () => { await new Promise(process.nextTick); });

    expect(mockRouterReplace).toHaveBeenCalledWith('/driver/verification');
  });

  test('test_useDriverGuard_rejectedDriverAlreadyOnVerification_doesNotDoubleRedirect', async () => {
    (usePathname as jest.Mock).mockReturnValue('/driver/verification');
    (useDriverProfile as jest.Mock).mockReturnValue({
      data: { profile: { verification_status: 'rejected' } },
      isLoading: false,
    });
    (ApiService.secureStorage.getItem as jest.Mock).mockResolvedValueOnce('user-token');

    renderHook(() => useDriverGuard());
    await act(async () => { await new Promise(process.nextTick); });

    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  test('test_useDriverGuard_isVerifiedFlagTrue_doesNotRedirect', async () => {
    (usePathname as jest.Mock).mockReturnValue('/driver/deliveries');
    (useDriverProfile as jest.Mock).mockReturnValue({
      data: { profile: { is_verified: true } },
      isLoading: false,
    });
    (ApiService.secureStorage.getItem as jest.Mock).mockResolvedValueOnce('user-token');

    renderHook(() => useDriverGuard());
    await act(async () => { await new Promise(process.nextTick); });

    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  test('test_useDriverGuard_noDriverProfile_redirectsToVerification', async () => {
    (usePathname as jest.Mock).mockReturnValue('/driver/dashboard');
    (useDriverProfile as jest.Mock).mockReturnValue({ data: null, isLoading: false });
    (ApiService.secureStorage.getItem as jest.Mock).mockResolvedValueOnce('user-token');

    renderHook(() => useDriverGuard());
    await act(async () => { await new Promise(process.nextTick); });

    expect(mockRouterReplace).toHaveBeenCalledWith('/driver/verification');
  });

  test('test_useDriverGuard_noProfileOnDriverIndex_doesNotRedirect', async () => {
    (usePathname as jest.Mock).mockReturnValue('/driver/index');
    (useDriverProfile as jest.Mock).mockReturnValue({ data: null, isLoading: false });
    (ApiService.secureStorage.getItem as jest.Mock).mockResolvedValueOnce('user-token');

    renderHook(() => useDriverGuard());
    await act(async () => { await new Promise(process.nextTick); });

    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  test('test_useDriverGuard_profileDataShape_handlesDataPropertyCorrectly', async () => {
    (usePathname as jest.Mock).mockReturnValue('/driver/earnings');
    (useDriverProfile as jest.Mock).mockReturnValue({
      data: { data: { verification_status: 'verified' } },
      isLoading: false,
    });
    (ApiService.secureStorage.getItem as jest.Mock).mockResolvedValueOnce('user-token');

    renderHook(() => useDriverGuard());
    await act(async () => { await new Promise(process.nextTick); });

    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  test('test_useDriverGuard_flatProfileDataShape_handlesDirectObjectCorrectly', async () => {
    (usePathname as jest.Mock).mockReturnValue('/driver/earnings');
    (useDriverProfile as jest.Mock).mockReturnValue({
      data: { verification_status: 'verified' },
      isLoading: false,
    });
    (ApiService.secureStorage.getItem as jest.Mock).mockResolvedValueOnce('user-token');

    renderHook(() => useDriverGuard());
    await act(async () => { await new Promise(process.nextTick); });

    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  test('test_useDriverGuard_validCall_returnsIsCheckingAndProfileState', async () => {
    (usePathname as jest.Mock).mockReturnValue('/driver/verification');
    (useDriverProfile as jest.Mock).mockReturnValue({
      data: { profile: { verification_status: 'verified' } },
      isLoading: false,
    });
    (ApiService.secureStorage.getItem as jest.Mock).mockResolvedValue(null);

    const { result } = renderHook(() => useDriverGuard());
    await act(async () => { await new Promise(process.nextTick); });

    expect(result.current).toHaveProperty('isChecking');
    expect(typeof result.current.isChecking).toBe('boolean');
    expect(result.current).toHaveProperty('profile');
  });
});
