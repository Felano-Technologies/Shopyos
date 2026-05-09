import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import AdminShell, { AdminPanel } from '@/components/admin/AdminShell';
import { adminColors } from '@/components/admin/adminTheme';

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
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [autoApproveSellers, setAutoApproveSellers] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      router.replace('/login');
    } finally {
      setIsLoggingOut(false);
      setShowLogoutModal(false);
    }
  };

  return (
    <>
      <StatusBar style="dark" />
      <AdminShell
        title="Settings"
        subtitle="Adjust platform controls, admin notifications, and account-level security preferences."
      >
        <View style={styles.page}>
          <AdminPanel style={styles.profileCard}>
            <View style={styles.profileAvatarWrap}>
              <View style={styles.profileAvatar}>
                <Text style={styles.profileInitial}>A</Text>
              </View>
              <View style={styles.onlineDot} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName}>Admin</Text>
              <Text style={styles.profileRole}>Super Administrator</Text>
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
                onValueChange={setIsMaintenanceMode}
              />
              <View style={styles.divider} />
              <SettingItem
                icon="check-circle"
                label="Auto-Approve Sellers"
                subLabel="Skip manual verification for trusted stores"
                type="toggle"
                value={autoApproveSellers}
                onValueChange={setAutoApproveSellers}
                color={adminColors.green}
              />
            </AdminPanel>

            <AdminPanel style={styles.column}>
              <Text style={styles.sectionTitle}>Security & audit</Text>
              <SettingItem
                icon="lock"
                label="Update Password"
                subLabel="Rotate admin credentials"
                onPress={() => Alert.alert('Security', 'Redirecting to security settings...')}
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
                onValueChange={setPushNotifications}
              />
            </AdminPanel>
          </View>

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
              <Text style={styles.versionValue}>v2.0.4-Build</Text>
            </View>
          </AdminPanel>

          <TouchableOpacity style={styles.logoutBtn} onPress={() => setShowLogoutModal(true)}>
            <Feather name="log-out" size={20} color={adminColors.red} />
            <Text style={styles.logoutText}>Logout Admin Portal</Text>
          </TouchableOpacity>

          <Modal visible={showLogoutModal} transparent animationType="fade" onRequestClose={() => !isLoggingOut && setShowLogoutModal(false)}>
            <Pressable style={styles.logoutModalOverlay} onPress={() => !isLoggingOut && setShowLogoutModal(false)}>
              <Pressable style={styles.logoutModalCard} onPress={(e) => e.stopPropagation()}>
                <View style={styles.logoutModalIcon}>
                  <Feather name="log-out" size={22} color={adminColors.red} />
                </View>
                <Text style={styles.logoutModalTitle}>Sign Out of Admin Portal?</Text>
                <Text style={styles.logoutModalText}>This will end your admin session on this device.</Text>
                <View style={styles.logoutModalActions}>
                  <TouchableOpacity style={styles.logoutModalCancelBtn} onPress={() => setShowLogoutModal(false)} disabled={isLoggingOut}>
                    <Text style={styles.logoutModalCancelTxt}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.logoutModalConfirmBtn, isLoggingOut && { opacity: 0.7 }]} onPress={handleLogout} disabled={isLoggingOut}>
                    {isLoggingOut ? <ActivityIndicator color="#FFF" /> : <Text style={styles.logoutModalConfirmTxt}>Sign Out</Text>}
                  </TouchableOpacity>
                </View>
              </Pressable>
            </Pressable>
          </Modal>
        </View>
      </AdminShell>
    </>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    gap: 16,
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
    marginBottom: 120,
  },
  logoutText: {
    color: adminColors.red,
    fontFamily: 'Montserrat-Bold',
    fontSize: 15,
  },
  logoutModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  logoutModalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: adminColors.border,
    padding: 20,
  },
  logoutModalIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 12,
  },
  logoutModalTitle: {
    textAlign: 'center',
    color: adminColors.text,
    fontSize: 18,
    fontFamily: 'Montserrat-Bold',
  },
  logoutModalText: {
    marginTop: 8,
    textAlign: 'center',
    color: adminColors.textMuted,
    fontSize: 13,
    fontFamily: 'Montserrat-Medium',
  },
  logoutModalActions: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 10,
  },
  logoutModalCancelBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 12,
  },
  logoutModalCancelTxt: {
    color: '#475569',
    fontSize: 13,
    fontFamily: 'Montserrat-Bold',
  },
  logoutModalConfirmBtn: {
    flex: 1,
    backgroundColor: adminColors.red,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  logoutModalConfirmTxt: {
    color: '#FFF',
    fontSize: 13,
    fontFamily: 'Montserrat-Bold',
  },
});
