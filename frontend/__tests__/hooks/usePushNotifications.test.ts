/**
 * __tests__/hooks/usePushNotifications.test.ts
 */

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

import { renderHook, act } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import * as ApiService from '../../services/api';
import { usePushNotifications } from '../../hooks/usePushNotifications';

const mockRouterPush = jest.fn();

// Helper: render the hook and wait for effects to settle
async function renderAndWait() {
  const hook = renderHook(() => usePushNotifications());
  await act(async () => { await new Promise(process.nextTick); });
  return hook;
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
  });

  test('test_usePushNotifications_validCall_returnsPushTokenAndNotificationState', async () => {
    const { result } = await renderAndWait();

    expect(result.current).toHaveProperty('expoPushToken');
    expect(result.current).toHaveProperty('notification');
  });

  test('test_usePushNotifications_inExpoGo_skipsNotificationSetup', async () => {
    const originalOwnership = (Constants as any).appOwnership;
    Object.defineProperty(Constants, 'appOwnership', { value: 'expo', configurable: true });

    await renderAndWait();

    expect(Notifications.setNotificationHandler).not.toHaveBeenCalled();
    expect(Notifications.addNotificationReceivedListener).not.toHaveBeenCalled();

    Object.defineProperty(Constants, 'appOwnership', { value: originalOwnership, configurable: true });
  });

  test('test_usePushNotifications_standaloneApp_configuresNotificationHandlerOnce', async () => {
    await renderAndWait();

    expect(Notifications.setNotificationHandler).toHaveBeenCalledWith(
      expect.objectContaining({ handleNotification: expect.any(Function) })
    );
  });

  test('test_usePushNotifications_handleNotification_suppressesAlertForActiveConversation', async () => {
    await renderAndWait();

    const handlerConfig = (Notifications.setNotificationHandler as jest.Mock).mock.calls[0]?.[0];
    if (!handlerConfig) return;

    (global as any).activeConversationId = 'convo-xyz';
    const result = await handlerConfig.handleNotification({
      request: { content: { data: { screen: 'messages', conversationId: 'convo-xyz' } } },
    });

    expect(result.shouldShowAlert).toBe(false);
    expect(result.shouldPlaySound).toBe(false);
    delete (global as any).activeConversationId;
  });

  test('test_usePushNotifications_handleNotification_showsAlertForOtherNotifications', async () => {
    await renderAndWait();

    const handlerConfig = (Notifications.setNotificationHandler as jest.Mock).mock.calls[0]?.[0];
    if (!handlerConfig) return;

    const result = await handlerConfig.handleNotification({
      request: { content: { data: { screen: 'order', orderId: 'ord-1' } } },
    });

    expect(result.shouldShowAlert).toBe(true);
    expect(result.shouldPlaySound).toBe(true);
  });

  test('test_usePushNotifications_standaloneApp_registersNotificationReceivedListener', async () => {
    await renderAndWait();
    expect(Notifications.addNotificationReceivedListener).toHaveBeenCalledWith(expect.any(Function));
  });

  test('test_usePushNotifications_standaloneApp_registersNotificationResponseListener', async () => {
    await renderAndWait();
    expect(Notifications.addNotificationResponseReceivedListener).toHaveBeenCalledWith(expect.any(Function));
  });

  test('test_usePushNotifications_notificationResponse_deepLinksToConversation', async () => {
    await renderAndWait();

    const responseHandler = (Notifications.addNotificationResponseReceivedListener as jest.Mock).mock.calls[0]?.[0];
    if (!responseHandler) return;

    responseHandler({
      notification: {
        request: { content: { data: { screen: 'messages', conversationId: 'convo-abc', chatType: 'seller', senderName: 'Alice' } } },
      },
    });

    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: '/chat/conversation',
      params: { conversationId: 'convo-abc', chatType: 'seller', name: 'Alice' },
    });
  });

  test('test_usePushNotifications_notificationResponseNoConversationId_deepLinksToChat', async () => {
    await renderAndWait();

    const responseHandler = (Notifications.addNotificationResponseReceivedListener as jest.Mock).mock.calls[0]?.[0];
    if (!responseHandler) return;

    responseHandler({ notification: { request: { content: { data: { screen: 'messages' } } } } });

    expect(mockRouterPush).toHaveBeenCalledWith('/chat');
  });

  test('test_usePushNotifications_notificationResponseOrderScreen_deepLinksToOrder', async () => {
    await renderAndWait();

    const responseHandler = (Notifications.addNotificationResponseReceivedListener as jest.Mock).mock.calls[0]?.[0];
    if (!responseHandler) return;

    responseHandler({ notification: { request: { content: { data: { screen: 'order', orderId: 'ord-789' } } } } });

    expect(mockRouterPush).toHaveBeenCalledWith('/order/ord-789');
  });

  test('test_usePushNotifications_notificationResponseStoreScreen_deepLinksToStore', async () => {
    await renderAndWait();

    const responseHandler = (Notifications.addNotificationResponseReceivedListener as jest.Mock).mock.calls[0]?.[0];
    if (!responseHandler) return;

    responseHandler({ notification: { request: { content: { data: { screen: 'store', storeId: 'store-42' } } } } });

    expect(mockRouterPush).toHaveBeenCalledWith({ pathname: '/stores/details', params: { id: '42' } });
  });

  test('test_usePushNotifications_notificationResponseUnknownScreen_navigatesToNotifications', async () => {
    await renderAndWait();

    const responseHandler = (Notifications.addNotificationResponseReceivedListener as jest.Mock).mock.calls[0]?.[0];
    if (!responseHandler) return;

    responseHandler({ notification: { request: { content: { data: { screen: 'unknown' } } } } });

    expect(mockRouterPush).toHaveBeenCalledWith('/notification');
  });

  test('test_usePushNotifications_permissionDenied_showsPermissionAlert', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    await renderAndWait();

    expect(alertSpy).toHaveBeenCalledWith('Permission needed', expect.any(String));
    alertSpy.mockRestore();
  });

  test('test_usePushNotifications_userTokenPresent_storesAndSyncsPushTokenWithBackend', async () => {
    const pushToken = 'ExponentPushToken[sync-me]';
    (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({ data: pushToken });
    (ApiService.storage.getItem as jest.Mock).mockResolvedValueOnce('user-auth-token');

    await renderAndWait();

    expect(ApiService.storage.setItem).toHaveBeenCalledWith('expoPushToken', pushToken);
    expect(ApiService.registerPushTokenInBackend).toHaveBeenCalledWith(pushToken);
  });

  test('test_usePushNotifications_noProjectId_returnsUndefinedTokenWithoutThrowing', async () => {
    const origExpoConfig = Constants.expoConfig;
    const origEasConfig = (Constants as any).easConfig;
    Object.defineProperty(Constants, 'expoConfig', { value: { extra: { eas: {} } }, configurable: true });
    Object.defineProperty(Constants, 'easConfig', { value: {}, configurable: true });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await renderAndWait();

    expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();

    Object.defineProperty(Constants, 'expoConfig', { value: origExpoConfig, configurable: true });
    Object.defineProperty(Constants, 'easConfig', { value: origEasConfig, configurable: true });
    warnSpy.mockRestore();
  });

  test('test_usePushNotifications_cleanup_removesNotificationListeners', async () => {
    const { unmount } = await renderAndWait();

    unmount();

    expect(mockNotificationListener.remove).toHaveBeenCalled();
    expect(mockResponseListener.remove).toHaveBeenCalled();
  });
});
