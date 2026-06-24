import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 5 min default — matches backend Redis product/search cache TTL
      staleTime: 5 * 60 * 1000,
      // Keep unused data in memory for 30 min
      gcTime: 30 * 60 * 1000,

      // Refetch when window is focused
      refetchOnWindowFocus: true,

      // Refetch when network comes back online
      refetchOnReconnect: true,

      // Retry once on failure, but NOT on 4xx client errors
      retry: (failureCount, error: any) => {
        const status = error?.response?.status;
        if (status && status >= 400 && status < 500) return false;
        return failureCount < 1;
      },

      networkMode: 'online',
    },
    mutations: {
      retry: 0,
      networkMode: 'online',
    },
  },
});
