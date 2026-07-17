import { useState, useEffect, useRef } from 'react';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform, Alert, AppState } from 'react-native';
import { useRouter } from 'expo-router';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { registerPushTokenInBackend, storage } from '../services/api';
import { getCachedUserProfile } from '../services/storage';
import { getRouteFromPushData } from '../utils/notificationRouting';

const isExpoGo = Constants.appOwnership === 'expo';

// Android re-delivers the launch intent when the app is reopened from
// recents, replaying an old notification tap and yanking the user to the
// notifications screen. Remember handled response ids and ignore repeats.
let lastHandledNotificationId: string | null = null;
let hydrateHandledId: Promise<void> | null = null;

async function handleNotificationResponse(response: any, router: ReturnType<typeof useRouter>) {
    // Make sure the persisted marker is loaded before deciding (cold-start
    // replays can arrive before the listener-setup hydration completes)
    hydrateHandledId ??= storage.getItem('lastHandledNotificationId')
        .then((id) => { if (id && !lastHandledNotificationId) lastHandledNotificationId = id; })
        .catch(() => {});
    await hydrateHandledId;

    const notificationId = response?.notification?.request?.identifier;
    if (notificationId && notificationId === lastHandledNotificationId) return;
    if (notificationId) {
        lastHandledNotificationId = notificationId;
        storage.setItem('lastHandledNotificationId', notificationId).catch(() => {});
    }

    const data = response.notification.request.content.data || {};
    let role = 'buyer';
    try {
        const profile: any = await getCachedUserProfile();
        if (profile?.role) role = profile.role.toLowerCase();
    } catch {
        // fall back to buyer routing
    }
    const route = getRouteFromPushData(data, role);
    if (route) {
        const destination = route.params ? route : route.pathname;
        router.push(destination as any);
    } else {
        // Default fallback per role
        if (role === 'seller') router.push('/business/notifications' as any);
        else if (role === 'driver') router.push('/driver/notifications' as any);
        else if (role === 'admin') router.push('/admin/dashboard' as any);
        else router.push('/notification');
    }
}
let notificationHandlerConfigured = false;

const getNotificationsModule = () => {
    if (isExpoGo) return null;
    return require('expo-notifications');
};

const ensureNotificationHandler = () => {
    if (notificationHandlerConfigured) return;

    const Notifications = getNotificationsModule();
    if (!Notifications) return;

    Notifications.setNotificationHandler({
        handleNotification: async (notification) => {
            const data = notification?.request?.content?.data;
            const activeId = (globalThis as any).activeConversationId;

            // If the socket is live, the in-app pipeline (notification:new /
            // message:new) already surfaced this event — an OS banner would be
            // a duplicate. Keep it in the tray list so nothing is lost if the
            // user backgrounds moments later.
            let socketAlive = false;
            try {
                const { socketService } = require('../services/socket');
                socketAlive = socketService.isConnected() === true;
            } catch {
                // socket service unavailable — fall through to showing the banner
            }

            // Extra guard: even with a flaky socket, never banner the chat the
            // user is currently inside
            const inThisChat = data?.screen === 'messages' && data?.conversationId && data?.conversationId === activeId;

            if (socketAlive || inThisChat) {
                return {
                    shouldShowAlert: false,
                    shouldPlaySound: false,
                    shouldSetBadge: false,
                    shouldShowBanner: false,
                    shouldShowList: true,
                };
            }

            return {
                shouldShowAlert: true,
                shouldPlaySound: true,
                shouldSetBadge: false,
                shouldShowBanner: true,
                shouldShowList: true,
            };
        },
    });

    notificationHandlerConfigured = true;
};

