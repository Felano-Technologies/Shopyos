import React, { useState, useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryClient } from '../lib/query/client';
import { asyncStoragePersister } from '../lib/query/persister';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: asyncStoragePersister,
        maxAge: 1000 * 60 * 60 * 24 * 7,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => {
            const key = query.queryKey[0];
            const sensitiveKeys = ['profile', 'orders', 'cart'];
            return !sensitiveKeys.includes(String(key));
          },
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
