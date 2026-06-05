/**
 * __tests__/services/orders.service.test.ts
 *
 * Unit tests for the orders/cart/favorites service layer.
 * Conforms to guidelines/test.md.
 */

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('@/lib/query/client', () => ({
  queryClient: { clear: jest.fn(), invalidateQueries: jest.fn(), removeQueries: jest.fn() },
}));
jest.mock('../../components/InAppToastHost', () => ({ CustomInAppToast: { show: jest.fn() } }));
jest.mock('../../services/storage', () => ({
  storage: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
  secureStorage: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
}));

const mockApiGet = jest.fn();
const mockApiPost = jest.fn();
const mockApiPut = jest.fn();
const mockApiDelete = jest.fn();

jest.mock('../../services/client', () => ({
  api: {
    get: mockApiGet,
    post: mockApiPost,
    put: mockApiPut,
    delete: mockApiDelete,
    defaults: { headers: { common: {} } },
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  },
  extractErrorMessage: (err: any) => err?.message || 'Error',
  API_URL: 'http://localhost:5000/api/v1/',
  baseURL: 'http://localhost:5000',
  secureStorage: { getItem: jest.fn() },
  storage: { getItem: jest.fn() },
  CustomInAppToast: { show: jest.fn() },
}));

import {
  addToCart,
  clearBackendCart,
  createOrder,
  getMyOrders,
  getStoreOrders,
  getOrderDetails,
  updateOrderStatus,
  cancelOrder,
  addToFavorites,
  removeFromFavorites,
  getFavorites,
  checkIsFavorite,
} from '../../services/orders';

