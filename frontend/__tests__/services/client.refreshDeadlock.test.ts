/**
 * __tests__/services/client.refreshDeadlock.test.ts
 *
 * Reproduces the token-refresh deadlock: when a request 401s and the
 * refresh-token POST itself also 401s (dead refresh token), the response
 * interceptor used to re-enter handleTokenExpired for that /auth/refresh
 * failure too. Since isRefreshing was still true, it queued behind a promise
 * that only resolves once the very request it's blocking on settles —
 * a permanent hang with no timeout anywhere in the chain.
 */

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('@/utils/navigation', () => ({ resetToRoute: jest.fn() }));
jest.mock('@/components/InAppToastHost', () => ({ CustomInAppToast: { show: jest.fn() } }));
jest.mock('../../services/storage', () => ({
  storage: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
  secureStorage: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
  clearUserProfileCache: jest.fn(),
}));
// Set EXPO_PUBLIC_API_URL before client.ts loads so getBaseURL() doesn't throw
jest.mock('../../services/client', () => {
  process.env.EXPO_PUBLIC_API_URL = 'http://localhost:5000';
  return jest.requireActual('../../services/client');
});

import { api } from '../../services/client';
import { secureStorage } from '../../services/storage';

jest.setTimeout(15000);

// Races the real call against a short internal deadline so a reintroduced
// deadlock fails fast and clearly instead of hanging the whole test run.
function withHangDetection<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`TEST-DETECTED-HANG: request did not settle within ${ms}ms`)), ms);
  });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}

// A custom axios adapter must construct the rejection itself — unlike a real
// transport, resolving with a non-2xx status object does not trigger axios's
// validateStatus rejection path.
function makeUnauthorizedAdapter() {
  return async (config: any) => {
    const response = { data: { success: false }, status: 401, statusText: 'Unauthorized', headers: {}, config, request: {} };
    const err: any = new Error('Request failed with status code 401');
    err.response = response;
    err.config = config;
    err.isAxiosError = true;
    err.toJSON = () => ({});
    throw err;
  };
}

describe('client.ts token-refresh deadlock', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (secureStorage.getItem as jest.Mock).mockImplementation(async (key: string) => {
      if (key === 'refreshToken') return 'dummy-refresh-token';
      if (key === 'userToken') return 'dummy-access-token';
      return null;
    });

    // Every request 401s — simulating an expired access token AND an
    // already-dead refresh token (the scenario that used to deadlock).
    api.defaults.adapter = makeUnauthorizedAdapter() as any;
  });

  test('test_client_deadTokenAndDeadRefreshToken_rejectsInsteadOfHanging', async () => {
    await expect(
      withHangDetection(api.get('/some-protected-endpoint'), 5000)
    ).rejects.toMatchObject({
      response: { status: 401 },
    });
  });
});
