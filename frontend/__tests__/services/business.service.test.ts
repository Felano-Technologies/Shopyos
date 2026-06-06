/**
 * __tests__/services/business.service.test.ts
 *
 * Unit tests for the business service layer.
 * All API calls are mocked.
 * Conforms to guidelines/test.md.
 */

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('@/lib/query/client', () => ({
  queryClient: {
    clear: jest.fn(),
    invalidateQueries: jest.fn(),
    removeQueries: jest.fn(),
  },
}));
jest.mock('../../components/InAppToastHost', () => ({ CustomInAppToast: { show: jest.fn() } }));
jest.mock('../../services/storage', () => ({
  storage: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
  secureStorage: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
}));

jest.mock('../../services/client', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    defaults: { headers: { common: {} } },
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  },
  extractErrorMessage: (err: any) => err?.message || 'Error',
  API_URL: 'http://localhost:5000/api/v1/',
  baseURL: 'http://localhost:5000',
  secureStorage: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
  storage: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
  CustomInAppToast: { show: jest.fn() },
}));

import { api, secureStorage, storage } from '../../services/client';
import {
  uploadStoreLogo,
  businessRegister,
  getMyBusinesses,
  switchBusiness,
  updateBusiness,
  verifyBusinessDetails,
  loginBusiness,
  getBusinessById,
  getAllStores,
  searchStores,
  getBusinessDashboard,
  getBusinessAnalytics,
  getBusinessReviews,
  replyToReview,
  followStore,
  unfollowStore,
  getDeliverySettings,
  updateDeliverySettings,
} from '../../services/business';

