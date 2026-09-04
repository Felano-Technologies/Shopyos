import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { getUserData, uploadAvatar, logoutUser } from '@/services/api';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { useAuthStore } from '@/store/authStore';
import { useImagePickerSheet } from '@/hooks/useImagePickerSheet';
import TappableAvatar from '@/components/TappableAvatar';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';

function SettingRow({
  icon, label, value, onPress,
}: Readonly<{ icon: any; label: string; value?: string; onPress?: () => void }>) {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.rowLeft}>
        <View style={styles.iconCircle}>
          <Feather name={icon} size={20} color={colors.primary} />
        </View>
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      <View style={styles.rowRight}>
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
        <Feather name="chevron-right" size={18} color={colors.textMuted} />
      </View>
    </TouchableOpacity>
  );
}

export default function ParcelPartnerSettings() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const switchToBuyerMode = useAuthStore((s) => s.switchToBuyerMode);
  const [user, setUser] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  useEffect(() => {
    getUserData().then(setUser).catch(console.error);
  }, []);

  const showImagePicker = useImagePickerSheet();
  const pickImage = async () => {
    try {
      const uri = await showImagePicker({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (!uri) return;
      setUploading(true);
      const res = await uploadAvatar(uri);
      if (res?.success) {
        setUser((u: any) => ({ ...u, avatar_url: res.data.url }));
        CustomInAppToast.show({ type: 'success', title: 'Profile Updated', message: 'Profile photo updated!' });
        queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      }
    } catch {
      CustomInAppToast.show({ type: 'error', title: 'Error', message: 'Failed to update profile photo.' });
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = async () => {
    try {
      setLogoutLoading(true);
      await logoutUser();
      CustomInAppToast.show({ type: 'success', title: 'Logged Out', message: 'You have been successfully logged out.' });
      router.replace('/login');
    } catch {
      router.replace('/login');
    } finally {
      setLogoutLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor={colors.headerGradient[0]} />

      {/* Header */}
      <LinearGradient colors={colors.headerGradient} style={styles.header}>
        <SafeAreaView edges={['top', 'left', 'right']}>
          <View style={styles.navBar}>
            <TouchableOpacity onPress={() => router.back()} style={styles.hdrBtn}>
              <Ionicons name="arrow-back" size={24} color={colors.accent} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Hub Profile</Text>
            <View style={{ width: 40 }} />
          </View>
          <View style={styles.profileCard}>
            {uploading ? (
              <View style={styles.avatarLoader}>
                <ActivityIndicator size="large" color={colors.accent} />
              </View>
            ) : (
              <TappableAvatar
                uri={user?.avatar_url}
                size={86}
                label={user?.name || 'Hub Partner'}
                onEditPress={pickImage}
                style={{ marginBottom: 8 }}
              />
            )}
            <Text style={styles.name}>{user?.name || 'Hub Partner'}</Text>
            <Text style={styles.email}>{user?.email || ''}</Text>
            <View style={styles.roleBadge}>
              <Ionicons name="cube-outline" size={12} color="#A3E635" />
              <Text style={styles.roleText}>Parcel Partner</Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Scrollable content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.section}>
          <SettingRow
            icon="user"
            label="Edit Profile"
            onPress={() => router.push('/userProfile' as any)}
          />
          <SettingRow
            icon="lock"
            label="Change Password"
            onPress={() => router.push('/settings/changePassword' as any)}
          />
        </View>

        <Text style={styles.sectionTitle}>Support</Text>
        <View style={styles.section}>
          <SettingRow
            icon="alert-circle"
            label="Raise a Report"
            onPress={() => router.push('/support' as any)}
          />
          <SettingRow
            icon="list"
            label="My Reports"
            onPress={() => router.push('/support/my-tickets' as any)}
          />
        </View>

        <TouchableOpacity
          style={styles.shopBtn}
          onPress={() => {
            switchToBuyerMode('parcel_partner');
            router.push('/home');
          }}
        >
          <Feather name="shopping-bag" size={18} color="#1D4ED8" />
          <Text style={styles.shopBtnText}>Shop as Buyer</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
          disabled={logoutLoading}
        >
          {logoutLoading ? (
            <ActivityIndicator size="small" color="#DC2626" />
          ) : (
            <Text style={styles.logoutText}>Logout</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundAlt },
  header: {
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    paddingBottom: 28,
    paddingHorizontal: 20,
    elevation: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  navBar: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 20, marginTop: 4,
  },
  hdrBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 18, color: '#FFF', fontFamily: 'Montserrat-Bold' },
  profileCard: { alignItems: 'center' },
  avatarLoader: {
    width: 86, height: 86, borderRadius: 43,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  name: { fontSize: 20, fontFamily: 'Montserrat-Bold', color: '#FFF', marginBottom: 4 },
  email: { fontSize: 13, fontFamily: 'Montserrat-Regular', color: 'rgba(255,255,255,0.7)', marginBottom: 8 },
  roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
    borderWidth: 0.5, borderColor: 'rgba(163,230,53,0.4)',
  },
  roleText: { color: '#A3E635', fontFamily: 'Montserrat-SemiBold', fontSize: 12 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 120 },
  sectionTitle: {
    fontSize: 12, fontFamily: 'Montserrat-Bold', color: colors.textSecondary,
    marginBottom: 8, marginTop: 16, textTransform: 'uppercase', letterSpacing: 0.8,
  },
  section: { backgroundColor: colors.surface, borderRadius: 16, paddingVertical: 4, marginBottom: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 15, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconCircle: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: colors.border,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  rowLabel: { fontSize: 15, color: colors.text, fontFamily: 'Montserrat-Medium' },
  rowRight: { flexDirection: 'row', alignItems: 'center' },
  rowValue: { fontSize: 14, color: colors.textSecondary, marginRight: 8, fontFamily: 'Montserrat-Regular' },
  shopBtn: {
    backgroundColor: colors.border, padding: 16, borderRadius: 16,
    alignItems: 'center', marginTop: 20, marginBottom: 8,
    flexDirection: 'row', justifyContent: 'center', gap: 8,
  },
  shopBtnText: { color: '#1D4ED8', fontFamily: 'Montserrat-Bold', fontSize: 16 },
  logoutBtn: {
    backgroundColor: '#FEE2E2', padding: 16, borderRadius: 16,
    alignItems: 'center', marginBottom: 10,
  },
  logoutText: { color: '#DC2626', fontFamily: 'Montserrat-Bold', fontSize: 16 },
});
