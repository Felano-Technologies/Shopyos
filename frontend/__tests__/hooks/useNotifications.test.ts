/**
 * __tests__/hooks/useNotifications.test.ts
 *
 * Unit tests for the useNotifications hooks system.
 * TanStack query, socket.io-client, expo-av, expo-haptics, and InAppToast are mocked.
 * Conforms to guidelines/test.md.
 */

// Mock TanStack React Query hooks
jest.mock('@tanstack/react-query', () => ({
  __esModule: true,
  useQuery: jest.fn(),
  useMutation: jest.fn(),
  useQueryClient: jest.fn(),
}));

// Mock API service
jest.mock('@/services/api', () => ({
  __esModule: true,
  secureStorage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
  getNotifications: jest.fn(),
  getUnreadNotificationCount: jest.fn(),
  markNotificationRead: jest.fn(),
  markAllNotificationsRead: jest.fn(),
}));

// Mock socket service
jest.mock('@/services/socket', () => ({
  __esModule: true,
  socketService: {
    connect: jest.fn(),
  },
}));

// Mock expo router & hooks
jest.mock('expo-router', () => ({
  __esModule: true,
  useRouter: jest.fn(),
  usePathname: jest.fn().mockReturnValue('/home'),
}));

// Mock expo-av Sound
const mockSoundInstance = {
  setOnPlaybackStatusUpdate: jest.fn(),
  unloadAsync: jest.fn(),
};
jest.mock('expo-av', () => ({
  __esModule: true,
  Audio: {
    Sound: {
      createAsync: jest.fn().mockResolvedValue({ sound: mockSoundInstance }),
    },
  },
}));

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  __esModule: true,
  NotificationFeedbackType: {
    Success: 'success',
  },
  notificationAsync: jest.fn().mockResolvedValue(undefined),
}));

// Mock CustomInAppToast
jest.mock('@/components/InAppToastHost', () => ({
  __esModule: true,
  CustomInAppToast: {
    show: jest.fn(),
  },
}));

import React from 'react';
import { render, act } from '@testing-library/react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as ApiService from '@/services/api';
import { socketService } from '@/services/socket';
import { usePathname } from 'expo-router';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { CustomInAppToast } from '@/components/InAppToastHost';

