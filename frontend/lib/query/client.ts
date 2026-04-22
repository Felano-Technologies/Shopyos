// lib/query/client.ts
// FIX 1: Aligned staleTime/gcTime to backend Redis TTLs.
// Key change: refetchOnMount: false globally — React Query was re-fetching
// on every screen mount even when data was fresh, defeating Redis caching.
// Each hook overrides this where fresh data is truly needed (e.g. orders).

import { QueryClient , focusManager } from '@tanstack/react-query';
import { AppState, AppStateStatus } from 'react-native';


export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 5 min default — matches backend Redis product/search cache TTL
      staleTime: 5 * 60 * 1000,
      // Keep unused data in memory for 30 min
      gcTime: 30 * 60 * 1000,

      // KEY FIX: was `true` — caused a network hit on every screen mount
      // even when data was fresh. Screens that need live data (orders,
      // cart, profile) set refetchOnMount: true individually in their hooks.
      refetchOnMount: false,

      // Still refetch when network comes back online
      refetchOnReconnect: true,

      // Don't refetch just because the app came to foreground
      // (focusManager already fires on AppState 'active' below)
      refetchOnWindowFocus: false,

      // Retry once on failure, but NOT on 4xx errors (handled below)
      retry: (failureCount, error: any) => {
        // Never retry on client errors — these won't self-resolve
        const status = error?.response?.status;
        if (status && status >= 400 && status < 500) return false;
        // Retry once on network/5xx errors
        return failureCount < 1;
      },

      networkMode: 'online',
    },
    mutations: {
      // Never auto-retry mutations — side effects must be explicit
      retry: 0,
      networkMode: 'online',
    },
  },
});

// React Native app state → React Query focus manager bridge.
// When app comes back to foreground, mark queries as needing re-check.
focusManager.setEventListener((handleFocus) => {
  const subscription = AppState.addEventListener(
    'change',
    (status: AppStateStatus) => {
      handleFocus(status === 'active');
    }
  );
  return () => subscription.remove();
});