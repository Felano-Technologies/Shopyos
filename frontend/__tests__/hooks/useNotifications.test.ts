/**
 * __tests__/hooks/useNotifications.test.ts
 *
 * Unit tests for the useNotifications hooks system.
 * TanStack query, socket.io-client, expo-av, expo-haptics, and InAppToast are mocked.
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

// Mock API service
const mockSecureStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};

const mockApiService = {
  secureStorage: mockSecureStorage,
  getNotifications: jest.fn(),
  getUnreadNotificationCount: jest.fn(),
  markNotificationRead: jest.fn(),
  markAllNotificationsRead: jest.fn(),
};

jest.mock('@/services/api', () => mockApiService);

// Mock socket service
const mockSocket = {
  on: jest.fn(),
  off: jest.fn(),
};
const mockSocketService = {
  connect: jest.fn().mockResolvedValue(mockSocket),
};
jest.mock('@/services/socket', () => ({
  socketService: mockSocketService,
}));

// Mock expo router & hooks
jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn().mockReturnValue('/home'),
}));

// Mock expo-av Sound
const mockSoundInstance = {
  setOnPlaybackStatusUpdate: jest.fn(),
  unloadAsync: jest.fn(),
};
const mockPlaySound = jest.fn().mockResolvedValue({ sound: mockSoundInstance });
jest.mock('expo-av', () => ({
  Audio: {
    Sound: {
      createAsync: mockPlaySound,
    },
  },
}));

// Mock expo-haptics
const mockHapticsNotification = jest.fn().mockResolvedValue(undefined);
jest.mock('expo-haptics', () => ({
  NotificationFeedbackType: {
    Success: 'success',
  },
  notificationAsync: mockHapticsNotification,
}));

// Mock CustomInAppToast
const mockToastShow = jest.fn();
jest.mock('@/components/InAppToastHost', () => ({
  CustomInAppToast: {
    show: mockToastShow,
  },
}));

// Import components to test
import {
  useNotifications,
  useUnreadNotificationCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '../../hooks/useNotifications';
import { queryKeys } from '../../lib/query/keys';

describe('useNotifications Hooks Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── useNotifications ────────────────────────────────────────────────
  test('test_useNotifications_validCall_invokesUseQueryWithCorrectConfigAndFetchesResponse', async () => {
    // Arrange
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });

    // Act
    const result = useNotifications();

    // Assert
    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.notifications.list(),
        staleTime: 2 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
      })
    );
    expect(result).toBeDefined();

    // Test queryFn behavior when token is missing
    const queryFn = mockUseQuery.mock.calls[0][0].queryFn;
    mockSecureStorage.getItem.mockResolvedValueOnce(null); // userToken
    mockSecureStorage.getItem.mockResolvedValueOnce(null); // businessToken
    
    const emptyRes = await queryFn();
    expect(emptyRes).toEqual({ notifications: [], unreadCount: 0 });

    // Test queryFn behavior when token is present
    mockSecureStorage.getItem.mockResolvedValueOnce('user-tok');
    mockApiService.getNotifications.mockResolvedValueOnce({ notifications: [{ id: '1' }] });
    const apiRes = await queryFn();
    expect(apiRes).toEqual({ notifications: [{ id: '1' }] });
  });

  // ── useUnreadNotificationCount ──────────────────────────────────────
  test('test_useUnreadNotificationCount_validCall_invokesUseQueryWithCorrectConfigAndQueriesCount', async () => {
    // Arrange
    mockUseQuery.mockReturnValue({ data: { unreadCount: 5 }, isLoading: false });

    // Act
    const result = useUnreadNotificationCount(false); // Disable real-time for config check

    // Assert
    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.notifications.unreadCount(),
        refetchOnMount: 'always',
        staleTime: 1 * 60 * 1000,
        gcTime: 5 * 60 * 1000,
      })
    );
    expect(result).toBeDefined();

    // Test queryFn behavior when token is missing
    const queryFn = mockUseQuery.mock.calls[0][0].queryFn;
    mockSecureStorage.getItem.mockResolvedValueOnce(null);
    mockSecureStorage.getItem.mockResolvedValueOnce(null);
    const emptyRes = await queryFn();
    expect(emptyRes).toEqual({ unreadCount: 0 });

    // Test queryFn behavior when token is present
    mockSecureStorage.getItem.mockResolvedValueOnce('biz-tok');
    mockApiService.getUnreadNotificationCount.mockResolvedValueOnce({ unreadCount: 3 });
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
    mockUseQueryClient.mockReturnValue(mockQueryClientInstance);
    mockUseMutation.mockReturnValue({ mutate: jest.fn() });

    // Act
    useMarkNotificationRead();

    // Assert
    expect(mockUseMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        mutationFn: expect.any(Function),
        onSuccess: expect.any(Function),
      })
    );

    const config = mockUseMutation.mock.calls[0][0];

    // Verify mutationFn calls API
    mockApiService.markNotificationRead.mockResolvedValueOnce({ success: true });
    await config.mutationFn('notif-123');
    expect(mockApiService.markNotificationRead).toHaveBeenCalledWith('notif-123');

    // Verify onSuccess cache updates
    const prevList = { notifications: [{ id: 'notif-123', is_read: false }, { id: 'other', is_read: false }] };
    mockQueryClientInstance.setQueryData.mockImplementation((key, updater) => {
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
    mockUseQueryClient.mockReturnValue(mockQueryClientInstance);
    mockUseMutation.mockReturnValue({ mutate: jest.fn() });

    // Act
    useMarkAllNotificationsRead();

    // Assert
    const config = mockUseMutation.mock.calls[0][0];

    // Verify mutationFn calls API
    mockApiService.markAllNotificationsRead.mockResolvedValueOnce({ success: true });
    await config.mutationFn();
    expect(mockApiService.markAllNotificationsRead).toHaveBeenCalled();

    // Verify onSuccess cache manipulation
    const prevList = { notifications: [{ id: '1', is_read: false }, { id: '2', is_read: false }] };
    mockQueryClientInstance.setQueryData.mockImplementation((key, updater) => {
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
