const mockRouterReplace = jest.fn();
jest.mock('expo-router', () => ({
  __esModule: true,
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}));

jest.mock('../../hooks/useDelivery', () => ({
  __esModule: true,
  useDriverProfile: jest.fn(),
}));

jest.mock('@/services/api', () => ({
  __esModule: true,
  secureStorage: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
}));

import React from 'react';
import { render, act } from '@testing-library/react-native';
import { useRouter, usePathname } from 'expo-router';
import { useDriverProfile } from '../../hooks/useDelivery';
import { useDriverGuard } from '../../hooks/useDriverGuard';
import * as ApiService from '@/services/api';

let hookOutput: ReturnType<typeof useDriverGuard> | null = null;
function TestHook() { hookOutput = useDriverGuard(); return null; }

async function mountAndFlush() {
  await act(async () => {
    render(<TestHook />);
    await new Promise(process.nextTick);
  });
}

describe('useDriverGuard Hook Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    hookOutput = null;
    (useRouter as jest.Mock).mockReturnValue({ replace: mockRouterReplace });
    (ApiService.secureStorage.getItem as jest.Mock).mockResolvedValue(null);
  });

  test('test_useDriverGuard_isLoading_setsIsCheckingTrueAndDoesNotRedirect', async () => {
    (usePathname as jest.Mock).mockReturnValue('/driver/dashboard');
    (useDriverProfile as jest.Mock).mockReturnValue({ data: undefined, isLoading: true });
    await mountAndFlush();
    expect(hookOutput!.isChecking).toBe(true);
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  test('test_useDriverGuard_noToken_setsIsCheckingFalseAndDoesNotRedirect', async () => {
    (usePathname as jest.Mock).mockReturnValue('/driver/dashboard');
    (useDriverProfile as jest.Mock).mockReturnValue({ data: undefined, isLoading: false });
    (ApiService.secureStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
    await mountAndFlush();
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  test('test_useDriverGuard_unguardedVerificationRoute_doesNotRedirect', async () => {
    (usePathname as jest.Mock).mockReturnValue('/driver/verification');
    (useDriverProfile as jest.Mock).mockReturnValue({ data: undefined, isLoading: false });
    (ApiService.secureStorage.getItem as jest.Mock).mockResolvedValueOnce('user-token');
    await mountAndFlush();
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  test('test_useDriverGuard_unguardedVerificationStatusRoute_doesNotRedirect', async () => {
    (usePathname as jest.Mock).mockReturnValue('/driver/verification-status');
    (useDriverProfile as jest.Mock).mockReturnValue({ data: undefined, isLoading: false });
    (ApiService.secureStorage.getItem as jest.Mock).mockResolvedValueOnce('user-token');
    await mountAndFlush();
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  test('test_useDriverGuard_verifiedDriver_doesNotRedirect', async () => {
    (usePathname as jest.Mock).mockReturnValue('/driver/dashboard');
    (useDriverProfile as jest.Mock).mockReturnValue({
      data: { profile: { verification_status: 'verified', is_verified: true } }, isLoading: false,
    });
    (ApiService.secureStorage.getItem as jest.Mock).mockResolvedValueOnce('user-token');
    await mountAndFlush();
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  test('test_useDriverGuard_pendingDriver_doesNotRedirectFromDashboard', async () => {
    (usePathname as jest.Mock).mockReturnValue('/driver/dashboard');
    (useDriverProfile as jest.Mock).mockReturnValue({
      data: { profile: { verification_status: 'pending', is_verified: false } }, isLoading: false,
    });
    (ApiService.secureStorage.getItem as jest.Mock).mockResolvedValueOnce('user-token');
    await mountAndFlush();
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  test('test_useDriverGuard_rejectedDriver_redirectsToVerification', async () => {
    (usePathname as jest.Mock).mockReturnValue('/driver/dashboard');
    (useDriverProfile as jest.Mock).mockReturnValue({
      data: { profile: { verification_status: 'rejected' } }, isLoading: false,
    });
    (ApiService.secureStorage.getItem as jest.Mock).mockResolvedValueOnce('user-token');
    await mountAndFlush();
    expect(mockRouterReplace).toHaveBeenCalledWith('/driver/verification');
  });

  test('test_useDriverGuard_rejectedDriverAlreadyOnVerification_doesNotDoubleRedirect', async () => {
    (usePathname as jest.Mock).mockReturnValue('/driver/verification');
    (useDriverProfile as jest.Mock).mockReturnValue({
      data: { profile: { verification_status: 'rejected' } }, isLoading: false,
    });
    (ApiService.secureStorage.getItem as jest.Mock).mockResolvedValueOnce('user-token');
    await mountAndFlush();
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  test('test_useDriverGuard_isVerifiedFlagTrue_doesNotRedirect', async () => {
    (usePathname as jest.Mock).mockReturnValue('/driver/deliveries');
    (useDriverProfile as jest.Mock).mockReturnValue({
      data: { profile: { is_verified: true } }, isLoading: false,
    });
    (ApiService.secureStorage.getItem as jest.Mock).mockResolvedValueOnce('user-token');
    await mountAndFlush();
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  test('test_useDriverGuard_noDriverProfile_redirectsToVerification', async () => {
    (usePathname as jest.Mock).mockReturnValue('/driver/dashboard');
    (useDriverProfile as jest.Mock).mockReturnValue({ data: null, isLoading: false });
    (ApiService.secureStorage.getItem as jest.Mock).mockResolvedValueOnce('user-token');
    await mountAndFlush();
    expect(mockRouterReplace).toHaveBeenCalledWith('/driver/verification');
  });

  test('test_useDriverGuard_noProfileOnDriverIndex_doesNotRedirect', async () => {
    (usePathname as jest.Mock).mockReturnValue('/driver/index');
    (useDriverProfile as jest.Mock).mockReturnValue({ data: null, isLoading: false });
    (ApiService.secureStorage.getItem as jest.Mock).mockResolvedValueOnce('user-token');
    await mountAndFlush();
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  test('test_useDriverGuard_profileDataShape_handlesDataPropertyCorrectly', async () => {
    (usePathname as jest.Mock).mockReturnValue('/driver/earnings');
    (useDriverProfile as jest.Mock).mockReturnValue({
      data: { data: { verification_status: 'verified' } }, isLoading: false,
    });
    (ApiService.secureStorage.getItem as jest.Mock).mockResolvedValueOnce('user-token');
    await mountAndFlush();
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  test('test_useDriverGuard_flatProfileDataShape_handlesDirectObjectCorrectly', async () => {
    (usePathname as jest.Mock).mockReturnValue('/driver/earnings');
    (useDriverProfile as jest.Mock).mockReturnValue({
      data: { verification_status: 'verified' }, isLoading: false,
    });
    (ApiService.secureStorage.getItem as jest.Mock).mockResolvedValueOnce('user-token');
    await mountAndFlush();
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  test('test_useDriverGuard_validCall_returnsIsCheckingAndProfileState', async () => {
    (usePathname as jest.Mock).mockReturnValue('/driver/verification');
    (useDriverProfile as jest.Mock).mockReturnValue({
      data: { profile: { verification_status: 'verified' } }, isLoading: false,
    });
    (ApiService.secureStorage.getItem as jest.Mock).mockResolvedValue(null);
    await mountAndFlush();
    expect(hookOutput).toHaveProperty('isChecking');
    expect(typeof hookOutput!.isChecking).toBe('boolean');
    expect(hookOutput).toHaveProperty('profile');
  });
});
