/**
 * __tests__/hooks/useProducts.test.ts
 *
 * Unit tests for the useProducts hooks system.
 * TanStack query functions and productsApi are mocked.
 * Conforms to guidelines/test.md.
 */

// Mock auth store — Zustand hooks require a React context; this avoids that
jest.mock('@/store/authStore', () => ({
  useAuthStore: jest.fn((selector: (s: { isAuthenticated: boolean }) => unknown) =>
    selector({ isAuthenticated: true })
  ),
}));

// Mock TanStack React Query hooks — useInfiniteQuery is needed for useInfiniteProducts
jest.mock('@tanstack/react-query', () => ({
  __esModule: true,
  useQuery: jest.fn(),
  useInfiniteQuery: jest.fn(),
}));

// Mock products API from lib/query/api
jest.mock('@/lib/query/api', () => ({
  __esModule: true,
  productsApi: {
    search: jest.fn(),
    getById: jest.fn(),
  },
}));

import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { productsApi } from '@/lib/query/api';
import {
  useProducts,
  useInfiniteProducts,
  useProduct,
  useProductSearch,
} from '../../hooks/useProducts';
import { queryKeys } from '@/lib/query/keys';
import type { ProductFilters } from '@/lib/query/keys';

describe('useProducts Hooks Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── useProducts ──────────────────────────────────────────────────────
  test('test_useProducts_noFilters_invokesUseQueryWithCorrectConfig', () => {
    // Arrange
    (useQuery as jest.Mock).mockReturnValue({ data: { products: [] }, isLoading: false });

    // Act
    const result = useProducts();

    // Assert
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.products.list(undefined),
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
      })
    );

    // Verify queryFn delegates to productsApi.search with default limit
    const config = (useQuery as jest.Mock).mock.calls[0][0];
    config.queryFn();
    expect(productsApi.search).toHaveBeenCalledWith(undefined, undefined, 20, 0);
    expect(result).toBeDefined();
  });

  test('test_useProducts_withFilters_passesFiltersToQueryKeyAndQueryFn', () => {
    // Arrange
    const filters: ProductFilters = { category: 'electronics', minPrice: 50 };
    (useQuery as jest.Mock).mockReturnValue({ data: { products: [] }, isLoading: false });

    // Act
    useProducts(filters, 10);

    // Assert
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.products.list(filters),
      })
    );

    const config = (useQuery as jest.Mock).mock.calls[0][0];
    config.queryFn();
    expect(productsApi.search).toHaveBeenCalledWith(undefined, filters, 10, 0);
  });

  // ── useInfiniteProducts ──────────────────────────────────────────────
  test('test_useInfiniteProducts_noFilters_invokesUseInfiniteQueryWithCorrectConfig', () => {
    // Arrange
    (useInfiniteQuery as jest.Mock).mockReturnValue({ data: undefined, isLoading: false });

    // Act
    const result = useInfiniteProducts();

    // Assert
    expect(useInfiniteQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.products.infinite(undefined),
        initialPageParam: 0,
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
      })
    );
    expect(result).toBeDefined();
  });

  test('test_useInfiniteProducts_queryFn_callsProductsApiSearchWithPageParam', () => {
    // Arrange
    const filters: ProductFilters = { sortBy: 'newest' };
    (useInfiniteQuery as jest.Mock).mockReturnValue({ data: undefined, isLoading: false });

    // Act
    useInfiniteProducts(filters, 15);

    // Assert — queryFn receives a pageParam and forwards it as offset
    const config = (useInfiniteQuery as jest.Mock).mock.calls[0][0];
    config.queryFn({ pageParam: 30 });
    expect(productsApi.search).toHaveBeenCalledWith(undefined, filters, 15, 30);
  });

  test('test_useInfiniteProducts_getNextPageParam_returnsNextOffsetWhenPageIsFull', () => {
    // Arrange
    (useInfiniteQuery as jest.Mock).mockReturnValue({ data: undefined, isLoading: false });
    useInfiniteProducts(undefined, 20);
    const config = (useInfiniteQuery as jest.Mock).mock.calls[0][0];

    // Full page — should return next offset
    const fullPage = { success: true, products: new Array(20).fill({ id: 'p' }) };
    const allPages = [fullPage, fullPage]; // 2 pages already loaded
    const nextParam = config.getNextPageParam(fullPage, allPages);
    expect(nextParam).toBe(40); // allPages.length (2) * limit (20)
  });

  test('test_useInfiniteProducts_getNextPageParam_returnsUndefinedWhenPageIsPartial', () => {
    // Arrange
    (useInfiniteQuery as jest.Mock).mockReturnValue({ data: undefined, isLoading: false });
    useInfiniteProducts(undefined, 20);
    const config = (useInfiniteQuery as jest.Mock).mock.calls[0][0];

    // Partial page (fewer products than limit) — no more pages
    const partialPage = { success: true, products: new Array(5).fill({ id: 'p' }) };
    const nextParam = config.getNextPageParam(partialPage, [partialPage]);
    expect(nextParam).toBeUndefined();
  });

  test('test_useInfiniteProducts_getNextPageParam_returnsUndefinedWhenSuccessIsFalse', () => {
    // Arrange
    (useInfiniteQuery as jest.Mock).mockReturnValue({ data: undefined, isLoading: false });
    useInfiniteProducts(undefined, 20);
    const config = (useInfiniteQuery as jest.Mock).mock.calls[0][0];

    // success = false — no more pages
    const errorPage = { success: false, products: [] };
    const nextParam = config.getNextPageParam(errorPage, [errorPage]);
    expect(nextParam).toBeUndefined();
  });

  // ── useProduct ───────────────────────────────────────────────────────
  test('test_useProduct_withId_invokesUseQueryWithCorrectConfigAndEnablesQuery', () => {
    // Arrange
    (useQuery as jest.Mock).mockReturnValue({ data: { id: 'prod-123' }, isLoading: false });

    // Act
    const result = useProduct('prod-123');

    // Assert
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.products.detail('prod-123'),
        enabled: true,
        staleTime: 10 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
      })
    );

    const config = (useQuery as jest.Mock).mock.calls[0][0];
    config.queryFn();
    expect(productsApi.getById).toHaveBeenCalledWith('prod-123');
    expect(result).toBeDefined();
  });

  test('test_useProduct_emptyId_disablesQuery', () => {
    // Arrange & Act
    useProduct('');

    // Assert
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
      })
    );
  });

  test('test_useProduct_withOptions_mergesOptionsIntoQueryConfig', () => {
    // Arrange
    (useQuery as jest.Mock).mockReturnValue({ data: null, isLoading: false });
    const extraOptions = { refetchOnMount: true as const };

    // Act
    useProduct('prod-456', extraOptions);

    // Assert — extra options are spread onto the config
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.products.detail('prod-456'),
        refetchOnMount: true,
      })
    );
  });

  // ── useProductSearch ─────────────────────────────────────────────────
  test('test_useProductSearch_queryAtLeastTwoChars_enablesQueryAndCallsApi', () => {
    // Arrange
    (useQuery as jest.Mock).mockReturnValue({ data: { products: [] }, isLoading: false });

    // Act
    const result = useProductSearch('shoe');

    // Assert
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.products.search('shoe', undefined),
        enabled: true,
        staleTime: 5 * 60 * 1000,
        gcTime: 15 * 60 * 1000,
      })
    );

    const config = (useQuery as jest.Mock).mock.calls[0][0];
    config.queryFn();
    expect(productsApi.search).toHaveBeenCalledWith('shoe', undefined, 20, 0);
    expect(result).toBeDefined();
  });

  test('test_useProductSearch_queryLessThanTwoChars_disablesQuery', () => {
    // Arrange & Act
    useProductSearch('s');

    // Assert
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
      })
    );
  });

  test('test_useProductSearch_emptyQuery_disablesQuery', () => {
    // Arrange & Act
    useProductSearch('');

    // Assert
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
      })
    );
  });

  test('test_useProductSearch_withFiltersAndCustomLimit_passesAllArgsToQueryFn', () => {
    // Arrange
    const filters: ProductFilters = { category: 'fashion', maxPrice: 200 };
    (useQuery as jest.Mock).mockReturnValue({ data: { products: [] }, isLoading: false });

    // Act
    useProductSearch('dress', filters, 30);

    // Assert
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.products.search('dress', filters),
      })
    );

    const config = (useQuery as jest.Mock).mock.calls[0][0];
    config.queryFn();
    expect(productsApi.search).toHaveBeenCalledWith('dress', filters, 30, 0);
  });
});
