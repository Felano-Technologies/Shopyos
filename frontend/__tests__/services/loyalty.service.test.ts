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
import { getLoyaltyBalance, getLoyaltyTransactions, validatePromoCode } from '../../services/loyalty';

const mockApi = api as jest.Mocked<typeof api>;

describe('loyalty service', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('getLoyaltyBalance', () => {
    test('test_getLoyaltyBalance_success_returnsBalance', async () => {
      const mockData = { success: true, balance: 500, lifetimeEarned: 1200, redeemableValue: 5 };
      mockApi.get.mockResolvedValueOnce({ data: mockData });

      const result = await getLoyaltyBalance();

      expect(mockApi.get).toHaveBeenCalledWith('/loyalty/balance');
      expect(result).toEqual(mockData);
    });

    test('test_getLoyaltyBalance_networkError_throwsError', async () => {
      mockApi.get.mockRejectedValueOnce({ message: 'Network error' });

      await expect(getLoyaltyBalance()).rejects.toThrow('Network error');
    });

    test('test_getLoyaltyBalance_userMessagePresent_throwsUserMessage', async () => {
      mockApi.get.mockRejectedValueOnce({ userMessage: 'Session expired' });

      await expect(getLoyaltyBalance()).rejects.toThrow('Session expired');
    });
  });

  describe('getLoyaltyTransactions', () => {
    test('test_getLoyaltyTransactions_defaultParams_callsApiCorrectly', async () => {
      mockApi.get.mockResolvedValueOnce({ data: { transactions: [] } });

      await getLoyaltyTransactions();

      expect(mockApi.get).toHaveBeenCalledWith('/loyalty/transactions', { params: {} });
    });

    test('test_getLoyaltyTransactions_withParams_forwardsParams', async () => {
      mockApi.get.mockResolvedValueOnce({ data: { transactions: [{ id: 't1' }] } });

      const result = await getLoyaltyTransactions({ limit: 10, offset: 20 });

      expect(mockApi.get).toHaveBeenCalledWith('/loyalty/transactions', { params: { limit: 10, offset: 20 } });
      expect(result).toEqual({ transactions: [{ id: 't1' }] });
    });

    test('test_getLoyaltyTransactions_error_throwsError', async () => {
      mockApi.get.mockRejectedValueOnce({ message: 'Failed to load' });

      await expect(getLoyaltyTransactions()).rejects.toThrow('Failed to load');
    });
  });

  describe('validatePromoCode', () => {
    test('test_validatePromoCode_validCode_returnsPromo', async () => {
      const mockData = {
        success: true,
        promo: { id: 'promo-1', code: 'SAVE10', type: 'percentage', value: 10, discountAmount: 50, label: '10% off' },
      };
      mockApi.post.mockResolvedValueOnce({ data: mockData });

      const result = await validatePromoCode('SAVE10', 500);

      expect(mockApi.post).toHaveBeenCalledWith('/promo/validate', { code: 'SAVE10', subtotal: 500 });
      expect(result).toEqual(mockData);
    });

    test('test_validatePromoCode_invalidCode_throwsError', async () => {
      mockApi.post.mockRejectedValueOnce({ message: 'Invalid promo code' });

      await expect(validatePromoCode('INVALID', 100)).rejects.toThrow('Invalid promo code');
    });

    test('test_validatePromoCode_userMessage_throwsUserMessage', async () => {
      mockApi.post.mockRejectedValueOnce({ userMessage: 'Promo has expired' });

      await expect(validatePromoCode('OLD20', 200)).rejects.toThrow('Promo has expired');
    });
  });
});