export function usePushNotifications() {
    const [expoPushToken, setExpoPushToken] = useState<string | undefined>();
    const [notification, setNotification] = useState<any>();
    const notificationListener = useRef<any>(null);
    const responseListener = useRef<any>(null);
    const router = useRouter();
    // Cold-boot network isn't always ready the instant JS starts running, and the
    // shared axios retry interceptor only covers ~3s of backoff — not long enough
    // for some devices. Rather than silently losing the sync forever, remember
    // the failure and retry it the next time the app comes back to the foreground.
    const pendingTokenSyncRef = useRef<string | null>(null);

    const syncPushTokenWithBackend = async (token: string, trigger: string) => {
        const t0 = Date.now();
        try {
            const userToken = await storage.getItem('userToken');
            if (!userToken) {
                console.log(`[PushToken][${trigger}] Skipped — no user session yet`);
                return;
            }
            console.log(`[PushToken][${trigger}] Registering token with backend...`);
            await registerPushTokenInBackend(token);
            pendingTokenSyncRef.current = null;
            console.log(`[PushToken][${trigger}] Registered successfully in ${Date.now() - t0}ms`);
        } catch (e: any) {
            pendingTokenSyncRef.current = token;
            console.warn(`[PushToken][${trigger}] FAILED after ${Date.now() - t0}ms — code=${e?.code} message=${e?.message}. Will retry on next foreground.`);
        }
    };

    useEffect(() => {
        if (isExpoGo) {
            console.log('[PushNotifications] Skipping remote push setup in Expo Go. Use a development build for Android push support.');
            return;
        }

        const Notifications = getNotificationsModule();
        if (!Notifications) return;

        ensureNotificationHandler();

        registerForPushNotificationsAsync().then(async (token) => {
            if (token) {
                setExpoPushToken(token);
                // Store consistently using our SecureStore wrapper
                await storage.setItem('expoPushToken', token).catch(() => { });
                await syncPushTokenWithBackend(token, 'boot');
            }
        });

        notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
            console.log('🔔 Notification Received (Foreground):', JSON.stringify(notification, null, 2));
            setNotification(notification);
        });

        responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
            console.log('タップ Notification Tapped:', JSON.stringify(response, null, 2));
            handleNotificationResponse(response, router);
        });

        const appStateSubscription = AppState.addEventListener('change', (nextState) => {
            if (nextState === 'active' && pendingTokenSyncRef.current) {
                console.log('[PushToken][foreground] Retrying previously failed sync');
                syncPushTokenWithBackend(pendingTokenSyncRef.current, 'foreground-retry');
            }
        });

        return () => {
            if (notificationListener.current) {
                notificationListener.current.remove();
            }
            if (responseListener.current) {
                responseListener.current.remove();
            }
            appStateSubscription.remove();
        };
    }, [router]);

    return { expoPushToken, notification };
}

async function registerForPushNotificationsAsync() {
    const Notifications = getNotificationsModule();
    if (!Notifications) {
        return;
    }

    let token;

    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('orders', {
            name: 'Orders & Deliveries',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#84cc16',
        });
        await Notifications.setNotificationChannelAsync('messages', {
            name: 'Messages',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 100, 50, 100],
            lightColor: '#2563EB',
        });
        await Notifications.setNotificationChannelAsync('default', {
            name: 'General',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
        });
    }

    if (Device.isDevice) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }
        if (finalStatus !== 'granted') {
            CustomInAppToast.show({ type: 'error', title: 'Permission needed', message: 'Failed to get push token for push notification!' });
            return;
        }
    } else {
        CustomInAppToast.show({ type: 'error', title: 'Error', message: 'Must use physical device for Push Notifications' });
    }

    try {
        const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
        
        if (!projectId) {
            console.warn('⚠️ No EAS projectId found. Push notifications require a development build with EAS.');
            console.warn('Running in Expo Go? Build a development client: npx eas build --profile development --platform android');
            return;
        }
        
        console.log('📱 Requesting Expo Push Token with projectId:', projectId);
        token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
        console.log("✅ Expo Push Token:", token);
    } catch (error: any) {
        console.error('❌ Error fetching Expo token:', {
            message: error.message,
            code: error.code,
            type: error.type,
            projectId: Constants.expoConfig?.extra?.eas?.projectId,
        });
        
        if (error.code === 'EXPERIENCE_NOT_FOUND') {
            CustomInAppToast.show({ type: 'error', title: 'Push Notifications Unavailable', message: 'Push notifications require a development build. Please use a dev client or production build instead of Expo Go.' });
        }
    }

    return token;
}
