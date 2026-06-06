/**
 * __tests__/services/payments.service.test.ts
 *
 * Unit tests for the payments service functions.
 * All API calls are mocked — no real network.
 * Conforms to guidelines/test.md.
 */

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('@/lib/query/client', () => ({
  queryClient: { clear: jest.fn(), invalidateQueries: jest.fn(), removeQueries: jest.fn() },
}));
jest.mock('../../components/InAppToastHost', () => ({ CustomInAppToast: { show: jest.fn() } }));
jest.mock('../../services/storage', () => ({
  storage: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn(), clear: jest.fn() },
  secureStorage: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
}));

jest.mock('../../services/client', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    defaults: { headers: { common: {} } },
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  },
  extractErrorMessage: (err: any) => err?.message || 'Unknown error',
  API_URL: 'http://localhost:5000/api/v1/',
  baseURL: 'http://localhost:5000',
  secureStorage: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
  storage: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn(), clear: jest.fn() },
  CustomInAppToast: { show: jest.fn() },
}));

import { api } from '../../services/client';
import {
  initializePayment,
  verifyPayment,
  getPaymentMethods,
  addPaymentMethod,
  deletePaymentMethod,
  setDefaultPaymentMethod,
  getPayoutHistory,
  requestPayout,
  initializeListingFee,
  initializeBannerPayment,
  verifyBannerPayment,
} from '../../services/payments';

