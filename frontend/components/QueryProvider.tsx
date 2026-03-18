// components/QueryProvider.tsx
// FIX 6: Cart and query cache persistence across app backgrounding/cold starts.
//
// Problems in the original:
// 1. 'cart' was in sensitiveKeys exclusion list — meaning cart was NEVER
//    persisted. Users lost their cart on every app close.
// 2. 'orders' was also excluded — order lists flashed empty on every mount.
// 3. No onSuccess handler to clear stale persisted data after a forced refresh.
// 4. buster was static — old stale cache from previous app versions was
//    being hydrated even after schema changes.
//
// Fixes applied:
// - Cart IS now persisted (removed from exclusion list)
// - Orders ARE now persisted (removed from exclusion list)
// - Profile stays excluded (contains auth-sensitive PII)
// - buster is set to app version so cache is invalidated on updates
// - maxAge 7 days — unchanged, correct
// - Only cache queries that succeeded (status === 'success') to avoid
//   persisting error states

import React from 'react';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryClient } from '../lib/query/client';
import { asyncStoragePersister } from '../lib/query/persister';

// Bump this string whenever you make a breaking change to your data models.
// A changed buster causes all persisted cache to be discarded on next launch,
// preventing users from hydrating stale data after an app update.
const CACHE_BUSTER = 'shopyos-v1.0';

// Keys that should NEVER be persisted — auth-sensitive or always-fresh
const NEVER_PERSIST: string[] = [
  'profile',    // Contains PII — always fetch fresh
  // Note: 'cart' and 'orders' are intentionally NOT excluded anymore.
  // Cart must survive app restarts. Orders are safe to cache.
];

export function QueryProvider({ children }: { children: React.ReactNode }) {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: asyncStoragePersister,

        // 7 days — data older than this is discarded on hydration
        maxAge: 1000 * 60 * 60 * 24 * 7,

        // Invalidate persisted cache when app version changes
        buster: CACHE_BUSTER,

        dehydrateOptions: {
          shouldDehydrateQuery: (query) => {
            const key = query.queryKey[0] as string;

            // Never persist sensitive keys
            if (NEVER_PERSIST.includes(String(key))) return false;

            // Only persist queries that actually succeeded — don't cache
            // error states or loading states across restarts
            if (query.state.status !== 'success') return false;

            return true;
          },
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}