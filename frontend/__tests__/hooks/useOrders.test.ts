/**
 * __tests__/hooks/useOrders.test.ts
 *
 * Unit tests for the useOrders hooks system.
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

// Mock orders and business API from lib/query/api
jest.mock('@/lib/query/api', () => ({
  __esModule: true,
  ordersApi: {
    getAll: jest.fn(),
    getById: jest.fn(),
  },
  businessApi: {
    getMyBusinesses: jest.fn(),
    getDashboard: jest.fn(),
    getAnalytics: jest.fn(),
    getStoreOrders: jest.fn(),
    getStoreProducts: jest.fn(),
  },
}));

// Mock services/api for product CRUD functions
jest.mock('../../services/api', () => ({
  __esModule: true,
  createProduct: jest.fn(),
  updateProduct: jest.fn(),
  deleteProduct: jest.fn(),
  uploadProductImages: jest.fn(),
}));

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ordersApi, businessApi } from '@/lib/query/api';
import * as ServicesApi from '../../services/api';
import {
  useOrders,
  useOrderDetail,
  useMyBusinesses,
  useBusinessDashboard,
  useBusinessAnalytics,
  useStoreOrders,
  useStoreProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  useUploadProductImages,
} from '../../hooks/useOrders';
import { queryKeys } from '@/lib/query/keys';

describe('useOrders Hooks Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── useOrders ────────────────────────────────────────────────────────
  test('test_useOrders_validCall_invokesUseQueryWithCorrectConfig', () => {
    // Arrange
    (useQuery as jest.Mock).mockReturnValue({ data: { orders: [] }, isLoading: false });

    // Act
    const result = useOrders();

    // Assert
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.orders.list(undefined),
        refetchOnMount: true,
        staleTime: 30 * 1000,
        gcTime: 10 * 60 * 1000,
      })
    );
    expect(result).toBeDefined();
  });

  test('test_useOrders_withStatusFilter_passesStatusToQueryKeyAndQueryFn', () => {
    // Arrange
    (useQuery as jest.Mock).mockReturnValue({ data: { orders: [] }, isLoading: false });

    // Act
    useOrders('pending');

    // Assert
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.orders.list('pending'),
      })
    );

    const config = (useQuery as jest.Mock).mock.calls[0][0];
    config.queryFn();
    expect(ordersApi.getAll).toHaveBeenCalledWith('pending');
  });

  // ── useOrderDetail ───────────────────────────────────────────────────
  test('test_useOrderDetail_withId_invokesUseQueryWithCorrectConfigAndEnablesQuery', () => {
    // Arrange
    (useQuery as jest.Mock).mockReturnValue({ data: { id: 'ord-123' }, isLoading: false });

    // Act
    const result = useOrderDetail('ord-123');

    // Assert
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.orders.detail('ord-123'),
        enabled: true,
        refetchOnMount: true,
        staleTime: 30 * 1000,
        gcTime: 10 * 60 * 1000,
      })
    );

    const config = (useQuery as jest.Mock).mock.calls[0][0];
    config.queryFn();
    expect(ordersApi.getById).toHaveBeenCalledWith('ord-123');
    expect(result).toBeDefined();
  });

  test('test_useOrderDetail_emptyId_disablesQuery', () => {
    // Arrange & Act
    useOrderDetail('');

    // Assert
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
      })
    );
  });

  // ── useMyBusinesses ──────────────────────────────────────────────────
  test('test_useMyBusinesses_validCall_invokesUseQueryWithCorrectConfig', () => {
    // Arrange
    (useQuery as jest.Mock).mockReturnValue({ data: [], isLoading: false });

    // Act
    const result = useMyBusinesses();

    // Assert
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.business.list(),
        refetchOnMount: false,
        staleTime: 10 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
      })
    );

    const config = (useQuery as jest.Mock).mock.calls[0][0];
    config.queryFn();
    expect(businessApi.getMyBusinesses).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  // ── useBusinessDashboard ─────────────────────────────────────────────
  test('test_useBusinessDashboard_withBusinessId_invokesUseQueryWithCorrectConfigAndEnablesQuery', () => {
    // Arrange
    (useQuery as jest.Mock).mockReturnValue({ data: {}, isLoading: false });

    // Act
    const result = useBusinessDashboard('biz-456');

    // Assert
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.business.dashboard('biz-456'),
        enabled: true,
        refetchOnMount: true,
        staleTime: 2 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
      })
    );

    const config = (useQuery as jest.Mock).mock.calls[0][0];
    config.queryFn();
    expect(businessApi.getDashboard).toHaveBeenCalledWith('biz-456');
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
  test('test_useBusinessAnalytics_withBusinessIdAndTimeframe_invokesUseQueryWithCorrectConfig', () => {
    // Arrange
    (useQuery as jest.Mock).mockReturnValue({ data: {}, isLoading: false });

    // Act
    const result = useBusinessAnalytics('biz-456', 'month');

    // Assert
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.business.analytics('biz-456', 'month'),
        enabled: true,
        staleTime: 5 * 60 * 1000,
        gcTime: 20 * 60 * 1000,
      })
    );

    const config = (useQuery as jest.Mock).mock.calls[0][0];
    config.queryFn();
    expect(businessApi.getAnalytics).toHaveBeenCalledWith('biz-456', 'month');
    expect(result).toBeDefined();
  });

  test('test_useBusinessAnalytics_emptyBusinessId_disablesQuery', () => {
    // Arrange & Act
    useBusinessAnalytics('', 'week');

    // Assert
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
      })
    );
  });

  // ── useStoreOrders ───────────────────────────────────────────────────
  test('test_useStoreOrders_withStoreId_invokesUseQueryWithCorrectConfig', () => {
    // Arrange
    (useQuery as jest.Mock).mockReturnValue({ data: [], isLoading: false });

    // Act
    const result = useStoreOrders('store-789');

    // Assert
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.business.orders('store-789', undefined),
        enabled: true,
        refetchOnMount: true,
        staleTime: 30 * 1000,
        gcTime: 10 * 60 * 1000,
      })
    );

    const config = (useQuery as jest.Mock).mock.calls[0][0];
    config.queryFn();
    expect(businessApi.getStoreOrders).toHaveBeenCalledWith('store-789', { status: undefined });
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
  test('test_useStoreProducts_withStoreId_invokesUseQueryWithCorrectConfig', () => {
    // Arrange
    (useQuery as jest.Mock).mockReturnValue({ data: [], isLoading: false });

    // Act
    const result = useStoreProducts('store-789');

    // Assert
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.business.products('store-789'),
        enabled: true,
        staleTime: 5 * 60 * 1000,
        gcTime: 20 * 60 * 1000,
      })
    );

    const config = (useQuery as jest.Mock).mock.calls[0][0];
    config.queryFn();
    expect(businessApi.getStoreProducts).toHaveBeenCalledWith('store-789');
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

  // ── useCreateProduct ─────────────────────────────────────────────────
  test('test_useCreateProduct_mutationTriggered_invokesCreateProductAndInvalidatesQueries', async () => {
    // Arrange
    const mockQueryClientInstance = {
      invalidateQueries: jest.fn(),
    };
    (useQueryClient as jest.Mock).mockReturnValue(mockQueryClientInstance);
    (useMutation as jest.Mock).mockReturnValue({ mutate: jest.fn() });

    // Act
    useCreateProduct('store-789');

    // Assert
    expect(useMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        mutationFn: expect.any(Function),
        onSuccess: expect.any(Function),
      })
    );

    const config = (useMutation as jest.Mock).mock.calls[0][0];

    // Verify mutationFn calls the service
    const productData = { name: 'New Product', price: 99 };
    (ServicesApi.createProduct as jest.Mock).mockResolvedValueOnce({ success: true });
    await config.mutationFn(productData);
    expect(ServicesApi.createProduct).toHaveBeenCalledWith(productData);

    // Verify onSuccess invalidates expected query keys
    config.onSuccess();
    expect(mockQueryClientInstance.invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.business.products('store-789'),
    });
    expect(mockQueryClientInstance.invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.products.lists(),
    });
    expect(mockQueryClientInstance.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['products', 'search'],
    });
  });

  // ── useUpdateProduct ─────────────────────────────────────────────────
  test('test_useUpdateProduct_mutationTriggered_invokesUpdateProductAndInvalidatesDetailAndListings', async () => {
    // Arrange
    const mockQueryClientInstance = {
      invalidateQueries: jest.fn(),
    };
    (useQueryClient as jest.Mock).mockReturnValue(mockQueryClientInstance);
    (useMutation as jest.Mock).mockReturnValue({ mutate: jest.fn() });

    // Act
    useUpdateProduct('prod-001', 'store-789');

    // Assert
    const config = (useMutation as jest.Mock).mock.calls[0][0];

    // Verify mutationFn
    const updates = { price: 120 };
    (ServicesApi.updateProduct as jest.Mock).mockResolvedValueOnce({ success: true });
    await config.mutationFn(updates);
    expect(ServicesApi.updateProduct).toHaveBeenCalledWith('prod-001', updates);

    // Verify onSuccess invalidates expected query keys
    config.onSuccess();
    expect(mockQueryClientInstance.invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.products.detail('prod-001'),
    });
    expect(mockQueryClientInstance.invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.business.products('store-789'),
    });
    expect(mockQueryClientInstance.invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.products.lists(),
    });
    expect(mockQueryClientInstance.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['products', 'search'],
    });
  });

  test('test_useUpdateProduct_withoutStoreId_doesNotInvalidateBusinessProductsKey', () => {
    // Arrange
    const mockQueryClientInstance = {
      invalidateQueries: jest.fn(),
    };
    (useQueryClient as jest.Mock).mockReturnValue(mockQueryClientInstance);
    (useMutation as jest.Mock).mockReturnValue({ mutate: jest.fn() });

    // Act — no storeId provided
    useUpdateProduct('prod-001');

    const config = (useMutation as jest.Mock).mock.calls[0][0];
    config.onSuccess();

    // Assert — product detail and lists are invalidated, but not business products
    expect(mockQueryClientInstance.invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.products.detail('prod-001'),
    });
    const callArgs = mockQueryClientInstance.invalidateQueries.mock.calls.map(
      (c: any[]) => JSON.stringify(c[0])
    );
    const businessProductsKey = JSON.stringify({ queryKey: queryKeys.business.products('') });
    expect(callArgs.some((arg: string) => arg.includes('"business","products"'))).toBe(false);
  });

  // ── useDeleteProduct ─────────────────────────────────────────────────
  test('test_useDeleteProduct_mutationTriggered_invokesDeleteProductAndRemovesCacheEntry', async () => {
    // Arrange
    const mockQueryClientInstance = {
      removeQueries: jest.fn(),
      invalidateQueries: jest.fn(),
    };
    (useQueryClient as jest.Mock).mockReturnValue(mockQueryClientInstance);
    (useMutation as jest.Mock).mockReturnValue({ mutate: jest.fn() });

    // Act
    useDeleteProduct('store-789');

    // Assert
    const config = (useMutation as jest.Mock).mock.calls[0][0];

    // Verify mutationFn
    (ServicesApi.deleteProduct as jest.Mock).mockResolvedValueOnce({ success: true });
    await config.mutationFn('prod-001');
    expect(ServicesApi.deleteProduct).toHaveBeenCalledWith('prod-001', 'store-789');

    // Verify onSuccess removes detail and invalidates listings
    config.onSuccess(undefined, 'prod-001');
    expect(mockQueryClientInstance.removeQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.products.detail('prod-001'),
    });
    expect(mockQueryClientInstance.invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.business.products('store-789'),
    });
    expect(mockQueryClientInstance.invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.products.lists(),
    });
    expect(mockQueryClientInstance.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['products', 'search'],
    });
  });

  test('test_useDeleteProduct_withoutStoreId_removesDetailAndInvalidatesListsWithoutBusinessKey', () => {
    // Arrange
    const mockQueryClientInstance = {
      removeQueries: jest.fn(),
      invalidateQueries: jest.fn(),
    };
    (useQueryClient as jest.Mock).mockReturnValue(mockQueryClientInstance);
    (useMutation as jest.Mock).mockReturnValue({ mutate: jest.fn() });

    // Act — no storeId
    useDeleteProduct();
    const config = (useMutation as jest.Mock).mock.calls[0][0];
    config.onSuccess(undefined, 'prod-001');

    // Assert — business products key not invalidated
    expect(mockQueryClientInstance.removeQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.products.detail('prod-001'),
    });
    const callArgs = mockQueryClientInstance.invalidateQueries.mock.calls.map(
      (c: any[]) => JSON.stringify(c[0])
    );
    expect(callArgs.some((arg: string) => arg.includes('"business","products"'))).toBe(false);
  });

  // ── useUploadProductImages ───────────────────────────────────────────
  test('test_useUploadProductImages_mutationTriggered_invokesUploadAndInvalidatesProductDetail', async () => {
    // Arrange
    const mockQueryClientInstance = {
      invalidateQueries: jest.fn(),
    };
    (useQueryClient as jest.Mock).mockReturnValue(mockQueryClientInstance);
    (useMutation as jest.Mock).mockReturnValue({ mutate: jest.fn() });

    // Act
    useUploadProductImages('prod-001');

    // Assert
    const config = (useMutation as jest.Mock).mock.calls[0][0];

    // Verify mutationFn
    const imageUris = ['file:///img1.jpg', 'file:///img2.jpg'];
    (ServicesApi.uploadProductImages as jest.Mock).mockResolvedValueOnce({ success: true });
    await config.mutationFn(imageUris);
    expect(ServicesApi.uploadProductImages).toHaveBeenCalledWith('prod-001', imageUris);

    // Verify onSuccess invalidates product detail
    config.onSuccess();
    expect(mockQueryClientInstance.invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.products.detail('prod-001'),
    });
  });
});
