import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, ActivityIndicator } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import * as Location from 'expo-location';
import {
  getLocationSharingPreference,
  setLocationSharingPreference,
  requestLocationPermissions,
} from '@/src/background/controller';
import { useQueryClient } from '@tanstack/react-query';
import { getDriverProfile, getUserData, CustomInAppToast, uploadAvatar, updateDriverAvailability, logoutUser, getNotificationPreferences, updateNotificationPreferences } from '@/services/api';
import { useActiveDeliveries } from '@/hooks/useDelivery';
import { requestAccountDeletion } from '@/services/auth';
import { useAuthStore } from '@/store/authStore';
import { useImagePickerSheet } from '@/hooks/useImagePickerSheet';
import TappableAvatar from '@/components/TappableAvatar';
import LocationDisclosure from '@/components/ui/LocationDisclosure';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';
// removed useCloudinaryUpload import
function SettingRow({ icon, label, value, onPress }: Readonly<{ icon: any; label: string; value?: string; onPress?: () => void }>) {
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
        <Text style={styles.rowValue}>{value}</Text>
        <Feather name="chevron-right" size={18} color={colors.textMuted} />
      </View>
    </TouchableOpacity>
  );
}

function ToggleRow({ icon, label, value, onToggle, description }: Readonly<{ icon: any; label: string; value: boolean; onToggle: (v: boolean) => void; description?: string }>) {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <View style={styles.iconCircle}>
          <Feather name={icon} size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowLabel}>{label}</Text>
          {description && <Text style={styles.rowDescription}>{description}</Text>}
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: colors.borderStrong, true: colors.accent }}
        thumbColor={value ? colors.primary : colors.textMuted}
      />
    </View>
  );
}