describe('Payments Service Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── initializePayment ──────────────────────────────────────────────
  describe('initializePayment', () => {
    test('test_initializePayment_validParams_callsPostAndReturnsData', async () => {
      // Arrange
      (api.post as jest.Mock).mockResolvedValueOnce({
        data: { success: true, authorizationUrl: 'https://pay.example.com/checkout' },
      });

      // Act
      const result = await initializePayment({ orderId: 'ord-1', email: 'buyer@test.com', channel: 'card' });

      // Assert
      expect(api.post).toHaveBeenCalledWith('/payments/initialize', {
        orderId: 'ord-1',
        email: 'buyer@test.com',
        channel: 'card',
      });
      expect(result.success).toBe(true);
      expect(result.authorizationUrl).toBe('https://pay.example.com/checkout');
    });

    test('test_initializePayment_apiErrorWithResponseData_returnsErrorResponseData', async () => {
      // Arrange
      const apiError = {
        message: 'Order not found',
        response: { data: { success: false, error: 'Order not found' } },
      };
      (api.post as jest.Mock).mockRejectedValueOnce(apiError);

      // Act
      const result = await initializePayment({ orderId: 'bad-ord' });

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Order not found');
    });

    test('test_initializePayment_networkError_returnsFailureObjectWithMessage', async () => {
      // Arrange
      (api.post as jest.Mock).mockRejectedValueOnce(new Error('Network Error'));

      // Act
      const result = await initializePayment({ orderId: 'ord-2' });

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Network Error');
    });

    test('test_initializePayment_momoChannel_includesMomoParams', async () => {
      // Arrange
      (api.post as jest.Mock).mockResolvedValueOnce({
        data: { success: true, reference: 'ref-abc' },
      });

      // Act
      await initializePayment({
        orderId: 'ord-3',
        email: 'momo@test.com',
        channel: 'mobile_money',
        momoPhone: '+233241234567',
        momoProvider: 'mtn',
      });

      // Assert
      expect(api.post).toHaveBeenCalledWith('/payments/initialize', expect.objectContaining({
        channel: 'mobile_money',
        momoPhone: '+233241234567',
        momoProvider: 'mtn',
      }));
    });
  });

  // ── verifyPayment ──────────────────────────────────────────────────
  describe('verifyPayment', () => {
    test('test_verifyPayment_validReference_callsGetAndReturnsVerificationData', async () => {
      // Arrange
      (api.get as jest.Mock).mockResolvedValueOnce({
        data: { success: true, status: 'success', orderId: 'ord-1' },
      });

      // Act
      const result = await verifyPayment('ref-xyz');

      // Assert
      expect(api.get).toHaveBeenCalledWith('/payments/verify/ref-xyz');
      expect(result.success).toBe(true);
      expect(result.status).toBe('success');
    });

    test('test_verifyPayment_apiErrorWithResponseData_returnsErrorResponseData', async () => {
      // Arrange
      const apiError = {
        message: 'Invalid reference',
        response: { data: { success: false, error: 'Invalid payment reference' } },
      };
      (api.get as jest.Mock).mockRejectedValueOnce(apiError);

      // Act
      const result = await verifyPayment('bad-ref');

      // Assert
      expect(result.success).toBe(false);
    });

    test('test_verifyPayment_networkError_returnsFailureObject', async () => {
      // Arrange
      (api.get as jest.Mock).mockRejectedValueOnce(new Error('Network Error'));

      // Act
      const result = await verifyPayment('ref-net');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Network Error');
    });
  });

  // ── getPaymentMethods ──────────────────────────────────────────────
  describe('getPaymentMethods', () => {
    test('test_getPaymentMethods_validCall_callsGetAndReturnsMethods', async () => {
      // Arrange
      (api.get as jest.Mock).mockResolvedValueOnce({
        data: { success: true, methods: [{ id: 'pm-1', type: 'card' }] },
      });

      // Act
      const result = await getPaymentMethods();

      // Assert
      expect(api.get).toHaveBeenCalledWith('/payment-methods');
      expect(result.success).toBe(true);
      expect(result.methods).toHaveLength(1);
    });

    test('test_getPaymentMethods_apiError_throwsWithErrorMessage', async () => {
      // Arrange
      (api.get as jest.Mock).mockRejectedValueOnce({ message: 'Unauthorized' });

      // Act & Assert
      await expect(getPaymentMethods()).rejects.toThrow('Unauthorized');
    });
  });

  // ── addPaymentMethod ───────────────────────────────────────────────
  describe('addPaymentMethod', () => {
    const methodData = {
      type: 'card' as const,
      provider: 'visa',
      title: 'My Visa',
      identifier: '**** **** **** 1234',
      is_default: true,
    };

    test('test_addPaymentMethod_validData_callsPostAndReturnsCreatedMethod', async () => {
      // Arrange
      (api.post as jest.Mock).mockResolvedValueOnce({
        data: { success: true, method: { id: 'pm-new', ...methodData } },
      });

      // Act
      const result = await addPaymentMethod(methodData);

      // Assert
      expect(api.post).toHaveBeenCalledWith('/payment-methods', methodData);
      expect(result.success).toBe(true);
    });

    test('test_addPaymentMethod_apiError_throwsWithErrorMessage', async () => {
      // Arrange
      (api.post as jest.Mock).mockRejectedValueOnce({ message: 'Duplicate payment method' });

      // Act & Assert
      await expect(addPaymentMethod(methodData)).rejects.toThrow('Duplicate payment method');
    });
  });

  // ── deletePaymentMethod ────────────────────────────────────────────
  describe('deletePaymentMethod', () => {
    test('test_deletePaymentMethod_validId_callsDeleteToPaymentMethodEndpoint', async () => {
      // Arrange
      (api.delete as jest.Mock).mockResolvedValueOnce({ data: { success: true } });

      // Act
      const result = await deletePaymentMethod('pm-1');

      // Assert
      expect(api.delete).toHaveBeenCalledWith('/payment-methods/pm-1');
      expect(result.success).toBe(true);
    });

    test('test_deletePaymentMethod_nonExistentId_throwsWithErrorMessage', async () => {
      // Arrange
      (api.delete as jest.Mock).mockRejectedValueOnce({ message: 'Payment method not found' });

      // Act & Assert
      await expect(deletePaymentMethod('bad-pm')).rejects.toThrow('Payment method not found');
    });
  });

  // ── setDefaultPaymentMethod ────────────────────────────────────────
  describe('setDefaultPaymentMethod', () => {
    test('test_setDefaultPaymentMethod_validId_callsPutToDefaultEndpoint', async () => {
      // Arrange
      (api.put as jest.Mock).mockResolvedValueOnce({ data: { success: true } });

      // Act
      const result = await setDefaultPaymentMethod('pm-2');

      // Assert
      expect(api.put).toHaveBeenCalledWith('/payment-methods/pm-2/default');
      expect(result.success).toBe(true);
    });

    test('test_setDefaultPaymentMethod_apiError_throwsWithErrorMessage', async () => {
      // Arrange
      (api.put as jest.Mock).mockRejectedValueOnce({ message: 'Method not found' });

      // Act & Assert
      await expect(setDefaultPaymentMethod('bad-pm')).rejects.toThrow('Method not found');
    });
  });

  // ── getPayoutHistory ───────────────────────────────────────────────
  describe('getPayoutHistory', () => {
    test('test_getPayoutHistory_validStoreId_callsGetWithStoreIdAndReturnsHistory', async () => {
      // Arrange
      (api.get as jest.Mock).mockResolvedValueOnce({
        data: { success: true, payouts: [{ id: 'payout-1', amount: 500 }] },
      });

      // Act
      const result = await getPayoutHistory('store-1');

      // Assert
      expect(api.get).toHaveBeenCalledWith('/payouts/history/store-1');
      expect(result.success).toBe(true);
      expect(result.payouts).toHaveLength(1);
    });

    test('test_getPayoutHistory_apiError_throwsWithErrorMessage', async () => {
      // Arrange
      (api.get as jest.Mock).mockRejectedValueOnce({ message: 'Store not found' });

      // Act & Assert
      await expect(getPayoutHistory('bad-store')).rejects.toThrow('Store not found');
    });
  });

  // ── requestPayout ──────────────────────────────────────────────────
  describe('requestPayout', () => {
    test('test_requestPayout_validPayoutData_callsPostAndReturnsRequestedPayout', async () => {
      // Arrange
      const payoutData = { storeId: 'store-1', amount: 1000, accountNumber: '0241234567' };
      (api.post as jest.Mock).mockResolvedValueOnce({
        data: { success: true, payout: { id: 'payout-req-1' } },
      });

      // Act
      const result = await requestPayout(payoutData);

      // Assert
      expect(api.post).toHaveBeenCalledWith('/payouts/request', payoutData);
      expect(result.success).toBe(true);
    });

    test('test_requestPayout_insufficientBalance_throwsWithErrorMessage', async () => {
      // Arrange
      (api.post as jest.Mock).mockRejectedValueOnce({ message: 'Insufficient balance' });

      // Act & Assert
      await expect(requestPayout({ amount: 99999 })).rejects.toThrow('Insufficient balance');
    });
  });

  // ── initializeListingFee ───────────────────────────────────────────
  describe('initializeListingFee', () => {
    test('test_initializeListingFee_validPayload_callsPostAndReturnsInitData', async () => {
      // Arrange
      const payload = { storeId: 'store-1', email: 'seller@test.com', channel: 'card' };
      (api.post as jest.Mock).mockResolvedValueOnce({
        data: { success: true, authorizationUrl: 'https://pay.example.com/listing' },
      });

      // Act
      const result = await initializeListingFee(payload);

      // Assert
      expect(api.post).toHaveBeenCalledWith('/payments/listing-fee/initialize', payload);
      expect(result.success).toBe(true);
    });

    test('test_initializeListingFee_apiError_throwsWithErrorMessage', async () => {
      // Arrange
      (api.post as jest.Mock).mockRejectedValueOnce({ message: 'Store not eligible' });

      // Act & Assert
      await expect(initializeListingFee({ storeId: 'bad', email: 'x@test.com' })).rejects.toThrow('Store not eligible');
    });
  });

  // ── initializeBannerPayment ────────────────────────────────────────
  describe('initializeBannerPayment', () => {
    test('test_initializeBannerPayment_validPayload_callsPostAndReturnsInitData', async () => {
      // Arrange
      const payload = { campaignId: 'camp-1', email: 'advert@test.com' };
      (api.post as jest.Mock).mockResolvedValueOnce({
        data: { success: true, reference: 'banner-ref-1' },
      });

      // Act
      const result = await initializeBannerPayment(payload);

      // Assert
      expect(api.post).toHaveBeenCalledWith('/advertising/banners/pay-initialize', payload);
      expect(result.success).toBe(true);
    });

    test('test_initializeBannerPayment_apiError_throwsWithErrorMessage', async () => {
      // Arrange
      (api.post as jest.Mock).mockRejectedValueOnce({ message: 'Campaign not found' });

      // Act & Assert
      await expect(initializeBannerPayment({ campaignId: 'bad', email: 'x@test.com' })).rejects.toThrow('Campaign not found');
    });
  });

  // ── verifyBannerPayment ────────────────────────────────────────────
  describe('verifyBannerPayment', () => {
    test('test_verifyBannerPayment_validReference_callsGetAndReturnsVerificationData', async () => {
      // Arrange
      (api.get as jest.Mock).mockResolvedValueOnce({
        data: { success: true, status: 'active' },
      });

      // Act
      const result = await verifyBannerPayment('banner-ref-1');

      // Assert
      expect(api.get).toHaveBeenCalledWith('/advertising/banners/verify/banner-ref-1');
      expect(result.success).toBe(true);
    });

    test('test_verifyBannerPayment_apiError_throwsWithErrorMessage', async () => {
      // Arrange
      (api.get as jest.Mock).mockRejectedValueOnce({ message: 'Invalid banner reference' });

      // Act & Assert
      await expect(verifyBannerPayment('bad-ref')).rejects.toThrow('Invalid banner reference');
    });
  });
});