describe('Orders Service Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Cart ───────────────────────────────────────────────────────────
  describe('addToCart', () => {
    test('test_addToCart_validProductIdAndQuantity_callsPostToCartAdd', async () => {
      // Arrange
      mockApiPost.mockResolvedValueOnce({ data: { success: true } });

      // Act
      await addToCart('prod-1', 2);

      // Assert
      expect(mockApiPost).toHaveBeenCalledWith('/cart/add', { productId: 'prod-1', quantity: 2 });
    });

    test('test_addToCart_apiError_throwsException', async () => {
      // Arrange
      mockApiPost.mockRejectedValueOnce({ message: 'Product out of stock' });

      // Act & Assert
      await expect(addToCart('prod-out', 1)).rejects.toThrow('Product out of stock');
    });
  });

  describe('clearBackendCart', () => {
    test('test_clearBackendCart_validCall_callsDeleteToCartClear', async () => {
      // Arrange
      mockApiDelete.mockResolvedValueOnce({ data: { success: true } });

      // Act
      await clearBackendCart();

      // Assert
      expect(mockApiDelete).toHaveBeenCalledWith('/cart/clear');
    });
  });

  // ── Orders ──────────────────────────────────────────────────────────
  describe('createOrder', () => {
    const orderData = {
      deliveryAddress: '123 Main St',
      deliveryCity: 'Accra',
      deliveryState: 'Greater Accra',
      deliveryCountry: 'Ghana',
      deliveryPhone: '+233201234567',
      paymentMethod: 'card',
    };

    test('test_createOrder_validOrderData_callsPostToOrdersCreateAndReturnsSuccess', async () => {
      // Arrange
      mockApiPost.mockResolvedValueOnce({ data: { success: true, orderId: 'ord-1' } });

      // Act
      const result = await createOrder(orderData);

      // Assert
      expect(mockApiPost).toHaveBeenCalledWith('/orders/create', orderData);
      expect(result.success).toBe(true);
    });

    test('test_createOrder_apiError_throwsException', async () => {
      // Arrange
      mockApiPost.mockRejectedValueOnce({ message: 'Cart is empty' });

      // Act & Assert
      await expect(createOrder(orderData)).rejects.toThrow('Cart is empty');
    });
  });

  describe('getMyOrders', () => {
    test('test_getMyOrders_validCall_returnsNormalisedOrdersPayload', async () => {
      // Arrange
      mockApiGet.mockResolvedValueOnce({
        data: { success: true, data: [{ id: 'ord-1', status: 'pending' }] },
      });

      // Act
      const result = await getMyOrders();

      // Assert
      expect(mockApiGet).toHaveBeenCalledWith('/orders/my-orders', { params: {} });
      expect(result.orders).toHaveLength(1);
    });

    test('test_getMyOrders_withStatusFilter_passesStatusParamToApiCall', async () => {
      // Arrange
      mockApiGet.mockResolvedValueOnce({ data: { success: true, data: [] } });

      // Act
      await getMyOrders({ status: 'delivered' });

      // Assert
      expect(mockApiGet).toHaveBeenCalledWith('/orders/my-orders', { params: { status: 'delivered' } });
    });
  });

  describe('getOrderDetails', () => {
    test('test_getOrderDetails_validOrderId_fetchesSingleOrderData', async () => {
      // Arrange
      mockApiGet.mockResolvedValueOnce({ data: { success: true, order: { id: 'ord-2' } } });

      // Act
      const result = await getOrderDetails('ord-2');

      // Assert
      expect(mockApiGet).toHaveBeenCalledWith('/orders/ord-2');
      expect(result.order.id).toBe('ord-2');
    });
  });

  describe('updateOrderStatus', () => {
    test('test_updateOrderStatus_validParams_callsPutToOrderStatusEndpoint', async () => {
      // Arrange
      mockApiPut.mockResolvedValueOnce({ data: { success: true } });

      // Act
      await updateOrderStatus('ord-3', 'shipped');

      // Assert
      expect(mockApiPut).toHaveBeenCalledWith('/orders/ord-3/status', { status: 'shipped' });
    });
  });

  describe('cancelOrder', () => {
    test('test_cancelOrder_withReason_callsPutToCancelEndpointWithReason', async () => {
      // Arrange
      mockApiPut.mockResolvedValueOnce({ data: { success: true } });

      // Act
      await cancelOrder('ord-4', 'Changed my mind');

      // Assert
      expect(mockApiPut).toHaveBeenCalledWith('/orders/ord-4/cancel', { reason: 'Changed my mind' });
    });

    test('test_cancelOrder_withoutReason_callsPutToCancelEndpointWithoutReason', async () => {
      // Arrange
      mockApiPut.mockResolvedValueOnce({ data: { success: true } });

      // Act
      await cancelOrder('ord-5');

      // Assert
      expect(mockApiPut).toHaveBeenCalledWith('/orders/ord-5/cancel', { reason: undefined });
    });
  });

  describe('getStoreOrders', () => {
    test('test_getStoreOrders_validStoreId_returnsNormalisedOrdersListForStore', async () => {
      // Arrange
      mockApiGet.mockResolvedValueOnce({ data: { success: true, data: [{ id: 'ord-6' }] } });

      // Act
      const result = await getStoreOrders('store-1');

      // Assert
      expect(mockApiGet).toHaveBeenCalledWith('/orders/store/store-1', { params: {} });
      expect(result.orders).toHaveLength(1);
    });
  });

  // ── Favorites ──────────────────────────────────────────────────────
  describe('addToFavorites', () => {
    test('test_addToFavorites_validProductId_callsPostToFavoritesEndpoint', async () => {
      // Arrange
      mockApiPost.mockResolvedValueOnce({ data: { success: true } });

      // Act
      await addToFavorites('prod-fav');

      // Assert
      expect(mockApiPost).toHaveBeenCalledWith('/favorites', { productId: 'prod-fav' });
    });
  });

  describe('removeFromFavorites', () => {
    test('test_removeFromFavorites_validProductId_callsDeleteToFavoritesEndpoint', async () => {
      // Arrange
      mockApiDelete.mockResolvedValueOnce({ data: { success: true } });

      // Act
      await removeFromFavorites('prod-fav');

      // Assert
      expect(mockApiDelete).toHaveBeenCalledWith('/favorites/prod-fav');
    });
  });

  describe('getFavorites', () => {
    test('test_getFavorites_validCall_returnsFavoritesPayload', async () => {
      // Arrange
      mockApiGet.mockResolvedValueOnce({ data: { success: true, favorites: [] } });

      // Act
      const result = await getFavorites();

      // Assert
      expect(result.success).toBe(true);
    });
  });

  describe('checkIsFavorite', () => {
    test('test_checkIsFavorite_itemIsFavorited_returnsTrue', async () => {
      // Arrange
      mockApiGet.mockResolvedValueOnce({ data: { isFavorite: true } });

      // Act
      const result = await checkIsFavorite('prod-1');

      // Assert
      expect(result.isFavorite).toBe(true);
    });

    test('test_checkIsFavorite_apiThrows_returnsFalse', async () => {
      // Arrange
      mockApiGet.mockRejectedValueOnce(new Error('Network Error'));

      // Act
      const result = await checkIsFavorite('bad-prod');

      // Assert
      expect(result.isFavorite).toBe(false);
    });
  });
});
