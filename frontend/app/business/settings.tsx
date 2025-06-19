// app/business/settings.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Alert,
  useColorScheme,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function BusinessSettingsScreen() {
  const theme = useColorScheme();
  const isDark = theme === 'dark';
  const router = useRouter();

  const bgColor = isDark ? '#121212' : '#F8F8F8';
  const cardBg = isDark ? '#1E1E1E' : '#FFFFFF';
  const primaryText = isDark ? '#EDEDED' : '#222222';
  const secondaryText = isDark ? '#AAA' : '#666666';

  const confirmLogout = () => {
    Alert.alert('Logout?', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', onPress: () => router.replace('/business/login'), style: 'destructive' },
    ]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* ─── Business Profile ─── */}
        <View style={[styles.sectionCard, { backgroundColor: cardBg }]}>
          <Text style={[styles.sectionTitle, { color: primaryText }]}>Business Profile</Text>
          <TouchableOpacity style={styles.itemRow} onPress={() => router.push('/business/editProfile')}>
            <Ionicons name="briefcase-outline" size={20} color={secondaryText} style={styles.itemIcon} />
            <Text style={[styles.itemLabel, { color: primaryText }]}>Edit Business Info</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.itemRow} onPress={() => router.push('/business/verification')}>
            <Ionicons name="shield-checkmark-outline" size={20} color={secondaryText} style={styles.itemIcon} />
            <Text style={[styles.itemLabel, { color: primaryText }]}>Verification Status</Text>
          </TouchableOpacity>
        </View>



        {/* ─── Finance Settings ─── */}
        <View style={[styles.sectionCard, { backgroundColor: cardBg, marginTop: 12 }]}>
          <Text style={[styles.sectionTitle, { color: primaryText }]}>Finance</Text>
          <TouchableOpacity style={styles.itemRow} onPress={() => router.push('/business/payout')}>
            <MaterialIcons name="payments" size={20} color={secondaryText} style={styles.itemIcon} />
            <Text style={[styles.itemLabel, { color: primaryText }]}>Payout Settings</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.itemRow} onPress={() => router.push('/business/transactions')}>
            <Ionicons name="cash-outline" size={20} color={secondaryText} style={styles.itemIcon} />
            <Text style={[styles.itemLabel, { color: primaryText }]}>Transaction History</Text>
          </TouchableOpacity>
        </View>

        {/* ─── Notifications ─── */}
        <View style={[styles.sectionCard, { backgroundColor: cardBg, marginTop: 12 }]}>
          <Text style={[styles.sectionTitle, { color: primaryText }]}>Notifications</Text>
          <TouchableOpacity style={styles.itemRow} onPress={() => router.push('/settings/pushNotifications')}>
            <Ionicons name="notifications-outline" size={20} color={secondaryText} style={styles.itemIcon} />
            <Text style={[styles.itemLabel, { color: primaryText }]}>Push Alerts</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.itemRow}>
            <Ionicons name="mail-outline" size={20} color={secondaryText} style={styles.itemIcon} />
            <Text style={[styles.itemLabel, { color: primaryText }]}>Email Preferences</Text>
          </TouchableOpacity>
        </View>

        {/* ─── Support ─── */}
        <View style={[styles.sectionCard, { backgroundColor: cardBg, marginTop: 12 }]}>
          <Text style={[styles.sectionTitle, { color: primaryText }]}>Support</Text>
          <TouchableOpacity style={styles.itemRow} onPress={() => router.push('/settings/helpCenter')}>
            <Ionicons name="help-circle-outline" size={20} color={secondaryText} style={styles.itemIcon} />
            <Text style={[styles.itemLabel, { color: primaryText }]}>Help Center</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.itemRow} onPress={() => router.push('/settings/contactUs')}>
            <Ionicons name="chatbox-ellipses-outline" size={20} color={secondaryText} style={styles.itemIcon} />
            <Text style={[styles.itemLabel, { color: primaryText }]}>Contact Support</Text>
          </TouchableOpacity>
        </View>

        {/* ─── Logout ─── */}
        <View style={styles.logoutContainer}>
          <TouchableOpacity style={[styles.logoutButton, { backgroundColor: cardBg }]} onPress={confirmLogout}>
            <Ionicons name="log-out-outline" size={20} color="#E11D48" style={styles.logoutIcon} />
            <Text style={[styles.logoutLabel, { color: '#E11D48' }]}>Log Out</Text>
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
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 100,
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
    paddingVertical: 12,
  },
  itemIcon: {
    marginRight: 12,
  },
  itemLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  logoutContainer: {
    alignItems: 'center',
    marginTop: 30,
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
