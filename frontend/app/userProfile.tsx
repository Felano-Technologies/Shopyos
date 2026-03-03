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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getUserData, logoutUser, storage } from '../services/api';


interface User {
  name: string;
  email: string;
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

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            await logoutUser();
            router.replace('/login');
          },
        },
      ]
    );
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
