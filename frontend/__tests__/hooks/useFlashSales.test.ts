jest.mock('@tanstack/react-query', () => ({
  __esModule: true,
  useQuery: jest.fn(),
}));

jest.mock('@/services/flashSales', () => ({
  __esModule: true,
  getActiveFlashSale: jest.fn(),
}));

import { useQuery } from '@tanstack/react-query';
import { getActiveFlashSale } from '@/services/flashSales';
import { useFlashSales } from '../../hooks/useFlashSales';

describe('useFlashSales', () => {
  beforeEach(() => jest.clearAllMocks());

  test('test_useFlashSales_activeSale_returnsActiveSaleData', () => {
    const mockSale = { id: 'sale-1', title: 'Summer Sale', description: null, startsAt: '2026-06-01', endsAt: '2026-06-30' };
    const mockProducts = [{ _id: 'p1', name: 'Shirt', price: 50 }];
    (useQuery as jest.Mock).mockReturnValue({
      data: { active: true, sale: mockSale, products: mockProducts },
      isLoading: false,
    });

    const result = useFlashSales();

    expect(result.active).toBe(true);
    expect(result.sale).toEqual(mockSale);
    expect(result.products).toEqual(mockProducts);
    expect(result.loading).toBe(false);
  });

  test('test_useFlashSales_noActiveSale_returnsDefaults', () => {
    (useQuery as jest.Mock).mockReturnValue({ data: undefined, isLoading: false });

    const result = useFlashSales();

    expect(result.active).toBe(false);
    expect(result.sale).toBeNull();
    expect(result.products).toEqual([]);
    expect(result.loading).toBe(false);
  });

  test('test_useFlashSales_loading_returnsLoadingTrue', () => {
    (useQuery as jest.Mock).mockReturnValue({ data: undefined, isLoading: true });

    const result = useFlashSales();

    expect(result.loading).toBe(true);
  });

  test('test_useFlashSales_queryConfig_hasCorrectRefetchInterval', async () => {
    (useQuery as jest.Mock).mockReturnValue({ data: undefined, isLoading: false });

    useFlashSales();

    expect(useQuery).toHaveBeenCalledWith(expect.objectContaining({
      queryKey: ['flash-sales', 'active'],
      refetchInterval: 30_000,
      staleTime: 30_000,
    }));
    const config = (useQuery as jest.Mock).mock.calls[0][0];
    (getActiveFlashSale as jest.Mock).mockResolvedValueOnce({ active: true, sale: null, products: [] });
    await config.queryFn();
    expect(getActiveFlashSale).toHaveBeenCalled();
  });
});
