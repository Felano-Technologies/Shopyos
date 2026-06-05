/**
 * __tests__/hooks/useFavorites.test.ts
 *
 * Unit tests for the useFavorites hook system.
 * TanStack query functions and react-native APIs are mocked.
 * Conforms to guidelines/test.md.
 */

// Mock TanStack React Query hooks
const mockUseQuery = jest.fn();
const mockUseMutation = jest.fn();
const mockUseQueryClient = jest.fn();

jest.mock('@tanstack/react-query', () => ({
  useQuery: mockUseQuery,
  useMutation: mockUseMutation,
  useQueryClient: mockUseQueryClient,
}));

// Mock react-native Alert
const mockAlert = jest.fn();
jest.mock('react-native', () => ({
  Alert: { alert: mockAlert },
}));

// Mock favorites API and keys
const mockFavoritesApi = {
  getAll: jest.fn(),
  check: jest.fn(),
  add: jest.fn(),
  remove: jest.fn(),
};

jest.mock('../../lib/query/api', () => ({
  favoritesApi: mockFavoritesApi,
}));

// Mock expo router
jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));

import {
  useFavorites,
  useIsFavorite,
  useAddFavorite,
  useRemoveFavorite,
} from '../../hooks/useFavorites';
import { queryKeys } from '../../lib/query/keys';

describe('useFavorites Hooks Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── useFavorites ────────────────────────────────────────────────────
  test('test_useFavorites_validCall_invokesUseQueryWithCorrectConfig', () => {
    // Arrange
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });

    // Act
    const result = useFavorites();

    // Assert
    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.favorites.list(),
        queryFn: mockFavoritesApi.getAll,
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
      })
    );
    expect(result).toBeDefined();
  });

  // ── useIsFavorite ───────────────────────────────────────────────────
  test('test_useIsFavorite_withProductId_invokesUseQueryWithCorrectConfigAndChecksApi', () => {
    // Arrange
    mockUseQuery.mockReturnValue({ data: true, isLoading: false });

    // Act
    const result = useIsFavorite('prod-123');

    // Assert
    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['favorites', 'check', 'prod-123'],
        enabled: true,
        staleTime: 5 * 60 * 1000,
      })
    );

    const config = mockUseQuery.mock.calls[0][0];
    config.queryFn();
    expect(mockFavoritesApi.check).toHaveBeenCalledWith('prod-123');
    expect(result).toBeDefined();
  });

  test('test_useIsFavorite_emptyProductId_disablesUseQueryQuery', () => {
    // Arrange & Act
    useIsFavorite('');

    // Assert
    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
      })
    );
  });

  // ── useAddFavorite ──────────────────────────────────────────────────
  test('test_useAddFavorite_mutationTriggered_invokesFavoritesApiAddAndOptimisticallyUpdatesCache', async () => {
    // Arrange
    const mockQueryClientInstance = {
      cancelQueries: jest.fn(),
      getQueryData: jest.fn(),
      setQueryData: jest.fn(),
      invalidateQueries: jest.fn(),
    };
    mockUseQueryClient.mockReturnValue(mockQueryClientInstance);
    mockUseMutation.mockReturnValue({ mutate: jest.fn() });

    // Act
    useAddFavorite();

    // Assert
    expect(mockUseMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        mutationFn: expect.any(Function),
        onMutate: expect.any(Function),
        onError: expect.any(Function),
        onSuccess: expect.any(Function),
      })
    );

    const config = mockUseMutation.mock.calls[0][0];

    // Verify mutationFn calls API
    await config.mutationFn('prod-999');
    expect(mockFavoritesApi.add).toHaveBeenCalledWith('prod-999');

    // Verify onMutate performs optimistic cache updates
    const previousFavs = [{ id: 'p1', name: 'Shoes' }];
    const targetProduct = { id: 'prod-999', name: 'Dress' };

    mockQueryClientInstance.getQueryData
      .mockReturnValueOnce(previousFavs)
      .mockReturnValueOnce(targetProduct);

    const context = await config.onMutate('prod-999');

    expect(mockQueryClientInstance.cancelQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.favorites.list(),
    });
    expect(mockQueryClientInstance.setQueryData).toHaveBeenCalled();
    expect(context).toEqual({ previousFavorites: previousFavs });

    // Verify onError rolls back context state
    config.onError(new Error('Failed'), 'prod-999', { previousFavorites: previousFavs });
    expect(mockQueryClientInstance.setQueryData).toHaveBeenCalledWith(
      queryKeys.favorites.list(),
      previousFavs
    );
    expect(mockAlert).toHaveBeenCalledWith('Error', 'Failed to add to favorites');

    // Verify onSuccess invalidates keys
    config.onSuccess();
    expect(mockQueryClientInstance.invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.favorites.list(),
    });
  });

  // ── useRemoveFavorite ───────────────────────────────────────────────
  test('test_useRemoveFavorite_mutationTriggered_invokesFavoritesApiRemoveAndOptimisticallyRemovesFromCache', async () => {
    // Arrange
    const mockQueryClientInstance = {
      cancelQueries: jest.fn(),
      getQueryData: jest.fn(),
      setQueryData: jest.fn(),
      invalidateQueries: jest.fn(),
    };
    mockUseQueryClient.mockReturnValue(mockQueryClientInstance);
    mockUseMutation.mockReturnValue({ mutate: jest.fn() });

    // Act
    useRemoveFavorite();

    // Assert
    expect(mockUseMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        mutationFn: expect.any(Function),
        onMutate: expect.any(Function),
        onError: expect.any(Function),
        onSuccess: expect.any(Function),
      })
    );

    const config = mockUseMutation.mock.calls[0][0];

    // Verify mutationFn
    await config.mutationFn('prod-123');
    expect(mockFavoritesApi.remove).toHaveBeenCalledWith('prod-123');

    // Verify onMutate
    const previousFavs = [{ id: 'prod-123', name: 'Shoes' }, { id: 'p2', name: 'Belt' }];
    mockQueryClientInstance.getQueryData.mockReturnValueOnce(previousFavs);

    const context = await config.onMutate('prod-123');

    expect(mockQueryClientInstance.cancelQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.favorites.list(),
    });
    expect(mockQueryClientInstance.setQueryData).toHaveBeenCalled();
    expect(context).toEqual({ previousFavorites: previousFavs });

    // Verify onError rolls back state
    config.onError({ userMessage: 'Access denied' }, 'prod-123', { previousFavorites: previousFavs });
    expect(mockQueryClientInstance.setQueryData).toHaveBeenCalledWith(
      queryKeys.favorites.list(),
      previousFavs
    );
    expect(mockAlert).toHaveBeenCalledWith('Error', 'Access denied');

    // Verify onSuccess
    config.onSuccess();
    expect(mockQueryClientInstance.invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.favorites.list(),
    });
  });
});
