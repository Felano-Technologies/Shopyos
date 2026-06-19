/**
 * __tests__/hooks/useProfile.test.ts
 *
 * Unit tests for the useProfile hook system.
 * TanStack query functions and Alert are mocked.
 * Conforms to guidelines/test.md.
 */

// Mock useEffect — useProfile calls it outside a React component context in these unit tests
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useEffect: jest.fn(),
}));

// Mock expo-secure-store — no native module available in Jest
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

// Mock auth store — Zustand hooks require a React context; this avoids that
jest.mock('@/store/authStore', () => ({
  useAuthStore: jest.fn((selector: (s: { isAuthenticated: boolean }) => unknown) =>
    selector({ isAuthenticated: true })
  ),
}));

// Mock AsyncStorage native module
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

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

// Mock profile API and keys
jest.mock('@/lib/query/api', () => ({
  __esModule: true,
  profileApi: {
    get: jest.fn(),
    update: jest.fn(),
  },
}));

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { profileApi } from '@/lib/query/api';
import { useProfile, useUpdateProfile } from '../../hooks/useProfile';
import { queryKeys } from '@/lib/query/keys';

describe('useProfile Hooks Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── useProfile ──────────────────────────────────────────────────────
  test('test_useProfile_validCall_invokesUseQueryWithCorrectConfig', () => {
    // Arrange
    const mockProfile = { id: 'u1', name: 'John Doe', email: 'john@example.com' };
    (useQuery as jest.Mock).mockReturnValue({ data: mockProfile, isLoading: false });

    // Act
    const result = useProfile();

    // Assert
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.profile.current(),
        queryFn: profileApi.get,
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
      })
    );
    expect(result.data).toEqual(mockProfile);
  });

  // ── useUpdateProfile ────────────────────────────────────────────────
  test('test_useUpdateProfile_mutationTriggered_invokesApiUpdateAndOptimisticallyUpdatesCache', async () => {
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
    useUpdateProfile();

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
    const updates = { name: 'John New Name' };
    await config.mutationFn(updates);
    expect(profileApi.update).toHaveBeenCalledWith(updates);

    // Verify onMutate performs optimistic cache updates
    const previousProfile = { id: 'u1', name: 'John Doe', email: 'john@example.com' };
    mockQueryClientInstance.getQueryData.mockReturnValueOnce(previousProfile);

    const context = await config.onMutate(updates);

    expect(mockQueryClientInstance.cancelQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.profile.current(),
    });
    expect(mockQueryClientInstance.setQueryData).toHaveBeenCalled();
    expect(context).toEqual({ previousProfile });

    // Verify onError rolls back context state
    config.onError(new Error('Failed'), updates, { previousProfile });
    expect(mockQueryClientInstance.setQueryData).toHaveBeenCalledWith(
      queryKeys.profile.current(),
      previousProfile
    );
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to update profile');

    // Verify onSuccess invalidates keys and shows success alert
    config.onSuccess();
    expect(mockQueryClientInstance.invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.profile.current(),
    });
    expect(Alert.alert).toHaveBeenCalledWith('Success', 'Profile updated successfully');
  });
});
