/**
 * __tests__/hooks/useDelivery.test.ts
 *
 * Unit tests for the useDelivery hooks system.
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

// Mock services/api — the module useDelivery.ts imports as ApiService
jest.mock('@/services/api', () => ({
  __esModule: true,
  getAvailableDeliveries: jest.fn(),
  getActiveDeliveries: jest.fn(),
  getDeliveryDetails: jest.fn(),
  getDriverStats: jest.fn(),
  assignDriver: jest.fn(),
  updateDeliveryStatus: jest.fn(),
  verifyDeliveryPin: jest.fn(),
  getDriverProfile: jest.fn(),
}));

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as ApiService from '@/services/api';
import {
  useAvailableDeliveries,
  useActiveDeliveries,
  useDeliveryDetails,
  useDriverStats,
  useAssignDriver,
  useUpdateDeliveryStatus,
  useVerifyDeliveryPin,
  useDriverProfile,
} from '../../hooks/useDelivery';
import { queryKeys } from '@/lib/query/keys';

describe('useDelivery Hooks Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── useAvailableDeliveries ───────────────────────────────────────────
  test('test_useAvailableDeliveries_validCall_invokesUseQueryWithCorrectConfig', async () => {
    // Arrange
    (useQuery as jest.Mock).mockReturnValue({ data: { deliveries: [] }, isLoading: false });

    // Act
    const result = useAvailableDeliveries();

    // Assert
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.delivery.available(),
        enabled: true,
        staleTime: 1 * 60 * 1000,
        gcTime: 5 * 60 * 1000,
      })
    );

    const config = (useQuery as jest.Mock).mock.calls[0][0];
    (ApiService.getAvailableDeliveries as jest.Mock).mockResolvedValueOnce({ deliveries: [] });
    await config.queryFn();
    expect(ApiService.getAvailableDeliveries).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  test('test_useAvailableDeliveries_withEnabledFalse_disablesQuery', () => {
    // Arrange & Act
    useAvailableDeliveries({ enabled: false });

    // Assert
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
      })
    );
  });

  test('test_useAvailableDeliveries_withRefetchInterval_passesIntervalToConfig', () => {
    // Arrange & Act
    useAvailableDeliveries({ refetchInterval: 30000 });

    // Assert
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        refetchInterval: 30000,
      })
    );
  });

  // ── useActiveDeliveries ──────────────────────────────────────────────
  test('test_useActiveDeliveries_validCall_invokesUseQueryWithCorrectConfig', async () => {
    // Arrange
    (useQuery as jest.Mock).mockReturnValue({ data: { deliveries: [] }, isLoading: false });

    // Act
    const result = useActiveDeliveries();

    // Assert
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.delivery.active(),
        enabled: true,
        staleTime: 1 * 60 * 1000,
        gcTime: 5 * 60 * 1000,
      })
    );

    const config = (useQuery as jest.Mock).mock.calls[0][0];
    (ApiService.getActiveDeliveries as jest.Mock).mockResolvedValueOnce({ deliveries: [] });
    await config.queryFn();
    expect(ApiService.getActiveDeliveries).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  test('test_useActiveDeliveries_withEnabledFalse_disablesQuery', () => {
    // Arrange & Act
    useActiveDeliveries({ enabled: false });

    // Assert
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
      })
    );
  });

  test('test_useActiveDeliveries_withRefetchInterval_passesIntervalToConfig', () => {
    // Arrange & Act
    useActiveDeliveries({ refetchInterval: 15000 });

    // Assert
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        refetchInterval: 15000,
      })
    );
  });

  // ── useDeliveryDetails ───────────────────────────────────────────────
  test('test_useDeliveryDetails_withDeliveryId_invokesUseQueryWithCorrectConfigAndEnablesQuery', async () => {
    // Arrange
    (useQuery as jest.Mock).mockReturnValue({ data: { id: 'del-001' }, isLoading: false });

    // Act
    const result = useDeliveryDetails('del-001');

    // Assert
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.delivery.detail('del-001'),
        enabled: true,
        staleTime: 30 * 1000,
        gcTime: 5 * 60 * 1000,
      })
    );

    const config = (useQuery as jest.Mock).mock.calls[0][0];
    (ApiService.getDeliveryDetails as jest.Mock).mockResolvedValueOnce({ delivery: { id: 'del-001' } });
    await config.queryFn();
    expect(ApiService.getDeliveryDetails).toHaveBeenCalledWith('del-001');
    expect(result).toBeDefined();
  });

  test('test_useDeliveryDetails_emptyDeliveryId_disablesQuery', () => {
    // Arrange & Act
    useDeliveryDetails('');

    // Assert
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
      })
    );
  });

  // ── useDriverStats ───────────────────────────────────────────────────
  test('test_useDriverStats_defaultTimeframe_invokesUseQueryWithTodayTimeframeAndCorrectConfig', async () => {
    // Arrange
    (useQuery as jest.Mock).mockReturnValue({ data: { deliveries: 5 }, isLoading: false });

    // Act
    const result = useDriverStats();

    // Assert
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.delivery.stats('today'),
        staleTime: 5 * 60 * 1000,
        gcTime: 15 * 60 * 1000,
      })
    );

    const config = (useQuery as jest.Mock).mock.calls[0][0];
    (ApiService.getDriverStats as jest.Mock).mockResolvedValueOnce({ deliveries: 5 });
    await config.queryFn();
    expect(ApiService.getDriverStats).toHaveBeenCalledWith('today');
    expect(result).toBeDefined();
  });

  test('test_useDriverStats_weekTimeframe_passesWeekToQueryKeyAndQueryFn', async () => {
    // Arrange
    (useQuery as jest.Mock).mockReturnValue({ data: {}, isLoading: false });

    // Act
    useDriverStats('week');

    // Assert
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.delivery.stats('week'),
      })
    );

    const config = (useQuery as jest.Mock).mock.calls[0][0];
    await config.queryFn();
    expect(ApiService.getDriverStats).toHaveBeenCalledWith('week');
  });

  test('test_useDriverStats_monthTimeframe_passesMonthToQueryKeyAndQueryFn', async () => {
    // Arrange
    (useQuery as jest.Mock).mockReturnValue({ data: {}, isLoading: false });

    // Act
    useDriverStats('month');

    // Assert
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.delivery.stats('month'),
      })
    );

    const config = (useQuery as jest.Mock).mock.calls[0][0];
    await config.queryFn();
    expect(ApiService.getDriverStats).toHaveBeenCalledWith('month');
  });

  // ── useAssignDriver ──────────────────────────────────────────────────
  test('test_useAssignDriver_mutationTriggered_invokesAssignDriverAndInvalidatesDeliveryQueries', async () => {
    // Arrange
    const mockQueryClientInstance = {
      invalidateQueries: jest.fn(),
    };
    (useQueryClient as jest.Mock).mockReturnValue(mockQueryClientInstance);
    (useMutation as jest.Mock).mockReturnValue({ mutate: jest.fn() });

    // Act
    useAssignDriver();

    // Assert
    expect(useMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        mutationFn: expect.any(Function),
        onSuccess: expect.any(Function),
      })
    );

    const config = (useMutation as jest.Mock).mock.calls[0][0];

    // Verify mutationFn calls API
    (ApiService.assignDriver as jest.Mock).mockResolvedValueOnce({ success: true });
    await config.mutationFn('del-001');
    expect(ApiService.assignDriver).toHaveBeenCalledWith('del-001');

    // Verify onSuccess invalidates available and active keys
    config.onSuccess();
    expect(mockQueryClientInstance.invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.delivery.available(),
    });
    expect(mockQueryClientInstance.invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.delivery.active(),
    });
  });

  // ── useUpdateDeliveryStatus ──────────────────────────────────────────
  test('test_useUpdateDeliveryStatus_mutationTriggered_invokesUpdateStatusAndInvalidatesRelatedKeys', async () => {
    // Arrange
    const mockQueryClientInstance = {
      invalidateQueries: jest.fn(),
    };
    (useQueryClient as jest.Mock).mockReturnValue(mockQueryClientInstance);
    (useMutation as jest.Mock).mockReturnValue({ mutate: jest.fn() });

    // Act
    useUpdateDeliveryStatus();

    // Assert
    expect(useMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        mutationFn: expect.any(Function),
        onSuccess: expect.any(Function),
      })
    );

    const config = (useMutation as jest.Mock).mock.calls[0][0];

    // Verify mutationFn calls API with correct arguments
    (ApiService.updateDeliveryStatus as jest.Mock).mockResolvedValueOnce({ success: true });
    await config.mutationFn({ deliveryId: 'del-001', status: 'delivered' });
    expect(ApiService.updateDeliveryStatus).toHaveBeenCalledWith('del-001', 'delivered');

    // Verify onSuccess invalidates detail, active, and today's stats
    config.onSuccess(undefined, { deliveryId: 'del-001', status: 'delivered' });
    expect(mockQueryClientInstance.invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.delivery.detail('del-001'),
    });
    expect(mockQueryClientInstance.invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.delivery.active(),
    });
    expect(mockQueryClientInstance.invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.delivery.stats('today'),
    });
  });

  // ── useVerifyDeliveryPin ─────────────────────────────────────────────
  test('test_useVerifyDeliveryPin_mutationTriggered_invokesVerifyPinAndInvalidatesRelatedKeys', async () => {
    // Arrange
    const mockQueryClientInstance = {
      invalidateQueries: jest.fn(),
    };
    (useQueryClient as jest.Mock).mockReturnValue(mockQueryClientInstance);
    (useMutation as jest.Mock).mockReturnValue({ mutate: jest.fn() });

    // Act
    useVerifyDeliveryPin();

    // Assert
    expect(useMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        mutationFn: expect.any(Function),
        onSuccess: expect.any(Function),
      })
    );

    const config = (useMutation as jest.Mock).mock.calls[0][0];

    // Verify mutationFn calls API with deliveryId and pin
    (ApiService.verifyDeliveryPin as jest.Mock).mockResolvedValueOnce({ success: true });
    await config.mutationFn({ deliveryId: 'del-002', pin: '1234' });
    expect(ApiService.verifyDeliveryPin).toHaveBeenCalledWith('del-002', '1234');

    // Verify onSuccess invalidates detail, active, and today's stats
    config.onSuccess(undefined, { deliveryId: 'del-002', pin: '1234' });
    expect(mockQueryClientInstance.invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.delivery.detail('del-002'),
    });
    expect(mockQueryClientInstance.invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.delivery.active(),
    });
    expect(mockQueryClientInstance.invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.delivery.stats('today'),
    });
  });

  // ── useDriverProfile ─────────────────────────────────────────────────
  test('test_useDriverProfile_validCall_invokesUseQueryWithCorrectConfig', async () => {
    // Arrange
    (useQuery as jest.Mock).mockReturnValue({ data: { name: 'Driver A' }, isLoading: false });

    // Act
    const result = useDriverProfile();

    // Assert
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['driver_profile'],
        staleTime: 0,
        gcTime: 0,
      })
    );

    const config = (useQuery as jest.Mock).mock.calls[0][0];
    (ApiService.getDriverProfile as jest.Mock).mockResolvedValueOnce({ name: 'Driver A' });
    await config.queryFn();
    expect(ApiService.getDriverProfile).toHaveBeenCalled();
    expect(result).toBeDefined();
  });
});
