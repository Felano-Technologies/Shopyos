jest.mock('@tanstack/react-query', () => ({
  __esModule: true,
  useQuery: jest.fn(),
}));

jest.mock('@/services/api', () => ({
  __esModule: true,
  getActiveBanners: jest.fn(),
  getPromotedProducts: jest.fn(),
}));

import { useQuery } from '@tanstack/react-query';
import * as ApiService from '@/services/api';
import { useActiveBanners, usePromotedProducts } from '../../hooks/useBanners';
import { queryKeys } from '@/lib/query/keys';

describe('useBanners hooks', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('useActiveBanners', () => {
    test('test_useActiveBanners_validCall_invokesUseQueryWithCorrectConfig', async () => {
      (useQuery as jest.Mock).mockReturnValue({ data: { banners: [] }, isLoading: false });

      const result = useActiveBanners();

      expect(useQuery).toHaveBeenCalledWith(expect.objectContaining({
        queryKey: queryKeys.banners.active(),
        staleTime: 5 * 60 * 1000,
        gcTime: 15 * 60 * 1000,
      }));
      const config = (useQuery as jest.Mock).mock.calls[0][0];
      (ApiService.getActiveBanners as jest.Mock).mockResolvedValueOnce({ banners: [{ id: 'b1' }] });
      await config.queryFn();
      expect(ApiService.getActiveBanners).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    test('test_useActiveBanners_loading_returnsLoadingState', () => {
      (useQuery as jest.Mock).mockReturnValue({ data: undefined, isLoading: true });

      const result = useActiveBanners();

      expect(result.isLoading).toBe(true);
    });
  });

  describe('usePromotedProducts', () => {
    test('test_usePromotedProducts_validCall_invokesUseQueryWithCorrectConfig', async () => {
      (useQuery as jest.Mock).mockReturnValue({ data: { products: [] }, isLoading: false });

      const result = usePromotedProducts();

      expect(useQuery).toHaveBeenCalledWith(expect.objectContaining({
        queryKey: queryKeys.banners.promoted(),
        staleTime: 5 * 60 * 1000,
        gcTime: 15 * 60 * 1000,
      }));
      const config = (useQuery as jest.Mock).mock.calls[0][0];
      (ApiService.getPromotedProducts as jest.Mock).mockResolvedValueOnce({ products: [] });
      await config.queryFn();
      expect(ApiService.getPromotedProducts).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });
});
