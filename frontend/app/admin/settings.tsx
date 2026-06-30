import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AppImage from '@/components/AppImage';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { AdminPanel } from '@/components/admin/AdminShell';
import AdminBottomNav from '@/components/AdminBottomNav';
import AdminScreenSkeleton from '@/components/admin/AdminSkeleton';
import { adminColors } from '@/components/admin/adminTheme';
import { ConfirmModal } from '@/components/ConfirmModal';
import { getUserData } from '@/services/api';
import { getAdminPlatformSettings, updateAdminPlatformSettings } from '@/services/admin';
import { storage } from '@/services/storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function SettingItem({
  icon,
  label,
  subLabel,
  type,
  value,
  onValueChange,
  onPress,
  color = adminColors.navy,
}: any) {
  return (
    <TouchableOpacity
      style={styles.settingCard}
      onPress={onPress}
      disabled={type === 'toggle'}
      activeOpacity={0.7}
    >
      <View style={[styles.iconBg, { backgroundColor: `${color}10` }]}>
        <Feather name={icon} size={20} color={color} />
      </View>
      <View style={styles.settingText}>
        <Text style={styles.settingLabel}>{label}</Text>
        {subLabel ? <Text style={styles.settingSubLabel}>{subLabel}</Text> : null}
      </View>
      {type === 'toggle' ? (
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: '#CBD5E1', true: adminColors.navy }}
          thumbColor={value ? '#A3E635' : '#F8FAFC'}
          ios_backgroundColor="#CBD5E1"
        />
      ) : (
        <Feather name="chevron-right" size={18} color={adminColors.textSoft} />
      )}
    </TouchableOpacity>
  );
}

