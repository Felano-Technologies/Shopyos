import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  useColorScheme,
  Switch,
  Alert,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';

// 1) Tell Expo how to handle incoming notifications (show alert even if app is foregrounded):
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function PushNotificationsScreen() {
  const theme = useColorScheme();
  const isDark = theme === 'dark';

  const bgColor = isDark ? '#121212' : '#F8F8F8';
  const cardBg = isDark ? '#1E1E1E' : '#FFFFFF';
  const primaryText = isDark ? '#EDEDED' : '#222222';
  const secondaryText = isDark ? '#AAA' : '#666666';

  const [pushEnabled, setPushEnabled] = useState(false);
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  useEffect(() => {
    // 2) Create the Android notification channel (necessary for Android API 26+)
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    // 3) Load stored preference
    const loadPref = async () => {
      const stored = await SecureStore.getItemAsync('prefPushNotifications');
      setPushEnabled(stored === 'true');
    };

    // 4) Register for push only if permission is granted
    const registerForPushNotifications = async () => {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        Alert.alert('Permission required', 'Enable notifications to receive alerts.');
        return;
      }

      const tokenData = await Notifications.getExpoPushTokenAsync();
      setExpoPushToken(tokenData.data);
    };

    loadPref();
    registerForPushNotifications();

    // 5) Optional: Listen for incoming notifications (foreground)
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log('Notification received in foreground:', notification);
      }
    );

    // 6) Optional: Listen for responses (user taps on notification)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        console.log('User tapped notification:', response);
      }
    );

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  // Toggle push ON/OFF
  const togglePush = async () => {
    try {
      const newValue = !pushEnabled;
      setPushEnabled(newValue);
      await SecureStore.setItemAsync('prefPushNotifications', newValue ? 'true' : 'false');

      if (newValue) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert(
              'Permission denied',
              'Cannot enable notifications without permission.'
            );
            setPushEnabled(false);
            await SecureStore.setItemAsync('prefPushNotifications', 'false');
            return;
          }
        }

        const tokenData = await Notifications.getExpoPushTokenAsync();
        setExpoPushToken(tokenData.data);
        Alert.alert('Push Notifications', 'Enabled');
      } else {
        Alert.alert('Push Notifications', 'Disabled');
      }
    } catch (e) {
      console.error('Error saving push pref:', e);
    }
  };

  // Send a local notification in 3 seconds
  const sendTestNotification = async () => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Test Notification',
          body: 'This is a test push notification for Dios App.',
          data: { test: true },
        },
        trigger: { seconds: 3 },
        channelId: 'default',
      });
      Alert.alert('Test Scheduled', 'A test notification will appear in ~3 seconds.');
    } catch (e) {
      console.error('Error scheduling test notification:', e);
      Alert.alert('Error', 'Could not schedule test notification.');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={[styles.card, { backgroundColor: cardBg }]}>
        <Text style={[styles.title, { color: primaryText }]}>
          Push Notifications
        </Text>
        <View style={styles.row}>
          <Ionicons
            name="notifications-outline"
            size={20}
            color={secondaryText}
            style={styles.icon}
          />
          <Text style={[styles.label, { color: primaryText }]}>
            Enable Push Notifications
          </Text>
          <Switch
            value={pushEnabled}
            onValueChange={togglePush}
            trackColor={{ false: '#767577', true: '#4F46E5' }}
            thumbColor="#FFFFFF"
          />
        </View>

        {pushEnabled && (
          <TouchableOpacity
            style={[
              styles.button,
              { backgroundColor: isDark ? '#4F46E5' : '#222222' },
            ]}
            onPress={sendTestNotification}
          >
            <Text style={styles.buttonText}>Send Test Notification</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  card: {
    borderRadius: 12,
    padding: 16,
    elevation: 2,
  },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 30 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  icon: { marginRight: 10 },
  label: { fontSize: 16, flex: 1 },
  button: {
    marginTop: 50,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: '500' },
});
