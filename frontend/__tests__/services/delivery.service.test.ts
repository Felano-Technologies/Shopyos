/**
 * __tests__/services/delivery.service.test.ts
 *
 * Unit tests for the delivery service functions.
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
  getDeliveryQuote,
  createDelivery,
  getAvailableDeliveries,
  assignDriver,
  getMyDeliveries,
  getDeliveryDetails,
  updateDeliveryStatus,
  verifyDeliveryPin,
  getActiveDeliveries,
  getDriverStats,
  updateDriverLocation,
  getDriverProfile,
  updateDriverAvailability,
  submitDriverVerification,
} from '../../services/delivery';

describe('Delivery Service Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── getDeliveryQuote ───────────────────────────────────────────────
  describe('getDeliveryQuote', () => {
    test('test_getDeliveryQuote_withAllParams_callsGetWithCorrectQueryParams', async () => {
      // Arrange
      (api.get as jest.Mock).mockResolvedValueOnce({
        data: { success: true, quote: { fee: 15, estimatedTime: '30 mins' } },
      });

      // Act
      const result = await getDeliveryQuote('store-1', 5.6, -0.2, 'Greater Accra');

      // Assert
      expect(api.get).toHaveBeenCalledWith('/delivery/quote', {
        params: { storeId: 'store-1', buyerLat: 5.6, buyerLng: -0.2, deliveryState: 'Greater Accra' },
      });
      expect(result.quote.fee).toBe(15);
    });

    test('test_getDeliveryQuote_withStoreIdOnly_callsGetWithUndefinedOptionalParams', async () => {
      // Arrange
      (api.get as jest.Mock).mockResolvedValueOnce({ data: { success: true } });

      // Act
      await getDeliveryQuote('store-2');

      // Assert
      expect(api.get).toHaveBeenCalledWith('/delivery/quote', {
        params: { storeId: 'store-2', buyerLat: undefined, buyerLng: undefined, deliveryState: undefined },
      });
    });

    test('test_getDeliveryQuote_apiError_throwsWithErrorMessage', async () => {
      // Arrange
      (api.get as jest.Mock).mockRejectedValueOnce({ message: 'Store not found' });

      // Act & Assert
      await expect(getDeliveryQuote('bad-store')).rejects.toThrow('Store not found');
    });
  });

  // ── createDelivery ─────────────────────────────────────────────────
  describe('createDelivery', () => {
    const deliveryData = {
      orderId: 'ord-1',
      pickupAddress: '5 Ring Rd, Accra',
      deliveryAddress: '22 Oxford St, Accra',
      pickupLatitude: 5.6,
      pickupLongitude: -0.2,
      deliveryLatitude: 5.65,
      deliveryLongitude: -0.18,
    };

    test('test_createDelivery_validData_callsPostAndReturnsCreatedDelivery', async () => {
      // Arrange
      (api.post as jest.Mock).mockResolvedValueOnce({
        data: { success: true, delivery: { id: 'del-1' } },
      });

      // Act
      const result = await createDelivery(deliveryData);

      // Assert
      expect(api.post).toHaveBeenCalledWith('/deliveries/create', deliveryData);
      expect(result.success).toBe(true);
    });

    test('test_createDelivery_apiErrorWithResponseData_returnsErrorResponseData', async () => {
      // Arrange
      const apiError = {
        message: 'Order already has a delivery',
        response: { data: { success: false, error: 'Delivery already exists' } },
      };
      (api.post as jest.Mock).mockRejectedValueOnce(apiError);

      // Act
      const result = await createDelivery(deliveryData);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Delivery already exists');
    });

    test('test_createDelivery_networkErrorWithoutResponseData_throwsWithErrorMessage', async () => {
      // Arrange
      (api.post as jest.Mock).mockRejectedValueOnce(new Error('Network Error'));

      // Act & Assert
      await expect(createDelivery(deliveryData)).rejects.toThrow('Network Error');
    });
  });

  // ── getAvailableDeliveries ─────────────────────────────────────────
  describe('getAvailableDeliveries', () => {
    test('test_getAvailableDeliveries_validCall_callsGetAndReturnsAvailableList', async () => {
      // Arrange
      (api.get as jest.Mock).mockResolvedValueOnce({
        data: { success: true, deliveries: [{ id: 'del-2' }] },
      });

      // Act
      const result = await getAvailableDeliveries();

      // Assert
      expect(api.get).toHaveBeenCalledWith('/deliveries/available');
      expect(result.deliveries).toHaveLength(1);
    });

    test('test_getAvailableDeliveries_apiError_throwsWithErrorMessage', async () => {
      // Arrange
      (api.get as jest.Mock).mockRejectedValueOnce({ message: 'Unauthorized' });

      // Act & Assert
      await expect(getAvailableDeliveries()).rejects.toThrow('Unauthorized');
    });
  });

  // ── assignDriver ───────────────────────────────────────────────────
  describe('assignDriver', () => {
    test('test_assignDriver_validDeliveryId_callsPutToAssignEndpointAndReturnsSuccess', async () => {
      // Arrange
      (api.put as jest.Mock).mockResolvedValueOnce({ data: { success: true, message: 'Driver assigned' } });

      // Act
      const result = await assignDriver('del-1');

      // Assert
      expect(api.put).toHaveBeenCalledWith('/deliveries/del-1/assign');
      expect(result.success).toBe(true);
    });

    test('test_assignDriver_deliveryAlreadyAssigned_throwsWithErrorMessage', async () => {
      // Arrange
      (api.put as jest.Mock).mockRejectedValueOnce({ message: 'Delivery already assigned' });

      // Act & Assert
      await expect(assignDriver('del-taken')).rejects.toThrow('Delivery already assigned');
    });
  });

  // ── getMyDeliveries ────────────────────────────────────────────────
  describe('getMyDeliveries', () => {
    test('test_getMyDeliveries_noStatus_callsGetWithUndefinedStatusParam', async () => {
      // Arrange
      (api.get as jest.Mock).mockResolvedValueOnce({
        data: { success: true, deliveries: [{ id: 'del-3' }] },
      });

      // Act
      const result = await getMyDeliveries();

      // Assert
      expect(api.get).toHaveBeenCalledWith('/deliveries/my-deliveries', { params: { status: undefined } });
      expect(result.deliveries).toHaveLength(1);
    });

    test('test_getMyDeliveries_withStatusFilter_passesStatusParamToApiCall', async () => {
      // Arrange
      (api.get as jest.Mock).mockResolvedValueOnce({ data: { success: true, deliveries: [] } });

      // Act
      await getMyDeliveries('delivered');

      // Assert
      expect(api.get).toHaveBeenCalledWith('/deliveries/my-deliveries', { params: { status: 'delivered' } });
    });

    test('test_getMyDeliveries_apiError_throwsWithErrorMessage', async () => {
      // Arrange
      (api.get as jest.Mock).mockRejectedValueOnce({ message: 'Session expired' });

      // Act & Assert
      await expect(getMyDeliveries()).rejects.toThrow('Session expired');
    });
  });

  // ── getDeliveryDetails ─────────────────────────────────────────────
  describe('getDeliveryDetails', () => {
    test('test_getDeliveryDetails_validDeliveryId_callsGetWithIdAndReturnsDetails', async () => {
      // Arrange
      (api.get as jest.Mock).mockResolvedValueOnce({
        data: { success: true, delivery: { id: 'del-4', status: 'in_transit' } },
      });

      // Act
      const result = await getDeliveryDetails('del-4');

      // Assert
      expect(api.get).toHaveBeenCalledWith('/deliveries/del-4');
      expect(result.delivery.id).toBe('del-4');
    });

    test('test_getDeliveryDetails_invalidId_throwsWithErrorMessage', async () => {
      // Arrange
      (api.get as jest.Mock).mockRejectedValueOnce({ message: 'Delivery not found' });

      // Act & Assert
      await expect(getDeliveryDetails('bad-id')).rejects.toThrow('Delivery not found');
    });
  });

  // ── updateDeliveryStatus ───────────────────────────────────────────
  describe('updateDeliveryStatus', () => {
    test('test_updateDeliveryStatus_validParams_callsPutToStatusEndpointWithNewStatus', async () => {
      // Arrange
      (api.put as jest.Mock).mockResolvedValueOnce({ data: { success: true } });

      // Act
      const result = await updateDeliveryStatus('del-5', 'delivered');

      // Assert
      expect(api.put).toHaveBeenCalledWith('/deliveries/del-5/status', { status: 'delivered' });
      expect(result.success).toBe(true);
    });

    test('test_updateDeliveryStatus_apiError_throwsWithErrorMessage', async () => {
      // Arrange
      (api.put as jest.Mock).mockRejectedValueOnce({ message: 'Invalid status transition' });

      // Act & Assert
      await expect(updateDeliveryStatus('del-5', 'cancelled')).rejects.toThrow('Invalid status transition');
    });
  });

  // ── verifyDeliveryPin ──────────────────────────────────────────────
  describe('verifyDeliveryPin', () => {
    test('test_verifyDeliveryPin_correctPin_callsPostWithPinAndReturnsSuccess', async () => {
      // Arrange
      (api.post as jest.Mock).mockResolvedValueOnce({ data: { success: true, verified: true } });

      // Act
      const result = await verifyDeliveryPin('del-6', '1234');

      // Assert
      expect(api.post).toHaveBeenCalledWith('/deliveries/del-6/verify-pin', { pin: '1234' });
      expect(result.success).toBe(true);
    });

    test('test_verifyDeliveryPin_wrongPin_throwsWithApiErrorMessage', async () => {
      // Arrange
      const apiError = {
        message: 'Incorrect PIN',
        response: { data: { error: 'Incorrect PIN entered' } },
      };
      (api.post as jest.Mock).mockRejectedValueOnce(apiError);

      // Act & Assert
      await expect(verifyDeliveryPin('del-6', '0000')).rejects.toThrow('Incorrect PIN entered');
    });

    test('test_verifyDeliveryPin_networkError_throwsWithNetworkErrorMessage', async () => {
      // Arrange
      (api.post as jest.Mock).mockRejectedValueOnce(new Error('Network Error'));

      // Act & Assert
      await expect(verifyDeliveryPin('del-6', '5678')).rejects.toThrow('Network Error');
    });
  });

  // ── getActiveDeliveries ────────────────────────────────────────────
  describe('getActiveDeliveries', () => {
    test('test_getActiveDeliveries_validCall_callsGetAndReturnsActiveDeliveries', async () => {
      // Arrange
      (api.get as jest.Mock).mockResolvedValueOnce({
        data: { success: true, deliveries: [{ id: 'del-7', status: 'in_transit' }] },
      });

      // Act
      const result = await getActiveDeliveries();

      // Assert
      expect(api.get).toHaveBeenCalledWith('/deliveries/active');
      expect(result.deliveries).toHaveLength(1);
    });

    test('test_getActiveDeliveries_apiError_throwsWithErrorMessage', async () => {
      // Arrange
      (api.get as jest.Mock).mockRejectedValueOnce({ message: 'Unauthorized' });

      // Act & Assert
      await expect(getActiveDeliveries()).rejects.toThrow('Unauthorized');
    });
  });

  // ── getDriverStats ─────────────────────────────────────────────────
  describe('getDriverStats', () => {
    test('test_getDriverStats_defaultTimeframe_callsGetWithTodayTimeframeParam', async () => {
      // Arrange
      (api.get as jest.Mock).mockResolvedValueOnce({
        data: { success: true, stats: { deliveries: 5, earnings: 120 } },
      });

      // Act
      const result = await getDriverStats();

      // Assert
      expect(api.get).toHaveBeenCalledWith('/deliveries/driver/stats', { params: { timeframe: 'today' } });
      expect(result.stats.deliveries).toBe(5);
    });

    test('test_getDriverStats_weekTimeframe_callsGetWithWeekTimeframeParam', async () => {
      // Arrange
      (api.get as jest.Mock).mockResolvedValueOnce({ data: { success: true, stats: {} } });

      // Act
      await getDriverStats('week');

      // Assert
      expect(api.get).toHaveBeenCalledWith('/deliveries/driver/stats', { params: { timeframe: 'week' } });
    });

    test('test_getDriverStats_monthTimeframe_callsGetWithMonthTimeframeParam', async () => {
      // Arrange
      (api.get as jest.Mock).mockResolvedValueOnce({ data: { success: true, stats: {} } });

      // Act
      await getDriverStats('month');

      // Assert
      expect(api.get).toHaveBeenCalledWith('/deliveries/driver/stats', { params: { timeframe: 'month' } });
    });

    test('test_getDriverStats_apiError_throwsWithErrorMessage', async () => {
      // Arrange
      (api.get as jest.Mock).mockRejectedValueOnce({ message: 'Session expired' });

      // Act & Assert
      await expect(getDriverStats()).rejects.toThrow('Session expired');
    });
  });

  // ── updateDriverLocation ───────────────────────────────────────────
  describe('updateDriverLocation', () => {
    test('test_updateDriverLocation_validParams_callsPutWithLatLngAndReturnsSuccess', async () => {
      // Arrange
      (api.put as jest.Mock).mockResolvedValueOnce({ data: { success: true } });

      // Act
      const result = await updateDriverLocation('del-8', 5.65, -0.18);

      // Assert
      expect(api.put).toHaveBeenCalledWith('/deliveries/del-8/location', {
        latitude: 5.65,
        longitude: -0.18,
      });
      expect(result.success).toBe(true);
    });

    test('test_updateDriverLocation_apiError_throwsWithErrorMessage', async () => {
      // Arrange
      (api.put as jest.Mock).mockRejectedValueOnce({ message: 'Delivery not found' });

      // Act & Assert
      await expect(updateDriverLocation('bad-del', 0, 0)).rejects.toThrow('Delivery not found');
    });
  });

  // ── getDriverProfile ───────────────────────────────────────────────
  describe('getDriverProfile', () => {
    test('test_getDriverProfile_validCall_callsGetAndReturnsDriverProfile', async () => {
      // Arrange
      (api.get as jest.Mock).mockResolvedValueOnce({
        data: { success: true, driver: { id: 'driver-1', name: 'Kwame', isAvailable: true } },
      });

      // Act
      const result = await getDriverProfile();

      // Assert
      expect(api.get).toHaveBeenCalledWith('/deliveries/driver/profile');
      expect(result.driver.name).toBe('Kwame');
    });

    test('test_getDriverProfile_apiError_throwsWithErrorMessage', async () => {
      // Arrange
      (api.get as jest.Mock).mockRejectedValueOnce({ message: 'Driver profile not found' });

      // Act & Assert
      await expect(getDriverProfile()).rejects.toThrow('Driver profile not found');
    });
  });

  // ── updateDriverAvailability ───────────────────────────────────────
  describe('updateDriverAvailability', () => {
    test('test_updateDriverAvailability_setAvailableTrue_callsPutWithTrueAndReturnsSuccess', async () => {
      // Arrange
      (api.put as jest.Mock).mockResolvedValueOnce({ data: { success: true, isAvailable: true } });

      // Act
      const result = await updateDriverAvailability(true);

      // Assert
      expect(api.put).toHaveBeenCalledWith('/deliveries/driver/availability', { isAvailable: true });
      expect(result.success).toBe(true);
    });

    test('test_updateDriverAvailability_setAvailableFalse_callsPutWithFalse', async () => {
      // Arrange
      (api.put as jest.Mock).mockResolvedValueOnce({ data: { success: true, isAvailable: false } });

      // Act
      await updateDriverAvailability(false);

      // Assert
      expect(api.put).toHaveBeenCalledWith('/deliveries/driver/availability', { isAvailable: false });
    });

    test('test_updateDriverAvailability_apiError_throwsWithErrorMessage', async () => {
      // Arrange
      (api.put as jest.Mock).mockRejectedValueOnce({ message: 'Unauthorized' });

      // Act & Assert
      await expect(updateDriverAvailability(true)).rejects.toThrow('Unauthorized');
    });
  });

  // ── submitDriverVerification ───────────────────────────────────────
  describe('submitDriverVerification', () => {
    test('test_submitDriverVerification_validFormData_callsPostWithMultipartHeaderAndReturnsSuccess', async () => {
      // Arrange
      const formData = new FormData();
      formData.append('license', 'GH-12345');
      (api.post as jest.Mock).mockResolvedValueOnce({
        data: { success: true, message: 'Verification submitted' },
      });

      // Act
      const result = await submitDriverVerification(formData);

      // Assert
      expect(api.post).toHaveBeenCalledWith('/deliveries/verify', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      expect(result.success).toBe(true);
    });

    test('test_submitDriverVerification_apiError_throwsWithErrorMessage', async () => {
      // Arrange
      const formData = new FormData();
      (api.post as jest.Mock).mockRejectedValueOnce({ message: 'Verification already submitted' });

      // Act & Assert
      await expect(submitDriverVerification(formData)).rejects.toThrow('Verification already submitted');
    });
  });
});
