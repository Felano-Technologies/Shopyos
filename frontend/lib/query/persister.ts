import { storage } from '../../services/api';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { PersistedClient, Persister } from '@tanstack/react-query-persist-client';

const CACHE_KEY = 'SHOPYOS_QUERY_CACHE';
const CACHE_MAX_AGE = 1000 * 60 * 60 * 24 * 7;

export const asyncStoragePersister: Persister = {
  persistClient: async (client: PersistedClient) => {
    try {
      const sanitizedClient = sanitizeForStorage(client);
      await storage.setItem(CACHE_KEY, JSON.stringify(sanitizedClient));
    } catch (error) {
      console.error('Failed to persist query cache:', error);
    }
  },
  restoreClient: async () => {
    try {
      const cached = await storage.getItem(CACHE_KEY);
      if (!cached) return undefined;
      
      const parsed = JSON.parse(cached) as PersistedClient;
      
      if (Date.now() - parsed.timestamp > CACHE_MAX_AGE) {
        await storage.removeItem(CACHE_KEY);
        return undefined;
      }
      
      return parsed;
    } catch (error) {
      console.error('Failed to restore query cache:', error);
      return undefined;
    }
  },
  removeClient: async () => {
    try {
      await storage.removeItem(CACHE_KEY);
    } catch (error) {
      console.error('Failed to remove query cache:', error);
    }
  },
};

function sanitizeForStorage(client: PersistedClient): PersistedClient {
  const sanitizedQueries = client.clientState.queries
    .filter(query => {
      const key = query.queryKey[0];
      return !['profile', 'orders'].includes(String(key));
    })
    .map(query => ({
      ...query,
      state: {
        ...query.state,
        error: null,
      },
    }));

  return {
    ...client,
    clientState: {
      ...client.clientState,
      queries: sanitizedQueries,
      mutations: [],
    },
  };
}