import {
  useNotifications,
  useUnreadNotificationCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '../../hooks/useNotifications';
import { queryKeys } from '@/lib/query/keys';

const mockSocket = {
  on: jest.fn(),
  off: jest.fn(),
};

// Capture hook output via test components (renderHook doesn't flush effects in React 19)
const mockQueryClient = { invalidateQueries: jest.fn(), setQueryData: jest.fn() };
let notifResult: any = null;
let unreadResult: any = null;
function NotifHook() { notifResult = useNotifications(); return null; }
function UnreadHook({ realtime }: { realtime: boolean }) {
  unreadResult = useUnreadNotificationCount(realtime); return null;
}

describe('useNotifications Hooks Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    notifResult = null;
    unreadResult = null;
    (socketService.connect as jest.Mock).mockResolvedValue(mockSocket);
    // Provide a valid queryClient so the hook's useEffect doesn't crash
    (useQueryClient as jest.Mock).mockReturnValue(mockQueryClient);
  });

  // ── useNotifications ────────────────────────────────────────────────
  test('test_useNotifications_validCall_invokesUseQueryWithCorrectConfigAndFetchesResponse', async () => {
    // Arrange
    (useQuery as jest.Mock).mockReturnValue({ data: [], isLoading: false });

    // Act — render via component wrapper so useEffect runs correctly in React 19
    await act(async () => {
      render(<NotifHook />);
      await new Promise(process.nextTick);
    });

    // Assert
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.notifications.list(),
        staleTime: 2 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
      })
    );
    expect(notifResult).toBeDefined();

    // Test queryFn behavior when token is missing
    const queryFn = (useQuery as jest.Mock).mock.calls[0][0].queryFn;
    (ApiService.secureStorage.getItem as jest.Mock).mockResolvedValueOnce(null); // userToken
    (ApiService.secureStorage.getItem as jest.Mock).mockResolvedValueOnce(null); // businessToken
    
    const emptyRes = await queryFn();
    expect(emptyRes).toEqual({ notifications: [], unreadCount: 0 });

    // Test queryFn behavior when token is present
    (ApiService.secureStorage.getItem as jest.Mock).mockResolvedValueOnce('user-tok');
    (ApiService.getNotifications as jest.Mock).mockResolvedValueOnce({ notifications: [{ id: '1' }] });
    const apiRes = await queryFn();
    expect(apiRes).toEqual({ notifications: [{ id: '1' }] });
  });

  // ── useUnreadNotificationCount ──────────────────────────────────────
  test('test_useUnreadNotificationCount_validCall_invokesUseQueryWithCorrectConfigAndQueriesCount', async () => {
    // Arrange
    (useQuery as jest.Mock).mockReturnValue({ data: { unreadCount: 5 }, isLoading: false });

    // Act — render via component wrapper so useEffect runs correctly in React 19
    await act(async () => {
      render(<UnreadHook realtime={false} />);
      await new Promise(process.nextTick);
    });

    // Assert
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.notifications.unreadCount(),
        refetchOnMount: 'always',
        staleTime: 1 * 60 * 1000,
        gcTime: 5 * 60 * 1000,
      })
    );
    expect(unreadResult).toBeDefined();

    // Test queryFn behavior when token is missing
    const queryFn = (useQuery as jest.Mock).mock.calls[0][0].queryFn;
    (ApiService.secureStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
    (ApiService.secureStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
    const emptyRes = await queryFn();
    expect(emptyRes).toEqual({ unreadCount: 0 });

    // Test queryFn behavior when token is present
    (ApiService.secureStorage.getItem as jest.Mock).mockResolvedValueOnce('biz-tok');
    (ApiService.getUnreadNotificationCount as jest.Mock).mockResolvedValueOnce({ unreadCount: 3 });
    const apiRes = await queryFn();
    expect(apiRes).toEqual({ unreadCount: 3 });
  });

  // ── useMarkNotificationRead ─────────────────────────────────────────
  test('test_useMarkNotificationRead_mutationTriggered_invokesMarkReadAndUpdatesCacheOptimistically', async () => {
    // Arrange
    const mockQueryClientInstance = {
      setQueryData: jest.fn(),
      invalidateQueries: jest.fn(),
    };
    (useQueryClient as jest.Mock).mockReturnValue(mockQueryClientInstance);
    (useMutation as jest.Mock).mockReturnValue({ mutate: jest.fn() });

    // Act
    useMarkNotificationRead();

    // Assert
    expect(useMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        mutationFn: expect.any(Function),
        onSuccess: expect.any(Function),
      })
    );

    const config = (useMutation as jest.Mock).mock.calls[0][0];

    // Verify mutationFn calls API
    (ApiService.markNotificationRead as jest.Mock).mockResolvedValueOnce({ success: true });
    await config.mutationFn('notif-123');
    expect(ApiService.markNotificationRead).toHaveBeenCalledWith('notif-123');

    // Verify onSuccess cache updates
    const prevList = { notifications: [{ id: 'notif-123', is_read: false }, { id: 'other', is_read: false }] };
    mockQueryClientInstance.setQueryData.mockImplementation((key: any, updater: any) => {
      if (typeof updater === 'function') {
        if (JSON.stringify(key) === JSON.stringify(queryKeys.notifications.list())) {
          const updated = updater(prevList);
          expect(updated.notifications[0].is_read).toBe(true);
          expect(updated.notifications[1].is_read).toBe(false);
        } else if (JSON.stringify(key) === JSON.stringify(queryKeys.notifications.unreadCount())) {
          const updated = updater({ unreadCount: 3 });
          expect(updated.unreadCount).toBe(2);
        }
      }
    });

    config.onSuccess({ success: true }, 'notif-123');

    expect(mockQueryClientInstance.invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.notifications.list(),
    });
    expect(mockQueryClientInstance.invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.notifications.unreadCount(),
    });
  });

  // ── useMarkAllNotificationsRead ─────────────────────────────────────
  test('test_useMarkAllNotificationsRead_mutationTriggered_invokesMarkAllReadAndClearsUnreadBadge', async () => {
    // Arrange
    const mockQueryClientInstance = {
      setQueryData: jest.fn(),
      invalidateQueries: jest.fn(),
    };
    (useQueryClient as jest.Mock).mockReturnValue(mockQueryClientInstance);
    (useMutation as jest.Mock).mockReturnValue({ mutate: jest.fn() });

    // Act
    useMarkAllNotificationsRead();

    // Assert
    const config = (useMutation as jest.Mock).mock.calls[0][0];

    // Verify mutationFn calls API
    (ApiService.markAllNotificationsRead as jest.Mock).mockResolvedValueOnce({ success: true });
    await config.mutationFn();
    expect(ApiService.markAllNotificationsRead).toHaveBeenCalled();

    // Verify onSuccess cache manipulation
    const prevList = { notifications: [{ id: '1', is_read: false }, { id: '2', is_read: false }] };
    mockQueryClientInstance.setQueryData.mockImplementation((key: any, updater: any) => {
      if (typeof updater === 'function') {
        if (JSON.stringify(key) === JSON.stringify(queryKeys.notifications.list())) {
          const updated = updater(prevList);
          expect(updated.notifications[0].is_read).toBe(true);
          expect(updated.notifications[1].is_read).toBe(true);
        }
      } else {
        if (JSON.stringify(key) === JSON.stringify(queryKeys.notifications.unreadCount())) {
          expect(updater.unreadCount).toBe(0);
        }
      }
    });

    config.onSuccess();

    expect(mockQueryClientInstance.invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.notifications.list(),
    });
    expect(mockQueryClientInstance.invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.notifications.unreadCount(),
    });
  });
});
