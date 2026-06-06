/**
 * __tests__/services/notifications.service.test.ts
 *
 * Unit tests for the notifications service layer.
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
    put: jest.fn(),
    defaults: { headers: { common: {} } },
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  },
  extractErrorMessage: (err: any) => err?.message || 'Error',
  API_URL: 'http://localhost:5000/api/v1/',
  baseURL: 'http://localhost:5000',
  secureStorage: { getItem: jest.fn() },
  storage: { getItem: jest.fn() },
  CustomInAppToast: { show: jest.fn() },
}));

import { api } from '../../services/client';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadNotificationCount,
  getNotificationPreferences,
  updateNotificationPreferences,
  markNotificationsReadByConversation,
} from '../../services/notifications';

describe('Notifications Service Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── getNotifications ────────────────────────────────────────────────
  describe('getNotifications', () => {
    test('test_getNotifications_validCall_returnsNotifications', async () => {
      // Arrange
      const mockData = { success: true, data: [{ id: 'notif-1', title: 'New Promo' }] };
      (api.get as jest.Mock).mockResolvedValueOnce({ data: mockData });

      // Act
      const result = await getNotifications();

      // Assert
      expect(api.get).toHaveBeenCalledWith('/notifications');
      expect(result).toEqual(mockData);
    });

    test('test_getNotifications_apiFails_throwsError', async () => {
      // Arrange
      (api.get as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      // Act & Assert
      await expect(getNotifications()).rejects.toThrow('Network error');
    });
  });

  // ── markNotificationRead ────────────────────────────────────────────
  describe('markNotificationRead', () => {
    test('test_markNotificationRead_validId_returnsSuccessResponse', async () => {
      // Arrange
      const mockRes = { success: true, message: 'Marked read' };
      (api.put as jest.Mock).mockResolvedValueOnce({ data: mockRes });

      // Act
      const result = await markNotificationRead('notif-123');

      // Assert
      expect(api.put).toHaveBeenCalledWith('/notifications/notif-123/read');
      expect(result).toEqual(mockRes);
    });
  });

  // ── markAllNotificationsRead ────────────────────────────────────────
  describe('markAllNotificationsRead', () => {
    test('test_markAllNotificationsRead_validCall_returnsSuccessResponse', async () => {
      // Arrange
      const mockRes = { success: true, message: 'All read' };
      (api.put as jest.Mock).mockResolvedValueOnce({ data: mockRes });

      // Act
      const result = await markAllNotificationsRead();

      // Assert
      expect(api.put).toHaveBeenCalledWith('/notifications/read-all');
      expect(result).toEqual(mockRes);
    });
  });

  // ── getUnreadNotificationCount ──────────────────────────────────────
  describe('getUnreadNotificationCount', () => {
    test('test_getUnreadNotificationCount_validCall_returnsCountObject', async () => {
      // Arrange
      const mockRes = { success: true, count: 5 };
      (api.get as jest.Mock).mockResolvedValueOnce({ data: mockRes });

      // Act
      const result = await getUnreadNotificationCount();

      // Assert
      expect(api.get).toHaveBeenCalledWith('/notifications/unread-count');
      expect(result).toEqual(mockRes);
    });
  });

  // ── getNotificationPreferences ──────────────────────────────────────
  describe('getNotificationPreferences', () => {
    test('test_getNotificationPreferences_validCall_returnsPreferencesObject', async () => {
      // Arrange
      const mockPrefs = { email: true, push: false, sms: true };
      (api.get as jest.Mock).mockResolvedValueOnce({ data: { success: true, preferences: mockPrefs } });

      // Act
      const result = await getNotificationPreferences();

      // Assert
      expect(api.get).toHaveBeenCalledWith('/notifications/preferences');
      expect(result.preferences).toEqual(mockPrefs);
    });
  });

  // ── updateNotificationPreferences ───────────────────────────────────
  describe('updateNotificationPreferences', () => {
    test('test_updateNotificationPreferences_validInput_returnsUpdatedPreferences', async () => {
      // Arrange
      const updatedPrefs = { email: false, push: true };
      const mockRes = { success: true, preferences: updatedPrefs };
      (api.put as jest.Mock).mockResolvedValueOnce({ data: mockRes });

      // Act
      const result = await updateNotificationPreferences(updatedPrefs);

      // Assert
      expect(api.put).toHaveBeenCalledWith('/notifications/preferences', updatedPrefs);
      expect(result).toEqual(mockRes);
    });
  });

  // ── markNotificationsReadByConversation ─────────────────────────────
  describe('markNotificationsReadByConversation', () => {
    test('test_markNotificationsReadByConversation_validId_returnsSuccessResponse', async () => {
      // Arrange
      const mockRes = { success: true, message: 'Conversation read' };
      (api.put as jest.Mock).mockResolvedValueOnce({ data: mockRes });

      // Act
      const result = await markNotificationsReadByConversation('conv-123');

      // Assert
      expect(api.put).toHaveBeenCalledWith('/notifications/read-by-conversation/conv-123');
      expect(result).toEqual(mockRes);
    });
  });
});