export default function AdminSettings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [autoApproveSellers, setAutoApproveSellers] = useState(false);
  const [profileName, setProfileName] = useState('Admin');
  const [profileRole, setProfileRole] = useState('Super Administrator');
  const [profileImage, setProfileImage] = useState<string | null>(null);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const data = await getUserData();
      const user = data?.user || data || {};
      const name = user?.name || user?.full_name || 'Admin';
      const role = user?.role || user?.account_type || 'Super Administrator';
      const avatar = user?.avatar_url || user?.avatar || null;
      setProfileName(name);
      setProfileRole(String(role).replaceAll('_', ' ').replace(/\b\w/g, (m: string) => m.toUpperCase()));
      setProfileImage(avatar);
    } catch {
      // keep defaults
    }

    try {
      const settings = await getAdminPlatformSettings();
      setIsMaintenanceMode(settings.maintenance_mode);
      setAutoApproveSellers(settings.auto_approve_sellers);
      await storage.setItem('admin:maintenanceMode', String(settings.maintenance_mode)).catch(() => {});
      await storage.setItem('admin:autoApproveSellers', String(settings.auto_approve_sellers)).catch(() => {});
    } catch {
      const [maint, autoApprove] = await Promise.all([
        storage.getItem('admin:maintenanceMode'),
        storage.getItem('admin:autoApproveSellers'),
      ]);
      if (maint !== null) setIsMaintenanceMode(maint === 'true');
      if (autoApprove !== null) setAutoApproveSellers(autoApprove === 'true');
    }

    const push = await storage.getItem('admin:pushNotifications');
    if (push !== null) setPushNotifications(push === 'true');

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const profileInitial = useMemo(
    () => (profileName || 'A').trim().charAt(0).toUpperCase(),
    [profileName]
  );

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    setShowLogoutConfirm(false);
    router.replace('/login');
  };

  if (loading && !refreshing) {
    return (
      <>
        <StatusBar style="dark" />
        <View style={styles.page}>
          <AdminScreenSkeleton metrics={0} rows={3} cards={2} />
          <AdminBottomNav />
        </View>
      </>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <View style={styles.page}>
        <ScrollView
          contentContainerStyle={[styles.pageContent, { paddingTop: insets.top + 16, paddingBottom: Math.max(insets.bottom, 12) + 120 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor={adminColors.navy} />}
        >
          <AdminPanel style={styles.profileCard}>
            <View style={styles.profileAvatarWrap}>
              {profileImage ? (
                <AppImage uri={profileImage} style={styles.profileAvatarImage} />
              ) : (
                <View style={styles.profileAvatar}>
                  <Text style={styles.profileInitial}>{profileInitial}</Text>
                </View>
              )}
              <View style={styles.onlineDot} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName}>{profileName}</Text>
              <Text style={styles.profileRole}>{profileRole}</Text>
            </View>
            <View style={styles.profileBadge}>
              <Ionicons name="shield-checkmark-outline" size={16} color={adminColors.blue} />
              <Text style={styles.profileBadgeText}>Protected</Text>
            </View>
          </AdminPanel>

          <View style={styles.grid}>
            <AdminPanel style={styles.column}>
              <Text style={styles.sectionTitle}>Platform control</Text>
              <SettingItem
                icon="tool"
                label="Maintenance Mode"
                subLabel="Restrict user access during updates"
                type="toggle"
                value={isMaintenanceMode}
                onValueChange={async (v: boolean) => {
                  setIsMaintenanceMode(v);
                  await storage.setItem('admin:maintenanceMode', String(v)).catch(() => {});
                  await updateAdminPlatformSettings({ maintenance_mode: v }).catch(() => {
                    // Revert UI on failure
                    setIsMaintenanceMode(!v);
                    storage.setItem('admin:maintenanceMode', String(!v)).catch(() => {});
                  });
                }}
              />
              <View style={styles.divider} />
              <SettingItem
                icon="check-circle"
                label="Auto-Approve Sellers"
                subLabel="Skip manual verification for trusted stores"
                type="toggle"
                value={autoApproveSellers}
                onValueChange={async (v: boolean) => {
                  setAutoApproveSellers(v);
                  await storage.setItem('admin:autoApproveSellers', String(v)).catch(() => {});
                  await updateAdminPlatformSettings({ auto_approve_sellers: v }).catch(() => {
                    // Revert UI on failure
                    setAutoApproveSellers(!v);
                    storage.setItem('admin:autoApproveSellers', String(!v)).catch(() => {});
                  });
                }}
                color={adminColors.green}
              />
              <View style={styles.divider} />
              <SettingItem
                icon="send"
                label="Broadcasts"
                subLabel="Send scheduled notifications to users"
                onPress={() => router.push('/admin/broadcasts' as any)}
                color={adminColors.blue}
              />
              <View style={styles.divider} />
              <SettingItem
                icon="dollar-sign"
                label="Fees & Commission"
                subLabel="Manage commission, delivery, and ad fees"
                onPress={() => router.push('/admin/fee-settings' as any)}
                color={adminColors.amber}
              />
            </AdminPanel>

            <AdminPanel style={styles.column}>
              <Text style={styles.sectionTitle}>Security & audit</Text>
              <SettingItem
                icon="lock"
                label="Update Password"
                subLabel="Rotate admin credentials"
                onPress={() => CustomInAppToast.show({ type: 'info', title: 'Security', message: 'Redirecting to security settings...' })}
              />
              <View style={styles.divider} />
              <SettingItem
                icon="list"
                label="System Audit Logs"
                subLabel="Review recent admin actions"
                onPress={() => router.push('/admin/audit-logs' as any)}
              />
              <View style={styles.divider} />
              <SettingItem
                icon="bell"
                label="Admin Notifications"
                subLabel="Keep push alerts enabled"
                type="toggle"
                value={pushNotifications}
                onValueChange={async (v: boolean) => {
                  setPushNotifications(v);
                  await storage.setItem('admin:pushNotifications', String(v)).catch(() => {});
                }}
              />
            </AdminPanel>
          </View>

          <AdminPanel>
            <Text style={styles.sectionTitle}>Logistics</Text>
            <SettingItem
              icon="map-pin"
              label="Hubs & Transit Routes"
              subLabel="Manage delivery hubs and inter-regional lanes"
              onPress={() => router.push('/admin/hubs' as any)}
              color="#059669"
            />
          </AdminPanel>

          <AdminPanel>
            <Text style={styles.sectionTitle}>Content</Text>
            <SettingItem
              icon="tag"
              label="Categories"
              subLabel="Manage product categories"
              onPress={() => router.push('/admin/categories' as any)}
              color="#7C3AED"
            />
            <View style={styles.divider} />
            <SettingItem
              icon="image"
              label="Ads & Campaigns"
              subLabel="Manage banner ads and promotions"
              onPress={() => router.push('/admin/ads' as any)}
              color="#0891B2"
            />
            <View style={styles.divider} />
            <SettingItem
              icon="file-text"
              label="Disclaimers & Terms"
              subLabel="Edit platform legal content and view consent logs"
              onPress={() => router.push('/admin/disclaimers' as any)}
              color="#D97706"
            />
          </AdminPanel>

          <AdminPanel>
            <Text style={styles.sectionTitle}>System info</Text>
            <SettingItem
              icon="help-circle"
              label="Technical Support"
              subLabel="Get help with platform operations"
              onPress={() => {}}
            />
            <View style={styles.divider} />
            <View style={styles.versionRow}>
              <Text style={styles.versionLabel}>Shopyos Admin Version</Text>
              <Text style={styles.versionValue}>{Constants.expoConfig?.version ?? '2.0.4'}</Text>
            </View>
          </AdminPanel>

          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Feather name="log-out" size={20} color={adminColors.red} />
            <Text style={styles.logoutText}>Logout Admin Portal</Text>
          </TouchableOpacity>
        </ScrollView>

        <ConfirmModal
          visible={showLogoutConfirm}
          onClose={() => setShowLogoutConfirm(false)}
          title="Sign Out"
          message="Are you sure you want to log out of the admin portal?"
          icon="⚠️"
          actions={[
            { label: 'Cancel', onPress: () => setShowLogoutConfirm(false), variant: 'cancel' },
            { label: 'Logout', onPress: confirmLogout, variant: 'destructive' },
          ]}
        />
        <AdminBottomNav />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  pageContent: {
    gap: 16,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  profileAvatarWrap: {
    position: 'relative',
  },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileAvatarImage: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: '#DBEAFE',
  },
  profileInitial: {
    color: adminColors.blue,
    fontSize: 26,
    fontFamily: 'Montserrat-Bold',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: adminColors.green,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  profileName: {
    color: adminColors.text,
    fontSize: 22,
    fontFamily: 'Montserrat-Bold',
  },
  profileRole: {
    color: adminColors.textMuted,
    fontSize: 13,
    fontFamily: 'Montserrat-Regular',
    marginTop: 4,
  },
  profileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#EFF6FF',
  },
  profileBadgeText: {
    color: adminColors.blue,
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  column: {
    flex: 1,
    minWidth: 280,
  },
  sectionTitle: {
    color: adminColors.text,
    fontSize: 18,
    fontFamily: 'Montserrat-Bold',
    marginBottom: 10,
  },
  settingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  iconBg: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingText: {
    flex: 1,
    marginLeft: 14,
  },
  settingLabel: {
    fontSize: 15,
    fontFamily: 'Montserrat-Bold',
    color: adminColors.text,
  },
  settingSubLabel: {
    fontSize: 12,
    color: adminColors.textMuted,
    fontFamily: 'Montserrat-Regular',
    marginTop: 3,
  },
  divider: {
    height: 1,
    backgroundColor: adminColors.border,
  },
  versionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 14,
  },
  versionLabel: {
    fontSize: 13,
    fontFamily: 'Montserrat-Regular',
    color: adminColors.textMuted,
  },
  versionValue: {
    fontSize: 13,
    fontFamily: 'Montserrat-Bold',
    color: adminColors.navy,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 18,
    backgroundColor: '#FEF2F2',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  logoutText: {
    color: adminColors.red,
    fontFamily: 'Montserrat-Bold',
    fontSize: 15,
  },
});
