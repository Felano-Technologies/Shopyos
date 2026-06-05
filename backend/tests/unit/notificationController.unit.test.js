'use strict';

/**
 * tests/unit/notificationController.unit.test.js
 *
 * Unit tests for notificationController functions.
 * Mocks all repositories.
 * Conforms to guidelines/test.md.
 */

jest.mock('../../services/rabbitmq');
jest.mock('nodemailer');

jest.mock('../../config/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../db/repositories', () => ({
  notifications: {
    getUserNotifications: jest.fn(),
    getUnreadCount: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    deleteNotification: jest.fn(),
    deleteAllNotifications: jest.fn(),
    getUserPreferences: jest.fn(),
    updatePreferences: jest.fn(),
    getNotificationsByType: jest.fn(),
    savePushToken: jest.fn(),
    markNotificationsAsReadByConversation: jest.fn(),
  },
}));

const repositories = require('../../db/repositories');
const {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
  getPreferences,
  updatePreferences,
  getNotificationsByType,
  registerPushToken,
  markReadByConversation,
} = require('../../controllers/notificationController');

function mockReq(overrides = {}) {
  return {
    params: {},
    query: {},
    body: {},
    user: { id: 'user-123' },
    ...overrides,
  };
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('NotificationController Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── getNotifications ───────────────────────────────────────────────
  test('test_getNotifications_validInput_returnsNotificationsAndUnreadCount', async () => {
    // Arrange
    const mockNotifs = [{ id: 'notif-1', title: 'Order updates' }];
    repositories.notifications.getUserNotifications.mockResolvedValueOnce(mockNotifs);
    repositories.notifications.getUnreadCount.mockResolvedValueOnce(3);

    const req = mockReq({ query: { limit: '20', offset: '0', unreadOnly: 'false' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await getNotifications(req, res, next);

    // Assert
    expect(repositories.notifications.getUserNotifications).toHaveBeenCalledWith('user-123', {
      limit: 20,
      offset: 0,
      unreadOnly: false,
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      notifications: mockNotifs,
      unreadCount: 3,
      pagination: { limit: 20, offset: 0, hasMore: false },
    });
  });

  // ── getUnreadCount ──────────────────────────────────────────────────
  test('test_getUnreadCount_validUser_returnsUnreadCountValue', async () => {
    // Arrange
    repositories.notifications.getUnreadCount.mockResolvedValueOnce(5);

    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    // Act
    await getUnreadCount(req, res, next);

    // Assert
    expect(repositories.notifications.getUnreadCount).toHaveBeenCalledWith('user-123');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, unreadCount: 5 });
  });

  // ── markAsRead ──────────────────────────────────────────────────────
  test('test_markAsRead_validInput_marksNotificationRead', async () => {
    // Arrange
    const mockNotif = { id: 'notif-1', is_read: true };
    repositories.notifications.markAsRead.mockResolvedValueOnce(mockNotif);

    const req = mockReq({ params: { notificationId: 'notif-1' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await markAsRead(req, res, next);

    // Assert
    expect(repositories.notifications.markAsRead).toHaveBeenCalledWith('notif-1', 'user-123');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Notification marked as read',
      notification: mockNotif,
    });
  });

  // ── markAllAsRead ───────────────────────────────────────────────────
  test('test_markAllAsRead_validUser_marksAllNotificationsRead', async () => {
    // Arrange
    repositories.notifications.markAllAsRead.mockResolvedValueOnce(8);

    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    // Act
    await markAllAsRead(req, res, next);

    // Assert
    expect(repositories.notifications.markAllAsRead).toHaveBeenCalledWith('user-123');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'All notifications marked as read',
      updatedCount: 8,
    });
  });

  // ── deleteNotification ──────────────────────────────────────────────
  test('test_deleteNotification_validInput_deletesNotification', async () => {
    // Arrange
    repositories.notifications.deleteNotification.mockResolvedValueOnce(undefined);

    const req = mockReq({ params: { notificationId: 'notif-1' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await deleteNotification(req, res, next);

    // Assert
    expect(repositories.notifications.deleteNotification).toHaveBeenCalledWith('notif-1', 'user-123');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Notification deleted successfully' });
  });

  // ── deleteAllNotifications ──────────────────────────────────────────
  test('test_deleteAllNotifications_validUser_deletesAllNotifications', async () => {
    // Arrange
    repositories.notifications.deleteAllNotifications.mockResolvedValueOnce(undefined);

    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    // Act
    await deleteAllNotifications(req, res, next);

    // Assert
    expect(repositories.notifications.deleteAllNotifications).toHaveBeenCalledWith('user-123');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, message: 'All notifications deleted successfully' });
  });

  // ── getPreferences ──────────────────────────────────────────────────
  test('test_getPreferences_validUser_returnsPreferences', async () => {
    // Arrange
    const mockPref = { email_enabled: true };
    repositories.notifications.getUserPreferences.mockResolvedValueOnce(mockPref);

    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    // Act
    await getPreferences(req, res, next);

    // Assert
    expect(repositories.notifications.getUserPreferences).toHaveBeenCalledWith('user-123');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, preferences: mockPref });
  });

  // ── updatePreferences ───────────────────────────────────────────────
  test('test_updatePreferences_noValidFields_returns400BadRequest', async () => {
    // Arrange
    const req = mockReq({ body: { invalid_field: true } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await updatePreferences(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'No valid preference fields provided' });
  });

  test('test_updatePreferences_validFields_updatesAndReturnsUpdatedPreferences', async () => {
    // Arrange
    const updates = { email_enabled: true, push_enabled: false };
    const mockPref = { email_enabled: true, push_enabled: false, sms_enabled: true };
    repositories.notifications.updatePreferences.mockResolvedValueOnce(mockPref);

    const req = mockReq({ body: updates });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await updatePreferences(req, res, next);

    // Assert
    expect(repositories.notifications.updatePreferences).toHaveBeenCalledWith('user-123', {
      email_enabled: true,
      push_enabled: false,
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Preferences updated successfully',
      preferences: mockPref,
    });
  });

  // ── getNotificationsByType ──────────────────────────────────────────
  test('test_getNotificationsByType_validInput_returnsTypedNotifications', async () => {
    // Arrange
    const mockNotifs = [{ id: 'notif-1', type: 'order' }];
    repositories.notifications.getNotificationsByType.mockResolvedValueOnce(mockNotifs);

    const req = mockReq({ params: { type: 'order' }, query: { limit: '10', offset: '5' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await getNotificationsByType(req, res, next);

    // Assert
    expect(repositories.notifications.getNotificationsByType).toHaveBeenCalledWith('user-123', 'order', {
      limit: 10,
      offset: 5,
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      notifications: mockNotifs,
      type: 'order',
    });
  });

  // ── registerPushToken ───────────────────────────────────────────────
  test('test_registerPushToken_missingToken_returns400BadRequest', async () => {
    // Arrange
    const req = mockReq({ body: { deviceName: 'iPhone' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await registerPushToken(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Push token is required' });
  });

  test('test_registerPushToken_validInput_savesTokenAndReturns200Success', async () => {
    // Arrange
    repositories.notifications.savePushToken.mockResolvedValueOnce(undefined);

    const req = mockReq({ body: { token: 'expo-token', deviceName: 'iPhone' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await registerPushToken(req, res, next);

    // Assert
    expect(repositories.notifications.savePushToken).toHaveBeenCalledWith('user-123', 'expo-token', 'iPhone');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Push token registered successfully' });
  });

  // ── markReadByConversation ──────────────────────────────────────────
  test('test_markReadByConversation_validInput_marksNotificationsReadByConversation', async () => {
    // Arrange
    repositories.notifications.markNotificationsAsReadByConversation.mockResolvedValueOnce(3);

    const req = mockReq({ params: { conversationId: 'conv-123' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await markReadByConversation(req, res, next);

    // Assert
    expect(repositories.notifications.markNotificationsAsReadByConversation).toHaveBeenCalledWith('conv-123', 'user-123');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Notifications marked as read',
      updatedCount: 3,
    });
  });
});
