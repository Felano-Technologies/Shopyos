jest.mock('@tanstack/react-query', () => ({
  __esModule: true,
  useQuery: jest.fn(),
  useInfiniteQuery: jest.fn(),
  keepPreviousData: jest.fn(),
}));

jest.mock('@/services/api', () => ({
  __esModule: true,
  getAllStores: jest.fn(),
  getBusinessById: jest.fn(),
}));

import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import * as ApiService from '@/services/api';
import { useStores, useStoreDetail } from '../../hooks/useStores';
import { queryKeys } from '@/lib/query/keys';

describe('useStores hooks', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('useStores', () => {
    test('test_useStores_noFilters_invokesInfiniteQueryWithCorrectConfig', async () => {
      (useInfiniteQuery as jest.Mock).mockReturnValue({ data: undefined, isLoading: true });

      useStores();

      expect(useInfiniteQuery).toHaveBeenCalledWith(expect.objectContaining({
        queryKey: queryKeys.stores.infinite(undefined),
        initialPageParam: 0,
        staleTime: 5 * 60 * 1000,
        gcTime: 15 * 60 * 1000,
      }));
    });

    test('test_useStores_withFilters_forwardsFiltersToQueryFn', async () => {
      (useInfiniteQuery as jest.Mock).mockReturnValue({ data: undefined, isLoading: true });
      const filters = { search: 'electronics', sortBy: 'rating' as const };

      useStores(filters);

      expect(useInfiniteQuery).toHaveBeenCalledWith(expect.objectContaining({
        queryKey: queryKeys.stores.infinite(filters),
      }));
      const config = (useInfiniteQuery as jest.Mock).mock.calls[0][0];
      (ApiService.getAllStores as jest.Mock).mockResolvedValueOnce({ stores: [], pagination: { hasNext: false } });
      await config.queryFn({ pageParam: 0 });
      expect(ApiService.getAllStores).toHaveBeenCalledWith({ ...filters, limit: 20, offset: 0 });
    });

    test('test_useStores_getNextPageParam_withHasNext_returnsNextOffset', () => {
      (useInfiniteQuery as jest.Mock).mockReturnValue({ data: undefined });

      useStores();

      const config = (useInfiniteQuery as jest.Mock).mock.calls[0][0];
      const lastPage = { pagination: { hasNext: true, currentPage: 1, itemsPerPage: 20 } };
      expect(config.getNextPageParam(lastPage)).toBe(20);
    });

    test('test_useStores_getNextPageParam_noNextPage_returnsUndefined', () => {
      (useInfiniteQuery as jest.Mock).mockReturnValue({ data: undefined });

      useStores();

      const config = (useInfiniteQuery as jest.Mock).mock.calls[0][0];
      const lastPage = { pagination: { hasNext: false, currentPage: 1, itemsPerPage: 20 } };
      expect(config.getNextPageParam(lastPage)).toBeUndefined();
    });

    test('test_useStores_getNextPageParam_noPagination_returnsUndefined', () => {
      (useInfiniteQuery as jest.Mock).mockReturnValue({ data: undefined });

      useStores();

      const config = (useInfiniteQuery as jest.Mock).mock.calls[0][0];
      expect(config.getNextPageParam({})).toBeUndefined();
    });
  });

  describe('useStoreDetail', () => {
    test('test_useStoreDetail_validId_invokesUseQueryEnabled', async () => {
      (useQuery as jest.Mock).mockReturnValue({ data: {}, isLoading: false });

      useStoreDetail('store-123');

      expect(useQuery).toHaveBeenCalledWith(expect.objectContaining({
        queryKey: queryKeys.stores.detail('store-123'),
        enabled: true,
        staleTime: 5 * 60 * 1000,
        gcTime: 15 * 60 * 1000,
      }));
      const config = (useQuery as jest.Mock).mock.calls[0][0];
      (ApiService.getBusinessById as jest.Mock).mockResolvedValueOnce({ id: 'store-123' });
      await config.queryFn();
      expect(ApiService.getBusinessById).toHaveBeenCalledWith('store-123');
    });

    test('test_useStoreDetail_emptyId_disablesQuery', () => {
      (useQuery as jest.Mock).mockReturnValue({ data: undefined, isLoading: false });

      useStoreDetail('');

      expect(useQuery).toHaveBeenCalledWith(expect.objectContaining({
        enabled: false,
      }));
    });
  });
});