describe('Business Service Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── uploadStoreLogo ───────────────────────────────────────────────
  describe('uploadStoreLogo', () => {
    test('test_uploadStoreLogo_validUri_postsFormDataAndReturnsData', async () => {
      // Arrange
      const mockData = { success: true, logoUrl: 'https://cdn.example.com/logo.jpg' };
      (api.post as jest.Mock).mockResolvedValueOnce({ data: mockData });

      // Act
      const result = await uploadStoreLogo('file:///tmp/logo.jpg');

      // Assert
      expect(api.post).toHaveBeenCalledWith(
        '/upload/store-logo',
        expect.any(Object),
        expect.objectContaining({ headers: { 'Content-Type': 'multipart/form-data' } })
      );
      expect(result).toEqual(mockData);
    });

    test('test_uploadStoreLogo_apiResponseError_throwsServerErrorMessage', async () => {
      // Arrange
      (api.post as jest.Mock).mockRejectedValueOnce({
        response: { data: { error: 'File too large' }, status: 413 },
      });

      // Act & Assert
      await expect(uploadStoreLogo('file:///tmp/big.jpg')).rejects.toThrow('File too large');
    });

    test('test_uploadStoreLogo_networkError_throwsNetworkErrorMessage', async () => {
      // Arrange
      (api.post as jest.Mock).mockRejectedValueOnce({ message: 'Network error during logo upload' });

      // Act & Assert
      await expect(uploadStoreLogo('file:///tmp/logo.png')).rejects.toThrow('Network error during logo upload');
    });
  });

  // ── businessRegister ──────────────────────────────────────────────
  describe('businessRegister', () => {
    test('test_businessRegister_validData_storesTokenAndBusinessIdAndReturnsData', async () => {
      // Arrange
      const mockData = { success: true, token: 'biz-token', business: { _id: 'biz-1', name: 'My Shop' } };
      (api.post as jest.Mock).mockResolvedValueOnce({ data: mockData });

      // Act
      const result = await businessRegister({ name: 'My Shop', email: 'shop@test.com' });

      // Assert
      expect(api.post).toHaveBeenCalledWith(
        '/business/create',
        expect.any(Object),
        expect.objectContaining({ headers: { 'Content-Type': 'multipart/form-data' } })
      );
      expect(secureStorage.setItem).toHaveBeenCalledWith('businessToken', 'biz-token');
      expect(storage.setItem).toHaveBeenCalledWith('currentBusinessId', 'biz-1');
      expect(result).toEqual(mockData);
    });

    test('test_businessRegister_responseWithoutToken_doesNotStoreToken', async () => {
      // Arrange
      const mockData = { success: true, business: { _id: 'biz-2' } };
      (api.post as jest.Mock).mockResolvedValueOnce({ data: mockData });

      // Act
      await businessRegister({ name: 'Shop B' });

      // Assert
      expect(secureStorage.setItem).not.toHaveBeenCalled();
    });

    test('test_businessRegister_fileUriField_appendsFileToFormData', async () => {
      // Arrange
      (api.post as jest.Mock).mockResolvedValueOnce({ data: { success: true } });

      // Act
      await businessRegister({ name: 'Shop', logo: 'file:///tmp/logo.jpg' });

      // Assert
      expect(api.post).toHaveBeenCalledWith(
        '/business/create',
        expect.any(Object),
        expect.objectContaining({ headers: { 'Content-Type': 'multipart/form-data' } })
      );
    });

    test('test_businessRegister_apiResponseError_throwsServerErrorMessage', async () => {
      // Arrange
      (api.post as jest.Mock).mockRejectedValueOnce({
        response: { data: { error: 'Business already exists' }, status: 409 },
      });

      // Act & Assert
      await expect(businessRegister({ name: 'Dup Shop' })).rejects.toThrow('Business already exists');
    });

    test('test_businessRegister_networkError_throwsNetworkErrorMessage', async () => {
      // Arrange
      (api.post as jest.Mock).mockRejectedValueOnce({ message: 'Network error during business creation' });

      // Act & Assert
      await expect(businessRegister({ name: 'Shop' })).rejects.toThrow('Network error during business creation');
    });
  });

  // ── getMyBusinesses ───────────────────────────────────────────────
  describe('getMyBusinesses', () => {
    test('test_getMyBusinesses_validCall_returnsNormalisedBusinessesArray', async () => {
      // Arrange
      (api.get as jest.Mock).mockResolvedValueOnce({
        data: { success: true, data: [{ _id: 'b1', name: 'Store One' }] },
      });

      // Act
      const result = await getMyBusinesses();

      // Assert
      expect(api.get).toHaveBeenCalledWith('/business/my-businesses', { params: {} });
      expect(result.businesses).toHaveLength(1);
      expect(result.businesses[0].name).toBe('Store One');
    });

    test('test_getMyBusinesses_withPaginationParams_passesParamsToApiCall', async () => {
      // Arrange
      (api.get as jest.Mock).mockResolvedValueOnce({ data: { success: true, businesses: [] } });

      // Act
      await getMyBusinesses({ limit: 5, offset: 10 });

      // Assert
      expect(api.get).toHaveBeenCalledWith('/business/my-businesses', { params: { limit: 5, offset: 10 } });
    });

    test('test_getMyBusinesses_businessesKeyInResponse_normalisesCorrectly', async () => {
      // Arrange
      (api.get as jest.Mock).mockResolvedValueOnce({
        data: { success: true, businesses: [{ _id: 'b2', name: 'Store Two' }] },
      });

      // Act
      const result = await getMyBusinesses();

      // Assert
      expect(result.businesses).toHaveLength(1);
    });

    test('test_getMyBusinesses_apiError_throwsException', async () => {
      // Arrange
      (api.get as jest.Mock).mockRejectedValueOnce({ message: 'Unauthorized' });

      // Act & Assert
      await expect(getMyBusinesses()).rejects.toThrow('Unauthorized');
    });
  });

  // ── switchBusiness ────────────────────────────────────────────────
  describe('switchBusiness', () => {
    test('test_switchBusiness_validId_storesTokenAndBusinessIdAndReturnsData', async () => {
      // Arrange
      const mockData = { success: true, token: 'new-biz-token' };
      (api.post as jest.Mock).mockResolvedValueOnce({ data: mockData });

      // Act
      const result = await switchBusiness('biz-99');

      // Assert
      expect(api.post).toHaveBeenCalledWith('/business/switch', { businessId: 'biz-99' });
      expect(secureStorage.setItem).toHaveBeenCalledWith('businessToken', 'new-biz-token');
      expect(storage.setItem).toHaveBeenCalledWith('currentBusinessId', 'biz-99');
      expect(result).toEqual(mockData);
    });

    test('test_switchBusiness_noTokenInResponse_onlyStoresBusinessId', async () => {
      // Arrange
      (api.post as jest.Mock).mockResolvedValueOnce({ data: { success: true } });

      // Act
      await switchBusiness('biz-100');

      // Assert
      expect(secureStorage.setItem).not.toHaveBeenCalled();
      expect(storage.setItem).toHaveBeenCalledWith('currentBusinessId', 'biz-100');
    });

    test('test_switchBusiness_apiResponseError_throwsServerErrorMessage', async () => {
      // Arrange
      (api.post as jest.Mock).mockRejectedValueOnce({
        response: { data: { error: 'Business not found' }, status: 404 },
      });

      // Act & Assert
      await expect(switchBusiness('ghost-biz')).rejects.toThrow('Business not found');
    });
  });

  // ── updateBusiness ────────────────────────────────────────────────
  describe('updateBusiness', () => {
    test('test_updateBusiness_plainTextData_callsPutEndpointWithData', async () => {
      // Arrange
      (api.put as jest.Mock).mockResolvedValueOnce({ data: { success: true } });

      // Act
      const result = await updateBusiness('biz-1', { name: 'Updated Shop', description: 'Great store' });

      // Assert
      expect(api.put).toHaveBeenCalledWith(
        '/business/update/biz-1',
        expect.any(Object),
        expect.any(Object)
      );
      expect(result).toEqual({ success: true });
    });

    test('test_updateBusiness_fileUriValue_usesMultipartFormDataHeader', async () => {
      // Arrange
      (api.put as jest.Mock).mockResolvedValueOnce({ data: { success: true } });

      // Act
      await updateBusiness('biz-1', { logo: 'file:///tmp/new-logo.png' });

      // Assert
      expect(api.put).toHaveBeenCalledWith(
        '/business/update/biz-1',
        expect.any(Object),
        expect.objectContaining({ headers: { 'Content-Type': 'multipart/form-data' } })
      );
    });

    test('test_updateBusiness_apiResponseError_throwsServerErrorMessage', async () => {
      // Arrange
      (api.put as jest.Mock).mockRejectedValueOnce({
        response: { data: { error: 'Not authorized' }, status: 403 },
      });

      // Act & Assert
      await expect(updateBusiness('biz-x', { name: 'X' })).rejects.toThrow('Not authorized');
    });

    test('test_updateBusiness_networkError_throwsNetworkErrorMessage', async () => {
      // Arrange
      (api.put as jest.Mock).mockRejectedValueOnce({ message: 'Network error updating business' });

      // Act & Assert
      await expect(updateBusiness('biz-x', {})).rejects.toThrow('Network error updating business');
    });
  });

  // ── verifyBusinessDetails ─────────────────────────────────────────
  describe('verifyBusinessDetails', () => {
    test('test_verifyBusinessDetails_validDetails_callsUpdateBusinessWithPendingStatus', async () => {
      // Arrange
      (api.put as jest.Mock).mockResolvedValueOnce({ data: { success: true } });

      // Act
      await verifyBusinessDetails('biz-1', { idNumber: 'GH-123' });

      // Assert
      expect(api.put).toHaveBeenCalledWith(
        '/business/update/biz-1',
        expect.any(Object),
        expect.any(Object)
      );
    });

    test('test_verifyBusinessDetails_apiError_throwsException', async () => {
      // Arrange
      (api.put as jest.Mock).mockRejectedValueOnce({
        response: { data: { error: 'Invalid details' }, status: 400 },
      });

      // Act & Assert
      await expect(verifyBusinessDetails('biz-1', { idNumber: 'bad' })).rejects.toThrow('Invalid details');
    });
  });

  // ── loginBusiness ─────────────────────────────────────────────────
  describe('loginBusiness', () => {
    test('test_loginBusiness_validCredentials_storesAllTokensAndRoleAndReturnsData', async () => {
      // Arrange
      const mockData = {
        success: true,
        token: 'biz-login-token',
        business: { _id: 'biz-42', name: 'My Biz' },
      };
      (api.post as jest.Mock).mockResolvedValueOnce({ data: mockData });

      // Act
      const result = await loginBusiness('biz@test.com', 'pass123', 5.6, -0.2);

      // Assert
      expect(api.post).toHaveBeenCalledWith('/business/login', {
        email: 'biz@test.com',
        password: 'pass123',
        latitude: 5.6,
        longitude: -0.2,
      });
      expect(secureStorage.setItem).toHaveBeenCalledWith('businessToken', 'biz-login-token');
      expect(secureStorage.setItem).toHaveBeenCalledWith('userToken', 'biz-login-token');
      expect(storage.setItem).toHaveBeenCalledWith('currentBusinessId', 'biz-42');
      expect(storage.setItem).toHaveBeenCalledWith('userRole', 'seller');
      expect(result).toEqual(mockData);
    });

    test('test_loginBusiness_responseWithoutToken_doesNotStoreToken', async () => {
      // Arrange
      (api.post as jest.Mock).mockResolvedValueOnce({ data: { success: true } });

      // Act
      await loginBusiness('biz@test.com', 'pass123', 0, 0);

      // Assert
      expect(secureStorage.setItem).not.toHaveBeenCalled();
    });

    test('test_loginBusiness_invalidCredentials_throwsServerErrorMessage', async () => {
      // Arrange
      (api.post as jest.Mock).mockRejectedValueOnce({
        response: { data: { error: 'Business login failed' }, status: 401 },
      });

      // Act & Assert
      await expect(loginBusiness('bad@test.com', 'wrong', 0, 0)).rejects.toThrow('Business login failed');
    });
  });

  // ── getBusinessById ───────────────────────────────────────────────
  describe('getBusinessById', () => {
    test('test_getBusinessById_existingId_returnsBusinessData', async () => {
      // Arrange
      const mockData = { success: true, business: { _id: 'biz-5', name: 'Shop Five' } };
      (api.get as jest.Mock).mockResolvedValueOnce({ data: mockData });

      // Act
      const result = await getBusinessById('biz-5');

      // Assert
      expect(api.get).toHaveBeenCalledWith('/business/biz-5');
      expect(result).toEqual(mockData);
    });

    test('test_getBusinessById_ghostId_throwsException', async () => {
      // Arrange
      (api.get as jest.Mock).mockRejectedValueOnce({ message: 'Business not found' });

      // Act & Assert
      await expect(getBusinessById('ghost-id')).rejects.toThrow('Business not found');
    });
  });

  // ── getAllStores ──────────────────────────────────────────────────
  describe('getAllStores', () => {
    test('test_getAllStores_noParams_returnsNormalisedBusinessesArray', async () => {
      // Arrange
      (api.get as jest.Mock).mockResolvedValueOnce({
        data: { success: true, data: [{ _id: 's1', name: 'Store A' }] },
      });

      // Act
      const result = await getAllStores();

      // Assert
      expect(api.get).toHaveBeenCalledWith('/business/all', { params: {} });
      expect(result.businesses).toHaveLength(1);
    });

    test('test_getAllStores_withSearchParam_passesParamToApiCall', async () => {
      // Arrange
      (api.get as jest.Mock).mockResolvedValueOnce({ data: { success: true, businesses: [] } });

      // Act
      await getAllStores({ search: 'shoes', limit: 10 });

      // Assert
      expect(api.get).toHaveBeenCalledWith('/business/all', {
        params: expect.objectContaining({ search: 'shoes', limit: 10 }),
      });
    });

    test('test_getAllStores_apiError_throwsException', async () => {
      // Arrange
      (api.get as jest.Mock).mockRejectedValueOnce({ message: 'Server Error' });

      // Act & Assert
      await expect(getAllStores()).rejects.toThrow('Server Error');
    });
  });

  // ── searchStores ──────────────────────────────────────────────────
  describe('searchStores', () => {
    test('test_searchStores_validQuery_returnsMatchingStoresData', async () => {
      // Arrange
      const mockData = { success: true, data: [{ _id: 's2', name: 'Shoe Hub' }] };
      (api.get as jest.Mock).mockResolvedValueOnce({ data: mockData });

      // Act
      const result = await searchStores({ search: 'shoe' });

      // Assert
      expect(api.get).toHaveBeenCalledWith('/business/all', {
        params: expect.objectContaining({ search: 'shoe' }),
      });
      expect(result).toEqual(mockData);
    });

    test('test_searchStores_apiError_throwsException', async () => {
      // Arrange
      (api.get as jest.Mock).mockRejectedValueOnce({ message: 'Search failed' });

      // Act & Assert
      await expect(searchStores({ search: 'x' })).rejects.toThrow('Search failed');
    });
  });

  // ── getBusinessDashboard ──────────────────────────────────────────
  describe('getBusinessDashboard', () => {
    test('test_getBusinessDashboard_validId_returnsDashboardData', async () => {
      // Arrange
      const dashboardData = { revenue: 5000, orders: 20 };
      (api.get as jest.Mock).mockResolvedValueOnce({ data: { data: dashboardData } });

      // Act
      const result = await getBusinessDashboard('biz-1');

      // Assert
      expect(api.get).toHaveBeenCalledWith('/business/dashboard/biz-1');
      expect(result).toEqual(dashboardData);
    });

    test('test_getBusinessDashboard_responseWithoutDataKey_returnsWholeResponseData', async () => {
      // Arrange
      const mockData = { revenue: 1000 };
      (api.get as jest.Mock).mockResolvedValueOnce({ data: mockData });

      // Act
      const result = await getBusinessDashboard('biz-2');

      // Assert
      expect(result).toEqual(mockData);
    });

    test('test_getBusinessDashboard_apiError_throwsException', async () => {
      // Arrange
      (api.get as jest.Mock).mockRejectedValueOnce({
        response: { data: { error: 'Failed to fetch dashboard data' }, status: 500 },
      });

      // Act & Assert
      await expect(getBusinessDashboard('bad-id')).rejects.toThrow('Failed to fetch dashboard data');
    });
  });

  // ── getBusinessAnalytics ──────────────────────────────────────────
  describe('getBusinessAnalytics', () => {
    test('test_getBusinessAnalytics_weekTimeframe_callsCorrectEndpointAndReturnsData', async () => {
      // Arrange
      const analyticsData = { sales: 100, views: 500 };
      (api.get as jest.Mock).mockResolvedValueOnce({ data: { data: analyticsData } });

      // Act
      const result = await getBusinessAnalytics('biz-1', 'week');

      // Assert
      expect(api.get).toHaveBeenCalledWith('/business/analytics/biz-1?timeframe=week');
      expect(result).toEqual(analyticsData);
    });

    test('test_getBusinessAnalytics_monthTimeframe_passesCorrectTimeframeParam', async () => {
      // Arrange
      (api.get as jest.Mock).mockResolvedValueOnce({ data: { sales: 300 } });

      // Act
      const result = await getBusinessAnalytics('biz-1', 'month');

      // Assert
      expect(api.get).toHaveBeenCalledWith('/business/analytics/biz-1?timeframe=month');
      expect(result).toEqual({ sales: 300 });
    });

    test('test_getBusinessAnalytics_apiError_throwsException', async () => {
      // Arrange
      (api.get as jest.Mock).mockRejectedValueOnce({
        response: { data: { error: 'Failed to fetch analytics' }, status: 500 },
      });

      // Act & Assert
      await expect(getBusinessAnalytics('bad-id', 'year')).rejects.toThrow('Failed to fetch analytics');
    });
  });

  // ── getBusinessReviews ────────────────────────────────────────────
  describe('getBusinessReviews', () => {
    test('test_getBusinessReviews_validId_returnsReviewsData', async () => {
      // Arrange
      const mockData = { success: true, reviews: [{ _id: 'r1', rating: 5 }] };
      (api.get as jest.Mock).mockResolvedValueOnce({ data: mockData });

      // Act
      const result = await getBusinessReviews('biz-1');

      // Assert
      expect(api.get).toHaveBeenCalledWith('/business/biz-1/reviews');
      expect(result).toEqual(mockData);
    });

    test('test_getBusinessReviews_apiError_throwsException', async () => {
      // Arrange
      (api.get as jest.Mock).mockRejectedValueOnce({
        response: { data: { error: 'Failed to fetch business reviews' }, status: 404 },
      });

      // Act & Assert
      await expect(getBusinessReviews('ghost-id')).rejects.toThrow('Failed to fetch business reviews');
    });
  });

  // ── replyToReview ─────────────────────────────────────────────────
  describe('replyToReview', () => {
    test('test_replyToReview_validInputs_postsCommentAndReturnsData', async () => {
      // Arrange
      const mockData = { success: true, comment: { _id: 'c1', text: 'Thank you!' } };
      (api.post as jest.Mock).mockResolvedValueOnce({ data: mockData });

      // Act
      const result = await replyToReview('review-1', 'Thank you!');

      // Assert
      expect(api.post).toHaveBeenCalledWith('/reviews/review-1/comments', { text: 'Thank you!' });
      expect(result).toEqual(mockData);
    });

    test('test_replyToReview_apiError_throwsException', async () => {
      // Arrange
      (api.post as jest.Mock).mockRejectedValueOnce({
        response: { data: { error: 'Failed to post reply' }, status: 400 },
      });

      // Act & Assert
      await expect(replyToReview('r-1', 'bad reply')).rejects.toThrow('Failed to post reply');
    });
  });

  // ── followStore ───────────────────────────────────────────────────
  describe('followStore', () => {
    test('test_followStore_validId_postsToFollowEndpointAndReturnsData', async () => {
      // Arrange
      const mockData = { success: true, message: 'Following store' };
      (api.post as jest.Mock).mockResolvedValueOnce({ data: mockData });

      // Act
      const result = await followStore('store-1');

      // Assert
      expect(api.post).toHaveBeenCalledWith('/business/store-1/follow');
      expect(result).toEqual(mockData);
    });

    test('test_followStore_apiError_throwsException', async () => {
      // Arrange
      (api.post as jest.Mock).mockRejectedValueOnce({ message: 'Store not found' });

      // Act & Assert
      await expect(followStore('ghost-store')).rejects.toThrow('Store not found');
    });
  });

  // ── unfollowStore ─────────────────────────────────────────────────
  describe('unfollowStore', () => {
    test('test_unfollowStore_validId_callsDeleteEndpointAndReturnsData', async () => {
      // Arrange
      const mockData = { success: true, message: 'Unfollowed store' };
      (api.delete as jest.Mock).mockResolvedValueOnce({ data: mockData });

      // Act
      const result = await unfollowStore('store-1');

      // Assert
      expect(api.delete).toHaveBeenCalledWith('/business/store-1/follow');
      expect(result).toEqual(mockData);
    });

    test('test_unfollowStore_apiError_throwsException', async () => {
      // Arrange
      (api.delete as jest.Mock).mockRejectedValueOnce({ message: 'Not following' });

      // Act & Assert
      await expect(unfollowStore('store-x')).rejects.toThrow('Not following');
    });
  });

  // ── getDeliverySettings ───────────────────────────────────────────
  describe('getDeliverySettings', () => {
    test('test_getDeliverySettings_validId_returnsDeliverySettingsData', async () => {
      // Arrange
      const mockData = { success: true, settings: { deliveryBaseFee: 5, deliveryPerKmFee: 1 } };
      (api.get as jest.Mock).mockResolvedValueOnce({ data: mockData });

      // Act
      const result = await getDeliverySettings('store-1');

      // Assert
      expect(api.get).toHaveBeenCalledWith('/business/store-1/delivery-settings');
      expect(result).toEqual(mockData);
    });

    test('test_getDeliverySettings_apiError_throwsException', async () => {
      // Arrange
      (api.get as jest.Mock).mockRejectedValueOnce({ message: 'Settings not found' });

      // Act & Assert
      await expect(getDeliverySettings('bad-id')).rejects.toThrow('Settings not found');
    });
  });

  // ── updateDeliverySettings ────────────────────────────────────────
  describe('updateDeliverySettings', () => {
    test('test_updateDeliverySettings_validInput_callsPutEndpointWithSettingsAndReturnsData', async () => {
      // Arrange
      const mockData = { success: true };
      (api.put as jest.Mock).mockResolvedValueOnce({ data: mockData });
      const settings = { deliveryBaseFee: 8, deliveryPerKmFee: 1.5, deliveryMaxKm: 30 };

      // Act
      const result = await updateDeliverySettings('store-1', settings);

      // Assert
      expect(api.put).toHaveBeenCalledWith('/business/store-1/delivery-settings', settings);
      expect(result).toEqual(mockData);
    });

    test('test_updateDeliverySettings_apiError_throwsException', async () => {
      // Arrange
      (api.put as jest.Mock).mockRejectedValueOnce({ message: 'Update failed' });

      // Act & Assert
      await expect(
        updateDeliverySettings('bad-id', { deliveryBaseFee: 0 })
      ).rejects.toThrow('Update failed');
    });
  });
});
