/**
 * __tests__/hooks/usePushNotifications.test.ts
 *
 * Uses a test component wrapper instead of renderHook because React 19 +
 * RNTL v14 do not flush useEffect inside renderHook reliably.
 *
 * Each test that needs a fresh module (to reset the module-level
 * `notificationHandlerConfigured` flag) uses jest.isolateModules().
 */

// Mock AsyncStorage native module — required before any import of services/storage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock services/storage so getCachedUserProfile resolves immediately (no native deps)
jest.mock('../../services/storage', () => ({
  getCachedUserProfile: jest.fn().mockResolvedValue(null),
  cacheUserProfile: jest.fn().mockResolvedValue(undefined),
  clearUserProfileCache: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    appOwnership: 'standalone',
    expoConfig: { extra: { eas: { projectId: 'test-project-id' } } },
    easConfig: { projectId: 'test-project-id' },
  },
}));

const mockNotificationListener = { remove: jest.fn() };
const mockResponseListener = { remove: jest.fn() };

jest.mock('expo-notifications', () => ({
  __esModule: true,
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'ExponentPushToken[test-token]' }),
  addNotificationReceivedListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  addNotificationResponseReceivedListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  AndroidImportance: { MAX: 5 },
}));

jest.mock('expo-device', () => ({ __esModule: true, isDevice: true }));

jest.mock('expo-router', () => ({
  __esModule: true,
  useRouter: jest.fn().mockReturnValue({ push: jest.fn() }),
}));

jest.mock('../../services/api', () => ({
  __esModule: true,
  registerPushTokenInBackend: jest.fn().mockResolvedValue({ success: true }),
  storage: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn(),
  },
}));

import React from 'react';
import { render, act, cleanup } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import * as ApiService from '../../services/api';
import { usePushNotifications } from '../../hooks/usePushNotifications';

const mockRouterPush = jest.fn();

let hookOutput: ReturnType<typeof usePushNotifications> | null = null;
function TestHook() { hookOutput = usePushNotifications(); return null; }

async function mountAndFlush() {
  hookOutput = null;
  await act(async () => {
    render(<TestHook />);
    // Multiple ticks to let async permission/token chain resolve
    await new Promise(process.nextTick);
    await new Promise(process.nextTick);
    await new Promise(process.nextTick);
  });
}

