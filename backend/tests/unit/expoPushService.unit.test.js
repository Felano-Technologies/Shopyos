'use strict';

jest.mock('../../config/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockIsExpoPushToken = jest.fn();
const mockChunkPushNotifications = jest.fn();
const mockSendPushNotificationsAsync = jest.fn();

jest.mock('expo-server-sdk', () => ({
  Expo: Object.assign(
    jest.fn().mockImplementation(() => ({
      chunkPushNotifications: mockChunkPushNotifications,
      sendPushNotificationsAsync: mockSendPushNotificationsAsync,
    })),
    { isExpoPushToken: mockIsExpoPushToken }
  ),
}));

jest.mock('../../db/repositories', () => ({
  notifications: {
    getUserPushTokens: jest.fn(),
    removePushToken: jest.fn(),
  },
}));

jest.mock('../../utils/pushConfig', () => ({
  getChannelId: jest.fn().mockReturnValue('orders'),
  getTtlSeconds: jest.fn().mockReturnValue(86400),
}));

const _repositories = require('../../db/repositories');

describe('ExpoPushService', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Re-mock after resetModules
    jest.mock('../../config/logger', () => ({
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
    }));
    jest.mock('expo-server-sdk', () => ({
      Expo: Object.assign(
        jest.fn().mockImplementation(() => ({
          chunkPushNotifications: mockChunkPushNotifications,
          sendPushNotificationsAsync: mockSendPushNotificationsAsync,
        })),
        { isExpoPushToken: mockIsExpoPushToken }
      ),
    }));
    jest.mock('../../db/repositories', () => ({
      notifications: {
        getUserPushTokens: jest.fn(),
        removePushToken: jest.fn(),
      },
    }));
    jest.mock('../../utils/pushConfig', () => ({
      getChannelId: jest.fn().mockReturnValue('orders'),
      getTtlSeconds: jest.fn().mockReturnValue(86400),
    }));

    service = require('../../services/expoPushService');
  });

  const VALID_TOKEN = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]';
  const PAYLOAD = { title: 'Order update', body: 'Your order is on its way', eventType: 'order_update' };

  test('returns false when user has no push tokens', async () => {
    require('../../db/repositories').notifications.getUserPushTokens.mockResolvedValueOnce([]);
    const result = await service.sendPushNotificationToUser('user-1', PAYLOAD);
    expect(result).toBe(false);
  });

  test('returns false when user tokens list is null', async () => {
    require('../../db/repositories').notifications.getUserPushTokens.mockResolvedValueOnce(null);
    const result = await service.sendPushNotificationToUser('user-1', PAYLOAD);
    expect(result).toBe(false);
  });

  test('removes invalid tokens and returns false if none valid', async () => {
    require('../../db/repositories').notifications.getUserPushTokens.mockResolvedValueOnce(['INVALID_TOKEN']);
    mockIsExpoPushToken.mockReturnValueOnce(false);

    const result = await service.sendPushNotificationToUser('user-1', PAYLOAD);
    expect(require('../../db/repositories').notifications.removePushToken).toHaveBeenCalledWith('INVALID_TOKEN');
    expect(result).toBe(false);
  });

  test('sends notifications and returns true on success', async () => {
    require('../../db/repositories').notifications.getUserPushTokens.mockResolvedValueOnce([VALID_TOKEN]);
    mockIsExpoPushToken.mockReturnValueOnce(true);
    mockChunkPushNotifications.mockReturnValueOnce([[{ to: VALID_TOKEN }]]);
    mockSendPushNotificationsAsync.mockResolvedValueOnce([{ status: 'ok' }]);

    const result = await service.sendPushNotificationToUser('user-1', PAYLOAD);
    expect(result).toBe(true);
    expect(mockSendPushNotificationsAsync).toHaveBeenCalled();
  });

  test('removes token for DeviceNotRegistered error ticket', async () => {
    require('../../db/repositories').notifications.getUserPushTokens.mockResolvedValueOnce([VALID_TOKEN]);
    mockIsExpoPushToken.mockReturnValueOnce(true);
    mockChunkPushNotifications.mockReturnValueOnce([[{ to: VALID_TOKEN }]]);
    mockSendPushNotificationsAsync.mockResolvedValueOnce([
      { status: 'error', message: 'Not registered', details: { error: 'DeviceNotRegistered' } },
    ]);

    await service.sendPushNotificationToUser('user-1', PAYLOAD);
    expect(require('../../db/repositories').notifications.removePushToken).toHaveBeenCalledWith(VALID_TOKEN);
  });

  test('returns false on unexpected error', async () => {
    require('../../db/repositories').notifications.getUserPushTokens.mockRejectedValueOnce(new Error('DB error'));
    const result = await service.sendPushNotificationToUser('user-1', PAYLOAD);
    expect(result).toBe(false);
  });
});
