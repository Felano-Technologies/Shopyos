jest.mock('../../services/client', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
  extractErrorMessage: (err: any) => err?.message || 'Error',
}));

import { api } from '../../services/client';
import { getActiveFlashSale } from '../../services/flashSales';

const mockApi = api as jest.Mocked<typeof api>;

describe('flashSales service', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('getActiveFlashSale', () => {
    test('test_getActiveFlashSale_activeSale_returnsData', async () => {
      const mockData = {
        success: true,
        active: true,
        sale: { id: 'sale-1', title: 'Summer Sale', description: null, startsAt: '2026-06-01T00:00:00Z', endsAt: '2026-06-30T23:59:59Z' },
        products: [{ _id: 'p1', name: 'Shirt', price: 50, compare_at_price: 100, images: [], category: 'fashion', average_rating: 4.5, store_id: 'store-1', stockLimit: 10, soldCount: 3 }],
      };
      mockApi.get.mockResolvedValueOnce({ data: mockData });

      const result = await getActiveFlashSale();

      expect(mockApi.get).toHaveBeenCalledWith('/flash-sales/active');
      expect(result).toEqual(mockData);
    });

    test('test_getActiveFlashSale_noActiveSale_returnsInactiveResponse', async () => {
      const mockData = { success: true, active: false, sale: null, products: [] };
      mockApi.get.mockResolvedValueOnce({ data: mockData });

      const result = await getActiveFlashSale();

      expect(result.active).toBe(false);
      expect(result.products).toHaveLength(0);
    });

    test('test_getActiveFlashSale_networkError_propagatesError', async () => {
      mockApi.get.mockRejectedValueOnce(new Error('Network error'));

      await expect(getActiveFlashSale()).rejects.toThrow('Network error');
    });
  });
});
