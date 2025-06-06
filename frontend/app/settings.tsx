// app/settings.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  useColorScheme,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function SettingsScreen() {
  const theme = useColorScheme();
  const isDark = theme === 'dark';
  const router = useRouter();

  const bgColor = isDark ? '#121212' : '#F8F8F8';
  const cardBg = isDark ? '#1E1E1E' : '#FFFFFF';
  const primaryText = isDark ? '#EDEDED' : '#222222';
  const secondaryText = isDark ? '#AAA' : '#666666';

  // Show confirmation before logging out
  const confirmLogout = () => {
    Alert.alert(
      'Confirm Logout',
      'Are you sure you want to log out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: () => router.push('/login'),
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
      {/* Header with Title and Avatar */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: primaryText }]}>
          Settings
        </Text>
        <TouchableOpacity
          style={styles.avatarWrapper}
          onPress={() => router.push('/userProfile')}
        >
          {/* Replace with actual user image if available */}
          <Ionicons
            name="person-circle-outline"
            size={36}
            color={primaryText}
          />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Account Section */}
        <View style={[styles.sectionCard, { backgroundColor: cardBg }]}>
          <Text style={[styles.sectionTitle, { color: primaryText }]}>
            Account
          </Text>
          <TouchableOpacity
            style={styles.itemRow}
            onPress={() => router.push('/userProfile')}
          >
            <Ionicons
              name="person-outline"
              size={20}
              color={secondaryText}
              style={styles.itemIcon}
            />
            <Text style={[styles.itemLabel, { color: primaryText }]}>
              Profile
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.itemRow}
            onPress={() => router.push('/settings/changePassword')}
          >
            <Ionicons
              name="lock-closed-outline"
              size={20}
              color={secondaryText}
              style={styles.itemIcon}
            />
            <Text style={[styles.itemLabel, { color: primaryText }]}>
              Change Password
            </Text>
          </TouchableOpacity>
        </View>

        {/* Notifications Section */}
        <View
          style={[
            styles.sectionCard,
            { backgroundColor: cardBg, marginTop: 12 },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: primaryText }]}>
            Notifications
          </Text>
          <TouchableOpacity
            style={styles.itemRow}
            onPress={() => router.push('/settings/pushNotifications')}
          >
            <Ionicons
              name="notifications-outline"
              size={20}
              color={secondaryText}
              style={styles.itemIcon}
            />
            <Text style={[styles.itemLabel, { color: primaryText }]}>
              Push Notifications
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.itemRow}>
            <Ionicons
              name="mail-outline"
              size={20}
              color={secondaryText}
              style={styles.itemIcon}
            />
            <Text style={[styles.itemLabel, { color: primaryText }]}>
              Email Notifications
            </Text>
          </TouchableOpacity>
        </View>

        {/* Support Section */}
        <View
          style={[
            styles.sectionCard,
            { backgroundColor: cardBg, marginTop: 12, marginBottom: 80 },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: primaryText }]}>
            Support
          </Text>
          <TouchableOpacity
            style={styles.itemRow}
            onPress={() => router.push('/settings/helpCenter')}
          >
            <Ionicons
              name="help-circle-outline"
              size={20}
              color={secondaryText}
              style={styles.itemIcon}
            />
            <Text style={[styles.itemLabel, { color: primaryText }]}>
              Help Center
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.itemRow}
            onPress={() => router.push('/settings/contactUs')}
          >
            <Ionicons
              name="mail-unread-outline"
              size={20}
              color={secondaryText}
              style={styles.itemIcon}
            />
            <Text style={[styles.itemLabel, { color: primaryText }]}>
              Contact Us
            </Text>
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <View style={styles.logoutContainer}>
          <TouchableOpacity
            style={[styles.logoutButton, { backgroundColor: cardBg }]}
            onPress={confirmLogout}
          >
            <Ionicons
              name="log-out-outline"
              size={20}
              color="#E11D48"
              style={styles.logoutIcon}
            />
            <Text style={[styles.logoutLabel, { color: '#E11D48' }]}>
              Log Out
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '600',
  },
  avatarWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  sectionCard: {
    borderRadius: 12,
    padding: 12,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  itemIcon: {
    marginRight: 12,
  },
  itemLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  logoutContainer: {
    marginTop: -50,
    alignItems: 'center',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    elevation: 1,
  },
  logoutIcon: {
    marginRight: 8,
  },
  logoutLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
});
