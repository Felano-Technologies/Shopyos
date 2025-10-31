// app/business/settings.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function BusinessSettingsScreen() {
  const theme = useColorScheme();
  const isDark = theme === 'dark';
  const router = useRouter();

  const bgColor = isDark ? '#121212' : '#E9F0FF';
  const cardBg = isDark ? '#1E1E1E' : '#FFFFFF';
  const primaryText = isDark ? '#EDEDED' : '#111827';
  const secondaryText = isDark ? '#AAA' : '#666666';
  const accent = '#A3E635';
  const headerBg = '#081059';

  const confirmLogout = () => {
    Alert.alert('Logout?', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', onPress: () => router.replace('/business/login'), style: 'destructive' },
    ]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
      {/* ─── Header Section ─── */}
      <View style={[styles.header, { backgroundColor: headerBg }]}>
        {/* Background watermark */}
        <Image
          source={require('../../assets/images/splash-icon.png')}
          style={styles.headerWatermark}
        />
        <Text style={[styles.headerTitle, { color: accent }]}>Business Settings</Text>
        <View style={styles.businessProfile}>
          <Ionicons name="briefcase-outline" size={70} color="#fff" />
          <Text style={styles.businessName}>My Business</Text>
        </View>
      </View>

      {/* ─── Scrollable Content ─── */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* ─── Business Profile ─── */}
        <View style={[styles.sectionCard, { backgroundColor: cardBg }]}>
          <Text style={[styles.sectionTitle, { color: primaryText }]}>Business Profile</Text>

          <TouchableOpacity
            style={styles.itemRow}
            onPress={() => router.push('/business/editProfile')}
          >
            <Ionicons
              name="briefcase-outline"
              size={22}
              color={secondaryText}
              style={styles.itemIcon}
            />
            <Text style={[styles.itemLabel, { color: primaryText }]}>
              Edit Business Info
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.itemRow}
            onPress={() => router.push('/business/verification')}
          >
            <Ionicons
              name="shield-checkmark-outline"
              size={22}
              color={secondaryText}
              style={styles.itemIcon}
            />
            <Text style={[styles.itemLabel, { color: primaryText }]}>
              Verification Status
            </Text>
          </TouchableOpacity>
        </View>

        {/* ─── Finance Settings ─── */}
        <View style={[styles.sectionCard, { backgroundColor: cardBg }]}>
          <Text style={[styles.sectionTitle, { color: primaryText }]}>Finance</Text>

          <TouchableOpacity
            style={styles.itemRow}
            onPress={() => router.push('/business/payout')}
          >
            <MaterialIcons
              name="payments"
              size={22}
              color={secondaryText}
              style={styles.itemIcon}
            />
            <Text style={[styles.itemLabel, { color: primaryText }]}>
              Payout Settings
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.itemRow}
            onPress={() => router.push('/business/transactions')}
          >
            <Ionicons
              name="cash-outline"
              size={22}
              color={secondaryText}
              style={styles.itemIcon}
            />
            <Text style={[styles.itemLabel, { color: primaryText }]}>
              Transaction History
            </Text>
          </TouchableOpacity>
        </View>

        {/* ─── Notifications ─── */}
        <View style={[styles.sectionCard, { backgroundColor: cardBg }]}>
          <Text style={[styles.sectionTitle, { color: primaryText }]}>Notifications</Text>

          <TouchableOpacity
            style={styles.itemRow}
            onPress={() => router.push('/settings/pushNotifications')}
          >
            <Ionicons
              name="notifications-outline"
              size={22}
              color={secondaryText}
              style={styles.itemIcon}
            />
            <Text style={[styles.itemLabel, { color: primaryText }]}>
              Push Alerts
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.itemRow}>
            <Ionicons
              name="mail-outline"
              size={22}
              color={secondaryText}
              style={styles.itemIcon}
            />
            <Text style={[styles.itemLabel, { color: primaryText }]}>
              Email Preferences
            </Text>
          </TouchableOpacity>
        </View>

        {/* ─── Support ─── */}
        <View style={[styles.sectionCard, { backgroundColor: cardBg }]}>
          <Text style={[styles.sectionTitle, { color: primaryText }]}>Support</Text>

          <TouchableOpacity
            style={styles.itemRow}
            onPress={() => router.push('/settings/helpCenter')}
          >
            <Ionicons
              name="help-circle-outline"
              size={22}
              color={secondaryText}
              style={styles.itemIcon}
            />
            <Text style={[styles.itemLabel, { color: primaryText }]}>Help Center</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.itemRow}
            onPress={() => router.push('/settings/contactUs')}
          >
            <Ionicons
              name="chatbox-ellipses-outline"
              size={22}
              color={secondaryText}
              style={styles.itemIcon}
            />
            <Text style={[styles.itemLabel, { color: primaryText }]}>Contact Support</Text>
          </TouchableOpacity>
        </View>

        {/* ─── Logout ─── */}
        <View style={styles.logoutContainer}>
          <TouchableOpacity
            style={[styles.logoutButton, { backgroundColor: cardBg }]}
            onPress={confirmLogout}
          >
            <Ionicons
              name="log-out-outline"
              size={22}
              color="#E11D48"
              style={styles.logoutIcon}
            />
            <Text style={[styles.logoutLabel, { color: '#E11D48' }]}>Log Out</Text>
          </TouchableOpacity>
        </View>

        {/* Bottom Watermark */}
        <View style={styles.bottomWatermarkContainer}>
          <Image
            source={require('../../assets/images/splash-icon.png')}
            style={styles.bottomWatermark}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 40,
    paddingBottom: 25,
    borderBottomLeftRadius: 50,
    borderBottomRightRadius: 50,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  headerWatermark: {
    position: 'absolute',
    right: -40,
    bottom: -40,
    width: 150,
    height: 150,
    opacity: 0.15,
    resizeMode: 'contain',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    alignSelf: 'flex-start',
    marginLeft: 30,
  },
  businessProfile: {
    alignItems: 'center',
    marginTop: 10,
  },
  businessName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 6,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 60,
  },
  sectionCard: {
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 15,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 5,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  itemIcon: {
    marginRight: 10,
  },
  itemLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  logoutContainer: {
    alignItems: 'center',
    marginTop: 25,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    elevation: 2,
  },
  logoutIcon: {
    marginRight: 8,
  },
  logoutLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  bottomWatermarkContainer: {
    position: 'relative',
    height: 100,
    justifyContent: 'flex-end',
  },
  bottomWatermark: {
    position: 'absolute',
    left: -40,
    bottom: -40,
    width: 150,
    height: 150,
    opacity: 0.12,
    resizeMode: 'contain',
  },
});
