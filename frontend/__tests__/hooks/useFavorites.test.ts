/**
 * __tests__/hooks/useFavorites.test.ts
 *
 * Unit tests for the useFavorites hook system.
 * TanStack query functions and react-native APIs are mocked.
 * Conforms to guidelines/test.md.
 */

// Mock TanStack React Query hooks
jest.mock('@tanstack/react-query', () => ({
  __esModule: true,
  useQuery: jest.fn(),
  useMutation: jest.fn(),
  useQueryClient: jest.fn(),
}));

// Mock react-native Alert
jest.mock('react-native', () => ({
  __esModule: true,
  Alert: { alert: jest.fn() },
}));

// Mock favorites API and keys
jest.mock('@/lib/query/api', () => ({
  __esModule: true,
  favoritesApi: {
    getAll: jest.fn(),
    check: jest.fn(),
    add: jest.fn(),
    remove: jest.fn(),
  },
}));

// Mock expo router
jest.mock('expo-router', () => ({
  __esModule: true,
  router: { replace: jest.fn() },
}));

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { favoritesApi } from '@/lib/query/api';
import {
  useFavorites,
  useIsFavorite,
  useAddFavorite,
  useRemoveFavorite,
} from '../../hooks/useFavorites';
import { queryKeys } from '@/lib/query/keys';

describe('useFavorites Hooks Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── useFavorites ────────────────────────────────────────────────────
  test('test_useFavorites_validCall_invokesUseQueryWithCorrectConfig', () => {
    // Arrange
    (useQuery as jest.Mock).mockReturnValue({ data: [], isLoading: false });

    // Act
    const result = useFavorites();

    // Assert
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.favorites.list(),
        queryFn: favoritesApi.getAll,
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
      })
    );
    expect(result).toBeDefined();
  });

  // ── useIsFavorite ───────────────────────────────────────────────────
  test('test_useIsFavorite_withProductId_invokesUseQueryWithCorrectConfigAndChecksApi', () => {
    // Arrange
    (useQuery as jest.Mock).mockReturnValue({ data: true, isLoading: false });

    // Act
    const result = useIsFavorite('prod-123');

    // Assert
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['favorites', 'check', 'prod-123'],
        enabled: true,
        staleTime: 5 * 60 * 1000,
      })
    );

    const config = (useQuery as jest.Mock).mock.calls[0][0];
    config.queryFn();
    expect(favoritesApi.check).toHaveBeenCalledWith('prod-123');
    expect(result).toBeDefined();
  });

  test('test_useIsFavorite_emptyProductId_disablesUseQueryQuery', () => {
    // Arrange & Act
    useIsFavorite('');

    // Assert
    expect(useQuery).toHaveBeenCalledWith(
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
    (useQueryClient as jest.Mock).mockReturnValue(mockQueryClientInstance);
    (useMutation as jest.Mock).mockReturnValue({ mutate: jest.fn() });

    // Act
    useAddFavorite();

    // Assert
    expect(useMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        mutationFn: expect.any(Function),
        onMutate: expect.any(Function),
        onError: expect.any(Function),
        onSuccess: expect.any(Function),
      })
    );

    const config = (useMutation as jest.Mock).mock.calls[0][0];

    // Verify mutationFn calls API
    await config.mutationFn('prod-999');
    expect(favoritesApi.add).toHaveBeenCalledWith('prod-999');

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
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to add to favorites');

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
    (useQueryClient as jest.Mock).mockReturnValue(mockQueryClientInstance);
    (useMutation as jest.Mock).mockReturnValue({ mutate: jest.fn() });

    // Act
    useRemoveFavorite();

    // Assert
    expect(useMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        mutationFn: expect.any(Function),
        onMutate: expect.any(Function),
        onError: expect.any(Function),
        onSuccess: expect.any(Function),
      })
    );

    const config = (useMutation as jest.Mock).mock.calls[0][0];

    // Verify mutationFn
    await config.mutationFn('prod-123');
    expect(favoritesApi.remove).toHaveBeenCalledWith('prod-123');

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
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Access denied');

    // Verify onSuccess
    config.onSuccess();
    expect(mockQueryClientInstance.invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.favorites.list(),
    });
  });
});