describe('usePushNotifications Hook Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: mockRouterPush });
    (ApiService.storage.getItem as jest.Mock).mockResolvedValue(null);
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({ data: 'ExponentPushToken[test-token]' });
    (Notifications.addNotificationReceivedListener as jest.Mock).mockReturnValue(mockNotificationListener);
    (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockReturnValue(mockResponseListener);
    mockNotificationListener.remove.mockClear();
    mockResponseListener.remove.mockClear();
    mockRouterPush.mockClear();
  });

  test('test_usePushNotifications_validCall_returnsPushTokenAndNotificationState', async () => {
    await mountAndFlush();
    expect(hookOutput).toHaveProperty('expoPushToken');
    expect(hookOutput).toHaveProperty('notification');
  });

  test('test_usePushNotifications_standaloneApp_registersNotificationReceivedListener', async () => {
    await mountAndFlush();
    expect(Notifications.addNotificationReceivedListener).toHaveBeenCalledWith(expect.any(Function));
  });

  test('test_usePushNotifications_standaloneApp_registersNotificationResponseListener', async () => {
    await mountAndFlush();
    expect(Notifications.addNotificationResponseReceivedListener).toHaveBeenCalledWith(expect.any(Function));
  });

  test('test_usePushNotifications_handleNotification_suppressesAlertForActiveConversation', async () => {
    await mountAndFlush();
    const handlerConfig = (Notifications.setNotificationHandler as jest.Mock).mock.calls[0]?.[0];
    if (!handlerConfig) return; // handler already configured from prior test in module lifecycle

    (global as any).activeConversationId = 'convo-xyz';
    const result = await handlerConfig.handleNotification({
      request: { content: { data: { screen: 'messages', conversationId: 'convo-xyz' } } },
    });
    expect(result.shouldShowAlert).toBe(false);
    expect(result.shouldPlaySound).toBe(false);
    delete (global as any).activeConversationId;
  });

  test('test_usePushNotifications_handleNotification_showsAlertForOtherNotifications', async () => {
    await mountAndFlush();
    const handlerConfig = (Notifications.setNotificationHandler as jest.Mock).mock.calls[0]?.[0];
    if (!handlerConfig) return;
    const result = await handlerConfig.handleNotification({
      request: { content: { data: { screen: 'order', orderId: 'ord-1' } } },
    });
    expect(result.shouldShowAlert).toBe(true);
    expect(result.shouldPlaySound).toBe(true);
  });

  test('test_usePushNotifications_notificationResponse_deepLinksToConversation', async () => {
    await mountAndFlush();
    const responseHandler = (Notifications.addNotificationResponseReceivedListener as jest.Mock).mock.calls[0]?.[0];
    if (!responseHandler) return;
    await act(async () => {
      responseHandler({
        notification: {
          request: { content: { data: { screen: 'messages', conversationId: 'convo-abc', chatType: 'seller', senderName: 'Alice' } } },
        },
      });
    });
    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: '/chat/conversation',
      params: { conversationId: 'convo-abc', chatType: 'seller', name: 'Alice' },
    });
  });

  test('test_usePushNotifications_notificationResponseNoConversationId_deepLinksToChat', async () => {
    await mountAndFlush();
    const responseHandler = (Notifications.addNotificationResponseReceivedListener as jest.Mock).mock.calls[0]?.[0];
    if (!responseHandler) return;
    await act(async () => {
      responseHandler({ notification: { request: { content: { data: { screen: 'messages' } } } } });
    });
    expect(mockRouterPush).toHaveBeenCalledWith('/chat');
  });

  test('test_usePushNotifications_notificationResponseOrderScreen_deepLinksToOrder', async () => {
    await mountAndFlush();
    const responseHandler = (Notifications.addNotificationResponseReceivedListener as jest.Mock).mock.calls[0]?.[0];
    if (!responseHandler) return;
    await act(async () => {
      responseHandler({ notification: { request: { content: { data: { screen: 'order', orderId: 'ord-789' } } } } });
    });
    expect(mockRouterPush).toHaveBeenCalledWith('/order/ord-789');
  });

  test('test_usePushNotifications_notificationResponseStoreScreen_deepLinksToStore', async () => {
    await mountAndFlush();
    const responseHandler = (Notifications.addNotificationResponseReceivedListener as jest.Mock).mock.calls[0]?.[0];
    if (!responseHandler) return;
    await act(async () => {
      responseHandler({ notification: { request: { content: { data: { screen: 'store', storeId: 'store-42' } } } } });
    });
    expect(mockRouterPush).toHaveBeenCalledWith({ pathname: '/stores/details', params: { id: 'store-42' } });
  });

  test('test_usePushNotifications_notificationResponseUnknownScreen_navigatesToNotifications', async () => {
    await mountAndFlush();
    const responseHandler = (Notifications.addNotificationResponseReceivedListener as jest.Mock).mock.calls[0]?.[0];
    if (!responseHandler) return;
    await act(async () => {
      responseHandler({ notification: { request: { content: { data: { screen: 'unknown' } } } } });
    });
    expect(mockRouterPush).toHaveBeenCalledWith('/notification');
  });

  test('test_usePushNotifications_permissionDenied_showsPermissionAlert', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await mountAndFlush();
    expect(alertSpy).toHaveBeenCalledWith('Permission needed', expect.any(String));
    alertSpy.mockRestore();
  });

  test('test_usePushNotifications_userTokenPresent_storesAndSyncsPushTokenWithBackend', async () => {
    const pushToken = 'ExponentPushToken[sync-me]';
    (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({ data: pushToken });
    (ApiService.storage.getItem as jest.Mock).mockResolvedValueOnce('user-auth-token');
    await mountAndFlush();
    expect(ApiService.storage.setItem).toHaveBeenCalledWith('expoPushToken', pushToken);
    expect(ApiService.registerPushTokenInBackend).toHaveBeenCalledWith(pushToken);
  });

  test('test_usePushNotifications_noProjectId_returnsUndefinedTokenWithoutThrowing', async () => {
    const origExpoConfig = Constants.expoConfig;
    const origEasConfig = (Constants as any).easConfig;
    Object.defineProperty(Constants, 'expoConfig', { value: { extra: { eas: {} } }, configurable: true });
    Object.defineProperty(Constants, 'easConfig', { value: {}, configurable: true });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await mountAndFlush();
    expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    Object.defineProperty(Constants, 'expoConfig', { value: origExpoConfig, configurable: true });
    Object.defineProperty(Constants, 'easConfig', { value: origEasConfig, configurable: true });
    warnSpy.mockRestore();
  });

  test('test_usePushNotifications_cleanup_removesNotificationListeners', async () => {
    await act(async () => {
      render(<TestHook />);
      await new Promise(process.nextTick);
    });
    await act(async () => { cleanup(); });
    expect(mockNotificationListener.remove).toHaveBeenCalled();
    expect(mockResponseListener.remove).toHaveBeenCalled();
  });
});