export default function DriverSettings() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const switchToBuyerMode = useAuthStore((s) => s.switchToBuyerMode);
  const [shareLiveLocation, setShareLiveLocation] = useState(false);
  // Tracks whether "Always" (background) access is actually granted — location
  // sharing can still be enabled without it, just degraded to foreground-only
  // (see finishEnablingLocationSharing).
  const [backgroundLocationGranted, setBackgroundLocationGranted] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [driver, setDriver] = useState<any>(null);
  const [, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [showLocationDisclosure, setShowLocationDisclosure] = useState(false);
  const [notificationsOn, setNotificationsOn] = useState(true);
  // Load profile and preferences on mount
  useEffect(() => {
    loadData();
  }, []);
  const loadData = async () => {
    try {
      setLoading(true);
      const [u, d, locPref, notifPrefs] = await Promise.all([
        getUserData(),
        getDriverProfile(),
        getLocationSharingPreference(),
        getNotificationPreferences().catch(() => null),
      ]);
      setUser(u);
      setDriver(d?.profile || d);
      setShareLiveLocation(locPref);
      if (notifPrefs?.success) setNotificationsOn(notifPrefs.preferences.push_enabled);
      const bg = await Location.getBackgroundPermissionsAsync();
      setBackgroundLocationGranted(bg.status === 'granted');
    } catch (error) {
      console.error('Failed to load settings data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationToggle = async (value: boolean) => {
    setNotificationsOn(value);
    try {
      await updateNotificationPreferences({ push_enabled: value });
    } catch (error) {
      console.error('Failed to update notification preference:', error);
      setNotificationsOn(!value);
      CustomInAppToast.show({ type: 'error', title: 'Error', message: 'Failed to update notification preference.' });
    }
  };

  const { data: activeData } = useActiveDeliveries();
  const activeDeliveries = activeData?.deliveries || [];
  const handleOpenNavigationApp = () => {
    if (activeDeliveries.length === 0) {
      CustomInAppToast.show({ type: 'info', title: 'No Active Delivery', message: 'Navigation opens automatically once you have an active delivery.' });
      return;
    }
    router.push({ pathname: '/driver/activeOrder', params: { deliveryId: activeDeliveries[0].id } } as any);
  };
  const showImagePicker = useImagePickerSheet();
  const pickImage = async () => {
    try {
      const uri = await showImagePicker({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (!uri) return;
      setUploading(true);
      const res = await uploadAvatar(uri);
      if (res && res.success) {
        setUser({ ...user, avatar_url: res.data.url });
        CustomInAppToast.show({ type: 'success', title: 'Profile Updated', message: 'Profile photo updated successfully!' });
        queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      }
    } catch (error) {
      console.error('Failed to pick/upload image:', error);
      alert('Failed to update profile photo.');
    } finally {
      setUploading(false);
      setSaving(false);
    }
  };
  const finishEnablingLocationSharing = async () => {
    try {
      const permissions = await requestLocationPermissions();
      if (!permissions.foreground) {
        CustomInAppToast.show({
          type: 'error',
          title: 'Permission Required',
          message: 'Location permission is required to share your live location during deliveries.'
        });
        return;
      }
      // "Always" (background) access is best-effort, not required — without
      // it, sharing still works but only while the app is open/foregrounded.
      setBackgroundLocationGranted(permissions.background);
      await savePreference(true, permissions.background);
    } catch (error) {
      console.error('Error toggling location sharing:', error);
      CustomInAppToast.show({ type: 'error', title: 'Error', message: 'Failed to update location sharing preference.' });
    }
  };

  const savePreference = async (value: boolean, backgroundGranted = backgroundLocationGranted) => {
    await setLocationSharingPreference(value);
    setShareLiveLocation(value);
    // Invalidate queries to trigger useBackgroundTasks to re-evaluate
    queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    const enabledMessage = backgroundGranted
      ? 'Your location will be shared during active deliveries, even while the app is in the background.'
      : "Your location will be shared while the app is open. To keep sharing when your screen locks or you switch apps, enable \"Always\" location access in Settings.";
    CustomInAppToast.show({
      type: 'success',
      title: value ? 'Location Sharing Enabled' : 'Location Sharing Disabled',
      message: value ? enabledMessage : 'Your location will no longer be shared.'
    });
  };

  const handleLocationToggle = async (value: boolean) => {
    try {
      if (!value) {
        await savePreference(false);
        return;
      }
      // An unverified driver can never actually have an active delivery, so
      // there's no legitimate feature behind this permission request yet —
      // requesting background location here anyway is exactly the kind of
      // unjustified prompt Apple's guideline 2.5.4 flags. Gate it the same
      // way the dashboard's "go online" toggle already does.
      const isVerified = driver?.is_verified === true || driver?.is_verified === 1 || driver?.verification_status === 'verified';
      if (!isVerified) {
        CustomInAppToast.show({
          type: 'error',
          title: 'Verification Required',
          message: 'You must be a verified driver before you can share your live location.',
        });
        return;
      }
      // Already granted — no need to show the disclosure again
      const [fg, bg] = await Promise.all([
        Location.getForegroundPermissionsAsync(),
        Location.getBackgroundPermissionsAsync(),
      ]);
      if (fg.status === 'granted' && bg.status === 'granted') {
        await finishEnablingLocationSharing();
        return;
      }
      // Show the Prominent Disclosure before requesting background location
      setShowLocationDisclosure(true);
    } catch (error) {
      console.error('Error toggling location sharing:', error);
      CustomInAppToast.show({ type: 'error', title: 'Error', message: 'Failed to update location sharing preference.' });
    }
  };

  const handleDisclosureAccept = async () => {
    setShowLocationDisclosure(false);
    await finishEnablingLocationSharing();
  };

  const handleLogout = async () => {
    try {
      setLogoutLoading(true);
      try {
        await updateDriverAvailability(false);
      } catch (err) {
        console.warn('Failed to set driver offline during logout:', err);
      }
      await logoutUser();
      CustomInAppToast.show({
        type: 'success',
        title: 'Logged Out',
        message: 'You have been successfully logged out.'
      });
      router.replace('/login');
    } catch {
      router.replace('/login');
    } finally {
      setLogoutLoading(false);
    }
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const confirmDeleteAccount = async () => {
    setShowDeleteConfirm(false);
    try {
      await requestAccountDeletion();
      CustomInAppToast.show({ type: 'info', title: 'Request Submitted', message: 'Your account deletion request has been received. Your account will be permanently removed after 7 days, once any outstanding orders are settled.' });
      await logoutUser();
      router.replace('/getstarted' as any);
    } catch (e: any) {
      CustomInAppToast.show({ type: 'error', title: 'Request Failed', message: e.message || 'Could not submit deletion request.' });
    }
  };
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Stack.Screen options={{ headerShown: false }} />
      {/* --- Fixed Header --- */}
      <LinearGradient colors={colors.headerGradient} style={styles.header}>
        <SafeAreaView edges={['top', 'left', 'right']}>
          <View style={styles.navBar}>
            <View style={{ width: 24 }} />
            <Text style={styles.headerTitle}>Driver Profile</Text>
            <View style={{ width: 24 }} />
          </View>
          <View style={styles.profileCard}>
            {saving || uploading ? (
              <View style={[styles.avatarWrapper, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={colors.accent} />
              </View>
            ) : (
              <TappableAvatar
                uri={user?.avatar_url}
                size={86}
                label={user?.name || 'Driver'}
                onEditPress={pickImage}
                style={{ marginBottom: 8 }}
              />
            )}
            <Text style={styles.name}>{user?.name || 'Driver'}</Text>
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={14} color="#F59E0B" />
              <Text style={styles.ratingText}>
                {Number(driver?.average_rating ?? 0).toFixed(1)} ({driver?.total_deliveries || 0} deliveries)
              </Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>
      {/* --- Scrollable Content --- */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.section}>
          <SettingRow icon="shield" label="Update Verification Details" onPress={() => router.push('/driver/onboarding' as any)} />
        </View>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={styles.section}>
          <ToggleRow
            icon="map-pin"
            label="Share Live Location"
            description={
              shareLiveLocation && !backgroundLocationGranted
                ? 'Foreground only — enable "Always" location access in Settings to keep sharing in the background'
                : 'Share your location during active deliveries'
            }
            value={shareLiveLocation}
            onToggle={handleLocationToggle}
          />
          <SettingRow icon="map" label="Navigate to Delivery" onPress={handleOpenNavigationApp} />
          <ToggleRow
            icon="bell"
            label="Sound & Notification"
            value={notificationsOn}
            onToggle={handleNotificationToggle}
          />
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <SettingRow icon="alert-circle" label="Raise a Report" onPress={() => router.push('/support' as any)} />
          <SettingRow icon="list" label="My Reports" onPress={() => router.push('/support/my-tickets' as any)} />
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Danger Zone</Text>
          <SettingRow icon="trash-2" label="Delete Account" onPress={() => setShowDeleteConfirm(true)} />
        </View>
        <TouchableOpacity
          style={styles.shopBtn}
          onPress={() => {
            switchToBuyerMode('driver');
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
            <Text style={styles.logoutText}>Stop Driving (Logout)</Text>
          )}
        </TouchableOpacity>
        {/* Extra Space at bottom for safe scrolling */}
        <View style={{ height: 40 }} />
      </ScrollView>

      <ConfirmModal
        visible={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Account"
        message={
          'This permanently deletes your account and all associated data after a 7-day grace period. This cannot be undone once processed.\n\n' +
          '• You will be signed out of all devices immediately and will not be able to log in again.\n' +
          '• Any outstanding deliveries and payout balances must be settled before deletion is finalized.\n' +
          '• To cancel, contact support within the 7-day window.'
        }
        icon="⚠️"
        actions={[
          { label: 'Cancel', onPress: () => setShowDeleteConfirm(false), variant: 'cancel' },
          { label: 'Delete My Account', onPress: confirmDeleteAccount, variant: 'destructive' },
        ]}
      />

      {/* Purely educational — the real system prompt must always follow it
          (Apple guideline 5.1.1(iv)), so there's no separate decline path. */}
      <LocationDisclosure
        visible={showLocationDisclosure}
        context="driver"
        onAccept={handleDisclosureAccept}
      />
    </View>
  );
}
const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingBottom: 30,
    paddingHorizontal: 20,
    zIndex: 10,
    elevation: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  navBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerTitle: { fontSize: 18, color: '#FFF', fontFamily: 'Montserrat-Bold' },
  profileCard: { alignItems: 'center' },
  avatarWrapper: { position: 'relative', marginBottom: 10 },
  avatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: colors.accent, backgroundColor: colors.surface },
  cameraBadge: {
    position: 'absolute', bottom: 0, right: 0,
    backgroundColor: colors.accent, width: 28, height: 28,
    borderRadius: 14, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: colors.headerGradient[0],
  },
  name: { fontSize: 20, fontFamily: 'Montserrat-Bold', color: '#FFF', marginBottom: 5 },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15 },
  ratingText: { color: '#FFF', marginLeft: 5, fontFamily: 'Montserrat-Medium', fontSize: 12 },
  // Scroll Layout
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 120 },
  sectionTitle: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: colors.textSecondary, marginBottom: 10, marginTop: 10, textTransform: 'uppercase' },
  section: { backgroundColor: colors.surface, borderRadius: 16, padding: 5, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  rowLabel: { fontSize: 15, color: colors.text, fontFamily: 'Montserrat-Medium' },
  rowDescription: { fontSize: 12, color: colors.textSecondary, fontFamily: 'Montserrat-Regular', marginTop: 2 },
  rowRight: { flexDirection: 'row', alignItems: 'center' },
  rowValue: { fontSize: 14, color: colors.textSecondary, marginRight: 8, fontFamily: 'Montserrat-Regular' },
  shopBtn: {
    backgroundColor: colors.border, padding: 16, borderRadius: 16, alignItems: 'center',
    marginTop: 20, marginBottom: 8, flexDirection: 'row', justifyContent: 'center', gap: 8,
  },
  shopBtnText: { color: '#1D4ED8', fontFamily: 'Montserrat-Bold', fontSize: 16 },
  logoutBtn: { backgroundColor: '#FEE2E2', padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 0, marginBottom: 10 },
  logoutText: { color: '#DC2626', fontFamily: 'Montserrat-Bold', fontSize: 16 },
});
