import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
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
import AdminShell, { AdminPanel } from '@/components/admin/AdminShell';
import { adminColors } from '@/components/admin/adminTheme';
import { getUserData } from '@/services/api';

// ---------------------------------------------------------------------------
// Reusable row primitives
// ---------------------------------------------------------------------------

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function SettingItem({
  icon,
  label,
  subLabel,
  type,
  value,
  onValueChange,
  onPress,
  color = adminColors.navy,
  destructive = false,
  isLast = false,
}: any) {
  const tint = destructive ? adminColors.red : color;
  return (
    <TouchableOpacity
      style={[styles.settingCard, isLast && styles.settingCardLast]}
      onPress={onPress}
      disabled={type === 'toggle'}
      activeOpacity={type === 'toggle' ? 1 : 0.6}
    >
      <View style={[styles.iconBg, { backgroundColor: `${tint}14` }]}>
        <Feather name={icon} size={18} color={tint} />
      </View>
      <View style={styles.settingText}>
        <Text style={[styles.settingLabel, destructive && { color: adminColors.red }]}>
          {label}
        </Text>
        {subLabel ? <Text style={styles.settingSubLabel}>{subLabel}</Text> : null}
      </View>
      {type === 'toggle' ? (
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: '#E2E8F0', true: adminColors.navy }}
          thumbColor="#FFFFFF"
          ios_backgroundColor="#E2E8F0"
        />
      ) : (
        <Feather name="chevron-right" size={18} color={adminColors.textSoft} />
      )}
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function AdminSettings() {
  const router = useRouter();
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [autoApproveSellers, setAutoApproveSellers] = useState(false);
  const [profileName, setProfileName] = useState('Admin');
  const [profileRole, setProfileRole] = useState('Super Administrator');
  const [profileImage, setProfileImage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await getUserData();
        const user = data?.user || data || {};
        if (!mounted) return;
        const name = user?.name || user?.full_name || 'Admin';
        const role = user?.role || user?.account_type || 'Super Administrator';
        const avatar = user?.avatar_url || user?.avatar || null;
        setProfileName(name);
        setProfileRole(
          String(role)
            .replaceAll('_', ' ')
            .replace(/\b\w/g, (m: string) => m.toUpperCase())
        );
        setProfileImage(avatar);
      } catch {
        // Keep defaults if profile fetch fails.
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const profileInitial = useMemo(
    () => (profileName || 'A').trim().charAt(0).toUpperCase(),
    [profileName]
  );

  const handleLogout = () => {
    Alert.alert('Log out', 'You will need to sign in again to access the admin portal.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => router.replace('/login') },
    ]);
  };

  return (
    <>
      <StatusBar style="dark" />
      <AdminShell>
        <ScrollView
          style={styles.page}
          contentContainerStyle={styles.pageContent}
          showsVerticalScrollIndicator={false}
          bounces
        >
          {/* Header */}
          <View style={styles.pageHeader}>
            <Text style={styles.pageTitle}>Settings</Text>
            <Text style={styles.pageSubtitle}>Manage your account and platform preferences</Text>
          </View>

          {/* Profile */}
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
              <Text style={styles.profileName} numberOfLines={1}>
                {profileName}
              </Text>
              <Text style={styles.profileRole}>{profileRole}</Text>
            </View>
            <View style={styles.profileBadge}>
              <Ionicons name="shield-checkmark-outline" size={14} color={adminColors.blue} />
              <Text style={styles.profileBadgeText}>Protected</Text>
            </View>
          </AdminPanel>

          {/* Platform control */}
          <View style={styles.section}>
            <SectionHeader title="Platform control" />
            <AdminPanel style={styles.groupCard}>
              <SettingItem
                icon="tool"
                label="Maintenance mode"
                subLabel="Restrict user access during updates"
                type="toggle"
                value={isMaintenanceMode}
                onValueChange={setIsMaintenanceMode}
                color={adminColors.navy}
              />
              <View style={styles.divider} />
              <SettingItem
                icon="check-circle"
                label="Auto-approve sellers"
                subLabel="Skip manual verification for trusted stores"
                type="toggle"
                value={autoApproveSellers}
                onValueChange={setAutoApproveSellers}
                color={adminColors.green}
                isLast
              />
            </AdminPanel>
          </View>

          {/* Security & audit */}
          <View style={styles.section}>
            <SectionHeader title="Security & audit" />
            <AdminPanel style={styles.groupCard}>
              <SettingItem
                icon="lock"
                label="Update password"
                subLabel="Rotate admin credentials"
                onPress={() => Alert.alert('Security', 'Redirecting to security settings...')}
              />
              <View style={styles.divider} />
              <SettingItem
                icon="shield"
                label="Two-factor authentication"
                subLabel="Add an extra layer of protection"
                onPress={() => Alert.alert('Security', 'Redirecting to two-factor setup...')}
              />
              <View style={styles.divider} />
              <SettingItem
                icon="list"
                label="System audit logs"
                subLabel="Review recent admin actions"
                onPress={() => router.push('/admin/audit-logs' as any)}
                isLast
              />
            </AdminPanel>
          </View>

          {/* Notifications */}
          <View style={styles.section}>
            <SectionHeader title="Notifications" />
            <AdminPanel style={styles.groupCard}>
              <SettingItem
                icon="bell"
                label="Push notifications"
                subLabel="Get alerted about important admin events"
                type="toggle"
                value={pushNotifications}
                onValueChange={setPushNotifications}
                isLast
              />
            </AdminPanel>
          </View>

          {/* System info */}
          <View style={styles.section}>
            <SectionHeader title="System info" />
            <AdminPanel style={styles.groupCard}>
              <SettingItem
                icon="help-circle"
                label="Technical support"
                subLabel="Get help with platform operations"
                onPress={() => {}}
              />
              <View style={styles.divider} />
              <View style={[styles.settingCard, styles.settingCardLast]}>
                <View style={[styles.iconBg, { backgroundColor: `${adminColors.textMuted}14` }]}>
                  <Feather name="info" size={18} color={adminColors.textMuted} />
                </View>
                <View style={styles.settingText}>
                  <Text style={styles.settingLabel}>Version</Text>
                  <Text style={styles.settingSubLabel}>Shopyos Admin</Text>
                </View>
                <Text style={styles.versionValue}>v2.0.4</Text>
              </View>
            </AdminPanel>
          </View>

          {/* Danger zone / account */}
          <View style={styles.section}>
            <SectionHeader title="Account" />
            <AdminPanel style={styles.groupCard}>
              <SettingItem
                icon="log-out"
                label="Log out"
                subLabel="Sign out of the admin portal on this device"
                onPress={handleLogout}
                destructive
                isLast
              />
            </AdminPanel>
          </View>
        </ScrollView>
      </AdminShell>
    </>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  pageContent: {
    paddingBottom: 48,
    gap: 4,
  },
  pageHeader: {
    marginBottom: 4,
  },
  pageTitle: {
    color: adminColors.text,
    fontSize: 26,
    fontFamily: 'Montserrat-Bold',
  },
  pageSubtitle: {
    color: adminColors.textMuted,
    fontSize: 13,
    fontFamily: 'Montserrat-Regular',
    marginTop: 4,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 20,
  },
  profileAvatarWrap: {
    position: 'relative',
  },
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileAvatarImage: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: '#DBEAFE',
  },
  profileInitial: {
    color: adminColors.blue,
    fontSize: 24,
    fontFamily: 'Montserrat-Bold',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: adminColors.green,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  profileName: {
    color: adminColors.text,
    fontSize: 19,
    fontFamily: 'Montserrat-Bold',
  },
  profileRole: {
    color: adminColors.textMuted,
    fontSize: 13,
    fontFamily: 'Montserrat-Regular',
    marginTop: 3,
  },
  profileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#EFF6FF',
  },
  profileBadgeText: {
    color: adminColors.blue,
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 11,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    color: adminColors.textMuted,
    fontSize: 12,
    fontFamily: 'Montserrat-SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginLeft: 4,
  },
  groupCard: {
    paddingVertical: 4,
  },
  settingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
  },
  settingCardLast: {
    paddingBottom: 10,
  },
  iconBg: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingText: {
    flex: 1,
    marginLeft: 14,
    marginRight: 8,
  },
  settingLabel: {
    fontSize: 14.5,
    fontFamily: 'Montserrat-Bold',
    color: adminColors.text,
  },
  settingSubLabel: {
    fontSize: 12,
    color: adminColors.textMuted,
    fontFamily: 'Montserrat-Regular',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: adminColors.border,
  },
  versionValue: {
    fontSize: 13,
    fontFamily: 'Montserrat-Bold',
    color: adminColors.textMuted,
  },
});