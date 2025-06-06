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
          <TouchableOpacity style={styles.itemRow}>
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
          <TouchableOpacity style={styles.itemRow}>
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

        {/* Preferences Section */}
        <View
          style={[
            styles.sectionCard,
            { backgroundColor: cardBg, marginTop: 12 },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: primaryText }]}>
            Preferences
          </Text>
          <TouchableOpacity style={styles.itemRow}>
            <Ionicons
              name="moon-outline"
              size={20}
              color={secondaryText}
              style={styles.itemIcon}
            />
            <Text style={[styles.itemLabel, { color: primaryText }]}>
              Dark Mode: {isDark ? 'On' : 'Off'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.itemRow}>
            <Ionicons
              name="language-outline"
              size={20}
              color={secondaryText}
              style={styles.itemIcon}
            />
            <Text style={[styles.itemLabel, { color: primaryText }]}>
              Language
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
          <TouchableOpacity style={styles.itemRow}>
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
          <TouchableOpacity style={styles.itemRow}>
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
});
