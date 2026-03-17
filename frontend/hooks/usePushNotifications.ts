import { useState, useEffect, useRef } from 'react';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { registerPushTokenInBackend, storage } from '../services/api';

// Make sure Notifications are set to display when foregrounded
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

export function usePushNotifications() {
    const [expoPushToken, setExpoPushToken] = useState<string | undefined>();
    const [notification, setNotification] = useState<Notifications.Notification | undefined>();
    const notificationListener = useRef<Notifications.EventSubscription | null>(null);
    const responseListener = useRef<Notifications.EventSubscription | null>(null);
    const router = useRouter();

    useEffect(() => {
        registerForPushNotificationsAsync().then(async (token) => {
            if (token) {
                setExpoPushToken(token);
                // Store consistently using our SecureStore wrapper
                await storage.setItem('expoPushToken', token).catch(() => { });

                // Try to sync with backend right away if we are already logged in
                try {
                    const userToken = await storage.getItem('userToken');
                    if (userToken) {
                        await registerPushTokenInBackend(token);
                    }
                } catch (e) {
                    console.warn('Silent failure syncing push token on boot:', e);
                }
            }
        });

        notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
            console.log('🔔 Notification Received (Foreground):', JSON.stringify(notification, null, 2));
            setNotification(notification);
        });

        responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
            console.log('タップ Notification Tapped:', JSON.stringify(response, null, 2));
            const data = response.notification.request.content.data;
            if (data?.screen === 'messages') {
                // Deep link to Chat
                if (data.conversationId) {
                    router.push(`/chat/conversation?id=${data.conversationId}`);
                } else {
                    router.push('/chat');
                }
            } else if (data?.screen === 'order') {
                router.push(`/order/${data.orderId}`);
            } else if (data?.screen === 'store' && data.storeId) {
                // Proximity notification tapped → open the store
                router.push({ pathname: '/stores/details', params: { id: String(data.storeId) } });
            } else {
                router.push('/notification');
            }
        });

        return () => {
            if (notificationListener.current) {
                notificationListener.current.remove();
            }
            if (responseListener.current) {
                responseListener.current.remove();
            }
        };
    }, []);

    return { expoPushToken, notification };
}

async function registerForPushNotificationsAsync() {
    let token;

    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
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
            Alert.alert('Permission needed', 'Failed to get push token for push notification!');
            return;
        }
    } else {
        Alert.alert('Must use physical device for Push Notifications');
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
            Alert.alert(
                'Push Notifications Unavailable',
                'Push notifications require a development build. Please use a dev client or production build instead of Expo Go.',
                [{ text: 'OK' }]
            );
        }
    }

    return token;
}
