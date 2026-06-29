// app/userProfile.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { ConfirmModal } from '@/components/ConfirmModal';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { getUserData, logoutUser, storage } from '../services/api';
import TappableAvatar from '@/components/TappableAvatar';

interface User {
  name: string;
  email: string;
  avatar_url?: string | null;
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
  const [refreshing, setRefreshing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleLogout = () => {
    setShowConfirm(true);
  };

  const confirmLogoutAction = async () => {
    setShowConfirm(false);
    await logoutUser();
    router.replace('/login');
  };

  const fetchUserDetails = useCallback(async () => {
    try {
      const token = await storage.getItem('userId');
      if (!token) throw new Error('No auth token found');

      const response = await getUserData();
      console.log('Fetched user details:', response);

      setUser({
        name: response.name,
        email: response.email,
        avatar_url: response.avatar_url || response.avatar || null,
        wallet_balance: response.wallet_balance,
        referral_code: response.referral_code
      });
    } catch (error) {
      console.warn('Failed to fetch user details:', error);
      CustomInAppToast.show({ type: 'error', title: 'Error', message: 'Unable to load user details. Please try again later.' });
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const token = await storage.getItem('userId');
      if (!token) throw new Error('No auth token found');
      const response = await getUserData();
      setUser({
        name: response.name,
        email: response.email,
        avatar_url: response.avatar_url || response.avatar || null,
        wallet_balance: response.wallet_balance,
        referral_code: response.referral_code,
      });
    } catch (error) {
      console.warn('Failed to refresh user details:', error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchUserDetails();
  }, [fetchUserDetails]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]} edges={['top', 'left', 'right', 'bottom']}>
        <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={bgColor} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={highlightColor} />
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]} edges={['top', 'left', 'right', 'bottom']}>
        <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={bgColor} />
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: primaryText }]}>
            Failed to load user information.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={bgColor} />
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: primaryText }]}>Profile</Text>
        <TouchableOpacity onPress={() => router.push('/settings')}>
          <Ionicons name="settings-outline" size={24} color={primaryText} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#4F46E5']}
            tintColor="#4F46E5"
          />
        }
      >
        {/* Basic Info Card */}
        <View style={[styles.profileCard, { backgroundColor: cardBg }]}>
          <TappableAvatar
            uri={user.avatar_url}
            size={80}
            label={user.name}
            style={{ marginBottom: 12 }}
          />
          <Text style={[styles.userName, { color: primaryText }]}>{user.name}</Text>
          <Text style={[styles.userEmail, { color: secondaryText }]}>{user.email}</Text>
          
          <View style={{ marginTop: 16, alignItems: 'center' }}>
            <Text style={{ fontSize: 12, color: secondaryText, fontWeight: 'bold' }}>Wallet Balance</Text>
            <Text style={{ fontSize: 22, color: '#16a34a', fontWeight: 'bold' }}>₵{user.wallet_balance?.toFixed(2) || '0.00'}</Text>
          </View>
          
          {user.referral_code && (
            <TouchableOpacity
              style={{ marginTop: 16, alignItems: 'center', backgroundColor: isDark ? '#2D2D2D' : '#F1F5F9', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 }}
              onPress={async () => {
                await Clipboard.setStringAsync(user.referral_code!);
                CustomInAppToast.show({ type: 'success', title: 'Copied!', message: 'Referral code copied to clipboard.' });
              }}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 12, color: secondaryText }}>Your Referral Code</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <Text style={{ fontSize: 16, color: primaryText, fontWeight: 'bold', letterSpacing: 1 }}>{user.referral_code}</Text>
                <Ionicons name="copy-outline" size={16} color={secondaryText} />
              </View>
            </TouchableOpacity>
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
          <TouchableOpacity style={[styles.logoutButton, { backgroundColor: cardBg }]} onPress={handleLogout}>
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

      <ConfirmModal
        visible={showConfirm}
        onClose={() => setShowConfirm(false)}
        title="Log Out"
        message="Are you sure you want to log out?"
        icon="⚠️"
        actions={[
          { label: 'Cancel', onPress: () => setShowConfirm(false), variant: 'cancel' },
          { label: 'Log Out', onPress: confirmLogoutAction, variant: 'destructive' },
        ]}
      />
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
});
