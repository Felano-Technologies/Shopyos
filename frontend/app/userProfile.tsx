// app/userProfile.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getUserData, logoutUser, storage } from '../services/api';


interface User {
  name: string;
  email: string;
  wallet_balance?: number;
  referral_code?: string;
}

export default function UserProfile() {
  const theme = useColorScheme();
  const isDark = theme === 'dark';
  const router = useRouter();

  const bgColor = isDark ? '#121212' : '#F8F8F8';
  const cardBg = isDark ? '#1E1E1E' : '#FFFFFF';
  const primaryText = isDark ? '#EDEDED' : '#222222';
  const secondaryText = isDark ? '#AAA' : '#666666';
  const highlightColor = '#4F46E5';

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logoutUser();
      router.replace('/login');
    } finally {
      setIsLoggingOut(false);
      setShowLogoutModal(false);
    }
  };

  useEffect(() => {
    const fetchUserDetails = async () => {
      try {
        const token = await storage.getItem('userId');
        if (!token) throw new Error('No auth token found');

        const response = await getUserData();
        console.log('Fetched user details:', response);

        setUser({
          name: response.name,
          email: response.email,
          wallet_balance: response.wallet_balance,
          referral_code: response.referral_code
        });
      } catch (error) {
        console.warn('Failed to fetch user details:', error);
        Alert.alert(
          'Error',
          'Unable to load user details. Please try again later.'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchUserDetails();
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={highlightColor} />
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: primaryText }]}>
            Failed to load user information.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: primaryText }]}>Profile</Text>
        <TouchableOpacity onPress={() => router.push('/settings')}>
          <Ionicons name="settings-outline" size={24} color={primaryText} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Basic Info Card */}
        <View style={[styles.profileCard, { backgroundColor: cardBg }]}>
          <Text style={[styles.userName, { color: primaryText }]}>{user.name}</Text>
          <Text style={[styles.userEmail, { color: secondaryText }]}>{user.email}</Text>
          
          <View style={{ marginTop: 16, alignItems: 'center' }}>
            <Text style={{ fontSize: 12, color: secondaryText, fontWeight: 'bold' }}>Wallet Balance</Text>
            <Text style={{ fontSize: 22, color: '#16a34a', fontWeight: 'bold' }}>₵{user.wallet_balance?.toFixed(2) || '0.00'}</Text>
          </View>
          
          {user.referral_code && (
            <View style={{ marginTop: 16, alignItems: 'center', backgroundColor: isDark ? '#2D2D2D' : '#F1F5F9', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 }}>
              <Text style={{ fontSize: 12, color: secondaryText }}>Your Referral Code</Text>
              <Text style={{ fontSize: 16, color: primaryText, fontWeight: 'bold', letterSpacing: 1 }}>{user.referral_code}</Text>
            </View>
          )}
        </View>

        {/* Profile Options */}
        <View style={[styles.sectionCard, { backgroundColor: cardBg, marginTop: 12 }]}>
          <TouchableOpacity style={styles.itemRow} onPress={() => router.push('/orders')}>
            <Ionicons
              name="receipt-outline"
              size={20}
              color={secondaryText}
              style={styles.itemIcon}
            />
            <Text style={[styles.itemLabel, { color: primaryText }]}>My Orders</Text>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={secondaryText}
              style={styles.chevronIcon}
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.itemRow} onPress={() => router.push('/wishlist')}>
            <Ionicons
              name="heart-outline"
              size={20}
              color={secondaryText}
              style={styles.itemIcon}
            />
            <Text style={[styles.itemLabel, { color: primaryText }]}>Wishlist</Text>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={secondaryText}
              style={styles.chevronIcon}
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.itemRow} onPress={() => router.push('/addresses')}>
            <Ionicons
              name="location-outline"
              size={20}
              color={secondaryText}
              style={styles.itemIcon}
            />
            <Text style={[styles.itemLabel, { color: primaryText }]}>Addresses</Text>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={secondaryText}
              style={styles.chevronIcon}
            />
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <View style={styles.logoutContainer}>
          <TouchableOpacity style={[styles.logoutButton, { backgroundColor: cardBg }]} onPress={() => setShowLogoutModal(true)}>
            <Ionicons
              name="log-out-outline"
              size={20}
              color="#E11D48"
              style={styles.logoutIcon}
            />
            <Text style={[styles.logoutLabel, { color: '#E11D48' }]}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={showLogoutModal} transparent animationType="fade" onRequestClose={() => !isLoggingOut && setShowLogoutModal(false)}>
        <Pressable style={styles.logoutModalOverlay} onPress={() => !isLoggingOut && setShowLogoutModal(false)}>
          <Pressable style={[styles.logoutModalCard, { backgroundColor: cardBg }]} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.logoutModalIcon, { backgroundColor: isDark ? '#3B1A22' : '#FEF2F2' }]}>
              <Ionicons name="log-out-outline" size={24} color="#E11D48" />
            </View>
            <Text style={[styles.logoutModalTitle, { color: primaryText }]}>Log Out?</Text>
            <Text style={[styles.logoutModalText, { color: secondaryText }]}>You can always sign back in anytime.</Text>
            <View style={styles.logoutModalActions}>
              <TouchableOpacity style={[styles.logoutModalCancelBtn, { backgroundColor: isDark ? '#2A2A2A' : '#F1F5F9' }]} onPress={() => setShowLogoutModal(false)} disabled={isLoggingOut}>
                <Text style={[styles.logoutModalCancelTxt, { color: primaryText }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.logoutModalConfirmBtn, isLoggingOut && { opacity: 0.7 }]} onPress={handleLogout} disabled={isLoggingOut}>
                {isLoggingOut ? <ActivityIndicator color="#FFF" /> : <Text style={styles.logoutModalConfirmTxt}>Log Out</Text>}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 24, fontWeight: '600' },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 40 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 16, fontWeight: '500' },
  profileCard: {
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 20,
    borderRadius: 12,
    elevation: 2,
  },
  userName: { fontSize: 20, fontWeight: '600', marginBottom: 4 },
  userEmail: { fontSize: 14, fontWeight: '400' },
  sectionCard: {
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    elevation: 2,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#CCC',
  },
  itemIcon: { marginRight: 12 },
  itemLabel: { fontSize: 16, flex: 1 },
  chevronIcon: { marginLeft: 8 },
  logoutContainer: { marginTop: 24, alignItems: 'center' },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    elevation: 1,
  },
  logoutIcon: { marginRight: 8 },
  logoutLabel: { fontSize: 16, fontWeight: '500' },
  logoutModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 22,
  },
  logoutModalCard: {
    width: '100%',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: '#33415533',
  },
  logoutModalIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 12,
  },
  logoutModalTitle: {
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700',
  },
  logoutModalText: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 14,
  },
  logoutModalActions: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 10,
  },
  logoutModalCancelBtn: {
    flex: 1,
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 12,
  },
  logoutModalCancelTxt: {
    fontSize: 14,
    fontWeight: '600',
  },
  logoutModalConfirmBtn: {
    flex: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#E11D48',
  },
  logoutModalConfirmTxt: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
