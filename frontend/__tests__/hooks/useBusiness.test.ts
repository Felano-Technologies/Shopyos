/**
 * __tests__/hooks/useBusiness.test.ts
 *
 * Unit tests for the useBusiness hooks system.
 * TanStack query functions and service API calls are mocked.
 * Conforms to guidelines/test.md.
 */

// Mock TanStack React Query hooks
jest.mock('@tanstack/react-query', () => ({
  __esModule: true,
  useQuery: jest.fn(),
  useMutation: jest.fn(),
  useQueryClient: jest.fn(),
}));

// Mock services/api — the module useBusiness.ts imports as ApiService
jest.mock('@/services/api', () => ({
  __esModule: true,
  getMyBusinesses: jest.fn(),
  getBusinessDashboard: jest.fn(),
  getBusinessAnalytics: jest.fn(),
  getStoreOrders: jest.fn(),
  getStoreProducts: jest.fn(),
  getMyCampaigns: jest.fn(),
  createCampaign: jest.fn(),
  updateCampaignStatus: jest.fn(),
  getBusinessReviews: jest.fn(),
  replyToReview: jest.fn(),
  searchStores: jest.fn(),
  updateBusiness: jest.fn(),
  storage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

// Mock expo-router (useMyBusinesses internally may trigger useEffect but we avoid
// full rendering — this prevents import-time errors)
jest.mock('expo-router', () => ({
  __esModule: true,
  useRouter: jest.fn(),
  usePathname: jest.fn().mockReturnValue('/home'),
}));

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as ApiService from '@/services/api';
import {
  useMyBusinesses,
  useBusinessDashboard,
  useBusinessAnalytics,
  useStoreOrders,
  useStoreProducts,
  useMyCampaigns,
  useCreateCampaign,
  useUpdateCampaignStatus,
  useBusinessReviews,
  useReplyToReview,
  useStoreSearch,
  useUpdateBusiness,
} from '../../hooks/useBusiness';
import { queryKeys } from '@/lib/query/keys';

describe('useBusiness Hooks Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── useMyBusinesses ──────────────────────────────────────────────────
  test('test_useMyBusinesses_validCall_invokesUseQueryWithCorrectConfig', async () => {
    // Arrange
    (useQuery as jest.Mock).mockReturnValue({ data: { businesses: [] }, isLoading: false });

    // Act
    const result = useMyBusinesses();

    // Assert
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.business.list(),
        staleTime: 30 * 1000,
        gcTime: 5 * 60 * 1000,
      })
    );

    // Verify queryFn calls the API
    const config = (useQuery as jest.Mock).mock.calls[0][0];
    (ApiService.getMyBusinesses as jest.Mock).mockResolvedValueOnce({ businesses: [{ _id: 'b1' }] });
    await config.queryFn();
    expect(ApiService.getMyBusinesses).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  test('test_useMyBusinesses_withParams_passesParamsToQueryFn', async () => {
    // Arrange
    (useQuery as jest.Mock).mockReturnValue({ data: {}, isLoading: false });

    // Act
    useMyBusinesses({ limit: 5, offset: 10 });

    const config = (useQuery as jest.Mock).mock.calls[0][0];
    (ApiService.getMyBusinesses as jest.Mock).mockResolvedValueOnce({ businesses: [] });
    await config.queryFn();

    // Assert — params object is forwarded to the API
    expect(ApiService.getMyBusinesses).toHaveBeenCalledWith({ limit: 5, offset: 10 });
  });

  // ── useBusinessDashboard ─────────────────────────────────────────────
  test('test_useBusinessDashboard_withBusinessId_invokesUseQueryWithCorrectConfigAndEnablesQuery', async () => {
    // Arrange
    (useQuery as jest.Mock).mockReturnValue({ data: {}, isLoading: false });

    // Act
    const result = useBusinessDashboard('biz-123');

    // Assert
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.business.dashboard('biz-123'),
        enabled: true,
        staleTime: 2 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
      })
    );

    const config = (useQuery as jest.Mock).mock.calls[0][0];
    (ApiService.getBusinessDashboard as jest.Mock).mockResolvedValueOnce({ revenue: 500 });
    await config.queryFn();
    expect(ApiService.getBusinessDashboard).toHaveBeenCalledWith('biz-123');
    expect(result).toBeDefined();
  });

  test('test_useBusinessDashboard_emptyBusinessId_disablesQuery', () => {
    // Arrange & Act
    useBusinessDashboard('');

    // Assert
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
      })
    );
  });

  // ── useBusinessAnalytics ─────────────────────────────────────────────
  test('test_useBusinessAnalytics_withBusinessIdAndTimeframe_invokesUseQueryWithCorrectConfig', async () => {
    // Arrange
    (useQuery as jest.Mock).mockReturnValue({ data: {}, isLoading: false });

    // Act
    const result = useBusinessAnalytics('biz-123', 'week');

    // Assert
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.business.analytics('biz-123', 'week'),
        enabled: true,
        staleTime: 5 * 60 * 1000,
        gcTime: 15 * 60 * 1000,
      })
    );

    const config = (useQuery as jest.Mock).mock.calls[0][0];
    (ApiService.getBusinessAnalytics as jest.Mock).mockResolvedValueOnce({ sales: 200 });
    await config.queryFn();
    expect(ApiService.getBusinessAnalytics).toHaveBeenCalledWith('biz-123', 'week');
    expect(result).toBeDefined();
  });

  test('test_useBusinessAnalytics_emptyBusinessId_disablesQuery', () => {
    // Arrange & Act
    useBusinessAnalytics('', 'year');

    // Assert
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
      })
    );
  });

  // ── useStoreOrders ───────────────────────────────────────────────────
  test('test_useStoreOrders_withStoreId_invokesUseQueryWithCorrectConfig', async () => {
    // Arrange
    (useQuery as jest.Mock).mockReturnValue({ data: { orders: [] }, isLoading: false });

    // Act
    const result = useStoreOrders('store-456');

    // Assert
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.business.orders('store-456', undefined),
        enabled: true,
        staleTime: 2 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
      })
    );

    const config = (useQuery as jest.Mock).mock.calls[0][0];
    (ApiService.getStoreOrders as jest.Mock).mockResolvedValueOnce({ orders: [] });
    await config.queryFn();
    expect(ApiService.getStoreOrders).toHaveBeenCalledWith('store-456', undefined);
    expect(result).toBeDefined();
  });

  test('test_useStoreOrders_emptyStoreId_disablesQuery', () => {
    // Arrange & Act
    useStoreOrders('');

    // Assert
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
      })
    );
  });

  // ── useStoreProducts ─────────────────────────────────────────────────
  test('test_useStoreProducts_withStoreId_invokesUseQueryWithCorrectConfig', async () => {
    // Arrange
    (useQuery as jest.Mock).mockReturnValue({ data: { products: [] }, isLoading: false });

    // Act
    const result = useStoreProducts('store-456');

    // Assert
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.business.products('store-456'),
        enabled: true,
        staleTime: 5 * 60 * 1000,
        gcTime: 15 * 60 * 1000,
      })
    );

    const config = (useQuery as jest.Mock).mock.calls[0][0];
    (ApiService.getStoreProducts as jest.Mock).mockResolvedValueOnce({ products: [] });
    await config.queryFn();
    expect(ApiService.getStoreProducts).toHaveBeenCalledWith('store-456', undefined);
    expect(result).toBeDefined();
  });

  test('test_useStoreProducts_emptyStoreId_disablesQuery', () => {
    // Arrange & Act
    useStoreProducts('');

    // Assert
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
      })
    );
  });

  // ── useMyCampaigns ───────────────────────────────────────────────────
  test('test_useMyCampaigns_validCall_invokesUseQueryWithCorrectConfig', async () => {
    // Arrange
    (useQuery as jest.Mock).mockReturnValue({ data: { campaigns: [] }, isLoading: false });

    // Act
    const result = useMyCampaigns();

    // Assert
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.business.campaigns(),
        staleTime: 5 * 60 * 1000,
        gcTime: 15 * 60 * 1000,
      })
    );

    const config = (useQuery as jest.Mock).mock.calls[0][0];
    (ApiService.getMyCampaigns as jest.Mock).mockResolvedValueOnce({ campaigns: [] });
    await config.queryFn();
    expect(ApiService.getMyCampaigns).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  // ── useCreateCampaign ─────────────────────────────────────────────────
  test('test_useCreateCampaign_mutationTriggered_invokesCreateCampaignAndInvalidatesCampaigns', async () => {
    // Arrange
    const mockQueryClientInstance = {
      invalidateQueries: jest.fn(),
    };
    (useQueryClient as jest.Mock).mockReturnValue(mockQueryClientInstance);
    (useMutation as jest.Mock).mockReturnValue({ mutate: jest.fn() });

    // Act
    useCreateCampaign();

    // Assert
    expect(useMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        mutationFn: expect.any(Function),
        onSuccess: expect.any(Function),
      })
    );

    const config = (useMutation as jest.Mock).mock.calls[0][0];

    // Verify mutationFn calls API
    const campaignData = { name: 'Summer Sale', discount: 20 };
    (ApiService.createCampaign as jest.Mock).mockResolvedValueOnce({ success: true });
    await config.mutationFn(campaignData);
    expect(ApiService.createCampaign).toHaveBeenCalledWith(campaignData);

    // Verify onSuccess invalidates campaigns query
    config.onSuccess();
    expect(mockQueryClientInstance.invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.business.campaigns(),
    });
  });

  // ── useUpdateCampaignStatus ───────────────────────────────────────────
  test('test_useUpdateCampaignStatus_mutationTriggered_invokesUpdateStatusAndInvalidatesCampaigns', async () => {
    // Arrange
    const mockQueryClientInstance = {
      invalidateQueries: jest.fn(),
    };
    (useQueryClient as jest.Mock).mockReturnValue(mockQueryClientInstance);
    (useMutation as jest.Mock).mockReturnValue({ mutate: jest.fn() });

    // Act
    useUpdateCampaignStatus();

    // Assert
    const config = (useMutation as jest.Mock).mock.calls[0][0];

    // Verify mutationFn calls API with id and status
    (ApiService.updateCampaignStatus as jest.Mock).mockResolvedValueOnce({ success: true });
    await config.mutationFn({ id: 'camp-001', status: 'active' });
    expect(ApiService.updateCampaignStatus).toHaveBeenCalledWith('camp-001', 'active');

    // Verify onSuccess invalidates campaigns query
    config.onSuccess();
    expect(mockQueryClientInstance.invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.business.campaigns(),
    });
  });

  // ── useBusinessReviews ────────────────────────────────────────────────
  test('test_useBusinessReviews_withBusinessId_invokesUseQueryWithCorrectConfigAndEnablesQuery', async () => {
    // Arrange
    (useQuery as jest.Mock).mockReturnValue({ data: { reviews: [] }, isLoading: false });

    // Act
    const result = useBusinessReviews('biz-123');

    // Assert
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['business', 'reviews', 'biz-123'],
        enabled: true,
      })
    );

    const config = (useQuery as jest.Mock).mock.calls[0][0];
    (ApiService.getBusinessReviews as jest.Mock).mockResolvedValueOnce({ reviews: [] });
    await config.queryFn();
    expect(ApiService.getBusinessReviews).toHaveBeenCalledWith('biz-123');
    expect(result).toBeDefined();
  });

  test('test_useBusinessReviews_undefinedBusinessId_disablesQueryAndReturnsNull', async () => {
    // Arrange
    (useQuery as jest.Mock).mockReturnValue({ data: null, isLoading: false });

    // Act
    useBusinessReviews(undefined);

    // Assert
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
      })
    );

    // queryFn should return null when businessId is undefined
    const config = (useQuery as jest.Mock).mock.calls[0][0];
    const res = await config.queryFn();
    expect(res).toBeNull();
    expect(ApiService.getBusinessReviews).not.toHaveBeenCalled();
  });

  // ── useReplyToReview ──────────────────────────────────────────────────
  test('test_useReplyToReview_mutationTriggered_invokesReplyToReviewAndInvalidatesReviews', async () => {
    // Arrange
    const mockQueryClientInstance = {
      invalidateQueries: jest.fn(),
    };
    (useQueryClient as jest.Mock).mockReturnValue(mockQueryClientInstance);
    (useMutation as jest.Mock).mockReturnValue({ mutate: jest.fn() });

    // Act
    useReplyToReview();

    // Assert
    const config = (useMutation as jest.Mock).mock.calls[0][0];

    // Verify mutationFn calls API
    (ApiService.replyToReview as jest.Mock).mockResolvedValueOnce({ success: true });
    await config.mutationFn({ reviewId: 'rev-001', text: 'Thank you!' });
    expect(ApiService.replyToReview).toHaveBeenCalledWith('rev-001', 'Thank you!');

    // Verify onSuccess invalidates reviews
    config.onSuccess();
    expect(mockQueryClientInstance.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['business', 'reviews'],
    });
  });

  // ── useStoreSearch ────────────────────────────────────────────────────
  test('test_useStoreSearch_queryAtLeastTwoChars_enablesQueryAndCallsApi', async () => {
    // Arrange
    (useQuery as jest.Mock).mockReturnValue({ data: {}, isLoading: false });

    // Act
    const result = useStoreSearch('shoes');

    // Assert
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['stores', 'search', 'shoes', null],
        enabled: true,
        staleTime: 5 * 60 * 1000,
        gcTime: 15 * 60 * 1000,
      })
    );

    const config = (useQuery as jest.Mock).mock.calls[0][0];
    (ApiService.searchStores as jest.Mock).mockResolvedValueOnce({ businesses: [] });
    await config.queryFn();
    expect(ApiService.searchStores).toHaveBeenCalledWith({ search: 'shoes', limit: 10 });
    expect(result).toBeDefined();
  });

  test('test_useStoreSearch_queryLessThanTwoChars_disablesQuery', () => {
    // Arrange & Act
    useStoreSearch('s');

    // Assert
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
      })
    );
  });

  // ── useUpdateBusiness ─────────────────────────────────────────────────
  test('test_useUpdateBusiness_mutationTriggered_invokesUpdateBusinessAndInvalidatesRelatedKeys', async () => {
    // Arrange
    const mockQueryClientInstance = {
      invalidateQueries: jest.fn(),
    };
    (useQueryClient as jest.Mock).mockReturnValue(mockQueryClientInstance);
    (useMutation as jest.Mock).mockReturnValue({ mutate: jest.fn() });

    // Act
    useUpdateBusiness();

    // Assert
    expect(useMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        mutationFn: expect.any(Function),
        onSuccess: expect.any(Function),
      })
    );

    const config = (useMutation as jest.Mock).mock.calls[0][0];

    // Verify mutationFn calls the update API
    const updatePayload = { id: 'biz-123', data: { name: 'Updated Store' } };
    (ApiService.updateBusiness as jest.Mock).mockResolvedValueOnce({ success: true });
    await config.mutationFn(updatePayload);
    expect(ApiService.updateBusiness).toHaveBeenCalledWith('biz-123', { name: 'Updated Store' });

    // Verify onSuccess: success response invalidates list, dashboard, and detail
    config.onSuccess({ success: true }, updatePayload);
    expect(mockQueryClientInstance.invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.business.list(),
    });
    expect(mockQueryClientInstance.invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.business.dashboard('biz-123'),
    });
    expect(mockQueryClientInstance.invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.business.detail('biz-123'),
    });
  });

  test('test_useUpdateBusiness_unsuccessfulResponse_doesNotInvalidateQueries', () => {
    // Arrange
    const mockQueryClientInstance = {
      invalidateQueries: jest.fn(),
    };
    (useQueryClient as jest.Mock).mockReturnValue(mockQueryClientInstance);
    (useMutation as jest.Mock).mockReturnValue({ mutate: jest.fn() });

    // Act
    useUpdateBusiness();
    const config = (useMutation as jest.Mock).mock.calls[0][0];

    // success = false — hook should NOT invalidate
    config.onSuccess({ success: false }, { id: 'biz-123', data: {} });

    // Assert
    expect(mockQueryClientInstance.invalidateQueries).not.toHaveBeenCalled();
  });
});
