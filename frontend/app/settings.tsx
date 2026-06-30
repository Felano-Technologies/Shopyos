import React, { useState, useEffect, useCallback, useRef } from 'react';
import TappableAvatar from '@/components/TappableAvatar';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  Modal,
  Pressable,
  StatusBar,
  Animated,
  ActivityIndicator,
} from 'react-native';
import AppImage from '@/components/AppImage';
import { useOnboarding } from '@/context/OnboardingContext';
import { SpotlightTour } from '@/components/ui/SpotlightTour';
import {  Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { getUserData, getNotificationPreferences, updateNotificationPreferences, logoutUser, storage, baseURL } from '@/services/api';

const LOCAL_AVATAR_CACHE_KEY = 'lastUploadedAvatarUri';
const toDisplayAvatarUrl = (raw?: string | null) => {
  if (!raw) return null;
  const value = String(raw).trim();
  if (!value) return null;

  if (/^https?:\/\//i.test(value)) {
    // Uploaded media may come back as http; prefer https for remote hosts.
    if (value.startsWith('http://') && !/http:\/\/(localhost|127\.0\.0\.1|10\.)/i.test(value)) {
      return value.replace(/^http:\/\//i, 'https://');
    }
    return value;
  }

  // Absolute app-hosted path
  if (value.startsWith('/')) return `${baseURL}${value}`;

  // Opaque storage keys (e.g. "shopyos/avatars/...") should be left untouched
  // if the API already returns full public URLs. Returning null avoids broken image fetches.
  return null;
};
const isLocalhostLikeUrl = (value?: string | null) =>
  !!value && /https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)/i.test(value);

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [username, setUsername] = useState('User');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Toggles State
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  // --- Onboarding ---
  const { startTour, markCompleted, isTourActive, activeScreen } = useOnboarding();
  const [layouts, setLayouts] = useState<any>({});
  const refProfile = useRef<View>(null);
  const refEdit = useRef<View>(null);
  const refAccount = useRef<View>(null);
  const measureElement = (ref: any, key: string) => {
    if (ref.current) {
      ref.current.measureInWindow((x: number, y: number, width: number, height: number) => {
        setLayouts((prev: any) => ({ ...prev, [key]: { x, y, width, height } }));
      });
    }
  };
  useEffect(() => {
    const timer = setTimeout(() => {
      measureElement(refProfile, 'profile');
      measureElement(refEdit, 'edit');
      measureElement(refAccount, 'account');
      startTour('settings');
    }, 1500);
    return () => clearTimeout(timer);
  }, [startTour]);
  const onboardingSteps = [
    {
      targetLayout: layouts.profile,
      title: 'Your Identity',
      description: 'This is how stores and drivers will identify you during transactions.',
    },
    {
      targetLayout: layouts.edit,
      title: 'Update Profile',
      description: 'Tap here to change your name, phone number, or profile picture.',
    },
    {
      targetLayout: layouts.account,
      title: 'Manage Account',
      description: 'Add payment methods and check your transaction history here.',
    },
  ].filter(s => !!s.targetLayout);
  const handleOnboardingComplete = () => {
    markCompleted('settings');
  };
  // Skeleton Animation Value
  const skeletonAnim = React.useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(skeletonAnim, {
          toValue: 0.8,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(skeletonAnim, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [skeletonAnim]);
  useFocusEffect(
    useCallback(() => {
      const fetchUserData = async () => {
        setIsLoading(true);
        try {
          const userData = await getUserData();
          if (userData) {
            const profile = userData.user || userData;
            let resolvedAvatar = toDisplayAvatarUrl(profile.avatar_url || profile.avatar || null);
            if (isLocalhostLikeUrl(resolvedAvatar)) {
              const cachedLocalAvatar = await storage.getItem(LOCAL_AVATAR_CACHE_KEY);
              if (cachedLocalAvatar) resolvedAvatar = cachedLocalAvatar;
            }
            setUsername(profile.name || 'User');
            setEmail(profile.email || '');
            setAvatarUrl(resolvedAvatar);
          }
          const prefs = await getNotificationPreferences();
          if (prefs?.success) {
            setNotificationsEnabled(prefs.preferences.push_enabled);
          }
        } catch (error) {
          console.log('Error loading settings', error);
        } finally {
          setIsLoading(false);
        }
      };
      fetchUserData();
    }, [])
  );
  const handleNotificationToggle = async (value: boolean) => {
    setNotificationsEnabled(value);
    try {
      await updateNotificationPreferences({ push_enabled: value });
    } catch (error) {
      console.error('Failed to update notification preference:', error);
      // Revert UI on failure
      setNotificationsEnabled(!value);
    }
  };
  const handleLogout = async () => {
    setLogoutModalVisible(true);
  };

  const confirmLogout = async () => {
    try {
      setLogoutLoading(true);
      await logoutUser();
      setLogoutModalVisible(false);
      router.replace('/login');
    } catch (error) {
      console.error('Logout error:', error);
      setLogoutModalVisible(false);
      router.replace('/login');
    } finally {
      setLogoutLoading(false);
    }
  };
  const renderSettingItem = ({
    icon,
    label,
    onPress,
    color = '#0F172A',
    isDestructive = false,
    rightElement = null
  }: any) => (
    <TouchableOpacity
      accessibilityLabel={label}
      accessibilityRole="button"
      style={styles.settingItem}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!!rightElement && !onPress} // Disable press if it's a switch row only
    >
      <View style={[styles.iconBox, { backgroundColor: isDestructive ? '#FEF2F2' : '#F1F5F9' }]}>
        <Feather name={icon} size={20} color={isDestructive ? '#EF4444' : '#0C1559'} />
      </View>
      <Text style={[styles.settingLabel, isDestructive && styles.destructiveLabel]}>
        {label}
      </Text>
      {rightElement ?? (
        <Feather name="chevron-right" size={20} color="#CBD5E1" />
      )}
    </TouchableOpacity>
  );
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C1559" />
      {/* --- HEADER --- */}
      <LinearGradient colors={['#0C1559', '#1e3a8a']} style={styles.headerContainer}>
        <View style={styles.hdrGlow1} pointerEvents="none" />
        <View style={styles.hdrGlow2} pointerEvents="none" />
        <AppImage
          source={require('../assets/images/splash-icon.png')}
          style={styles.headerWatermark}
        />
          <View style={[styles.headerContent, { paddingTop: insets.top + 10 }]}>
            <Text style={styles.screenTitle}>Settings</Text>
            {/* Profile Header (WhatsApp-style) */}
            {isLoading ? (
              <View style={styles.profileCard}>
                <Animated.View style={[styles.avatarSkeleton, { opacity: skeletonAnim }]} />
                <View style={styles.profileInfo}>
                  <Animated.View style={[styles.nameSkeleton, { opacity: skeletonAnim }]} />
                  <Animated.View style={[styles.emailSkeleton, { opacity: skeletonAnim }]} />
                </View>
              </View>
            ) : (
              <View
                style={styles.profileCard}
                ref={refProfile}
                onLayout={() => measureElement(refProfile, 'profile')}
              >
                <TappableAvatar
                  uri={avatarUrl}
                  size={72}
                  label={username}
                  fallbackText={username.charAt(0)}
                  style={{ marginRight: 4 }}
                />
                <TouchableOpacity
                  accessibilityLabel="View and edit profile"
                  accessibilityRole="button"
                  activeOpacity={0.7}
                  style={styles.profileInfo}
                  onPress={() => router.push('/settings/Account')}
                >
                  <Text style={styles.profileName}>{username}</Text>
                  <Text style={styles.profileEmail}>{email || 'View and edit profile'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityLabel="Edit profile"
                  accessibilityRole="button"
                  activeOpacity={0.7}
                  style={styles.profileAction}
                  onPress={() => router.push('/settings/Account')}
                  ref={refEdit}
                  onLayout={() => measureElement(refEdit, 'edit')}
                >
                  <Feather name="chevron-right" size={20} color="#E2E8F0" />
                </TouchableOpacity>
              </View>
            )}
          </View>
          <View style={styles.hdrArc} />
      </LinearGradient>
      {/* --- CONTENT --- */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Section: Account */}
        <Text style={styles.sectionHeader}>Account</Text>
        <View style={styles.sectionCard} ref={refAccount} onLayout={() => measureElement(refAccount, 'account')}>
          {renderSettingItem({
            icon: 'user',
            label: 'Personal Information',
            onPress: () => router.push('/settings/Account')
          })}
          <View style={styles.separator} />
          {renderSettingItem({
            icon: 'heart',
            label: 'My Favorites',
            onPress: () => router.push('/favorites')
          })}
          <View style={styles.separator} />
          {renderSettingItem({
            icon: 'tag',
            label: 'My Bargains',
            onPress: () => router.push('/bargain/my-offers')
          })}
          <View style={styles.separator} />
          {renderSettingItem({
            icon: 'credit-card',
            label: 'Payment Methods',
            onPress: () => router.push('/settings/paymentMethods')
          })}
          <View style={styles.separator} />
          {renderSettingItem({
            icon: 'list',
            label: 'Transaction History',
            onPress: () => router.push('/settings/Transactions')
          })}
          <View style={styles.separator} />
          {renderSettingItem({
            icon: 'star',
            label: 'Loyalty Points',
            onPress: () => router.push('/settings/loyaltyPoints')
          })}
          <View style={styles.separator} />
          {renderSettingItem({
            icon: 'bar-chart-2',
            label: 'Shopping Stats',
            onPress: () => router.push('/analytics')
          })}
          <View style={styles.separator} />
          {renderSettingItem({
            icon: 'refresh-ccw',
            label: 'My Returns',
            onPress: () => router.push('/returns')
          })}
        </View>
        {/* Section: Preferences */}
        <Text style={styles.sectionHeader}>Preferences</Text>
        <View style={styles.sectionCard}>
          {renderSettingItem({
            icon: 'bell',
            label: 'Push Notifications',
            onPress: null, // No navigation
            rightElement: (
              <Switch
                accessibilityLabel={`Notifications ${notificationsEnabled ? 'enabled' : 'disabled'}`}
                accessibilityRole="switch"
                value={notificationsEnabled}
                onValueChange={handleNotificationToggle}
                trackColor={{ false: '#E2E8F0', true: '#84cc16' }}
                thumbColor={'#FFF'}
              />
            )
          })}
          <View style={styles.separator} />
        </View>
        {/* Section: Support & Legal */}
        <Text style={styles.sectionHeader}>Support</Text>
        <View style={styles.sectionCard}>
          {renderSettingItem({
            icon: 'alert-circle',
            label: 'Raise a Report',
            onPress: () => router.push('/support' as any)
          })}
          <View style={styles.separator} />
          {renderSettingItem({
            icon: 'list',
            label: 'My Reports',
            onPress: () => router.push('/support/my-tickets' as any)
          })}
          <View style={styles.separator} />
          {renderSettingItem({
            icon: 'help-circle',
            label: 'Help Center',
            onPress: () => router.push('/settings/helpCenter')
          })}
          <View style={styles.separator} />
          {renderSettingItem({
            icon: 'shield',
            label: 'Privacy & Security',
            onPress: () => router.push('/settings/security')
          })}
          <View style={styles.separator} />
          {renderSettingItem({
            icon: 'info',
            label: 'About App',
            onPress: () => { }
          })}
        </View>
        {/* Logout */}
        <View style={styles.logoutContainer}>
          <TouchableOpacity accessibilityLabel="Log out" accessibilityRole="button" style={styles.logoutButton} onPress={handleLogout}>
            <Feather name="log-out" size={20} color="#EF4444" />
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
          <Text style={styles.versionText}>Version 1.1.0</Text>
        </View>
        {/* Bottom Padding */}
        <View style={{ height: 40 }} />
      </ScrollView>
      <SpotlightTour 
        visible={isTourActive && activeScreen === 'settings'} 
        steps={onboardingSteps}
        onComplete={handleOnboardingComplete}
      />
      <Modal
        visible={logoutModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLogoutModalVisible(false)}
      >
        <View style={styles.logoutModalOverlay}>
          <Pressable accessibilityLabel="Close logout dialog" accessibilityRole="button" style={StyleSheet.absoluteFill} onPress={() => setLogoutModalVisible(false)} />
          <View style={styles.logoutModalCard}>
            <View style={styles.logoutModalIcon}>
              <Feather name="log-out" size={22} color="#EF4444" />
            </View>
            <Text style={styles.logoutModalTitle}>Log Out?</Text>
            <Text style={styles.logoutModalBody}>
              You will need to sign in again to access your account.
            </Text>
            <View style={styles.logoutModalActions}>
              <TouchableOpacity
                accessibilityLabel="Cancel logout"
                accessibilityRole="button"
                style={styles.logoutCancelBtn}
                onPress={() => setLogoutModalVisible(false)}
                disabled={logoutLoading}
              >
                <Text style={styles.logoutCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityLabel="Confirm logout"
                accessibilityRole="button"
                style={styles.logoutConfirmBtn}
                onPress={confirmLogout}
                disabled={logoutLoading}
              >
                {logoutLoading ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.logoutConfirmText}>Log Out</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  // Header
  headerContainer: {
    paddingBottom: 28,
    overflow: 'hidden',
    position: 'relative',
  },
  hdrArc: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 26,
    backgroundColor: '#fff', borderTopLeftRadius: 26, borderTopRightRadius: 26,
  },
  hdrGlow1: {
    position: 'absolute', top: -30, right: -30,
    width: 150, height: 150, borderRadius: 75,
    backgroundColor: 'rgba(132,204,22,0.12)',
  },
  hdrGlow2: {
    position: 'absolute', bottom: -20, left: -10,
    width: 80, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(30,58,138,0.5)',
  },
  headerWatermark: {
    position: 'absolute',
    right: -30,
    top: -20,
    width: 200,
    height: 200,
    opacity: 0.03,
    resizeMode: 'contain',
    transform: [{ rotate: '-15deg' }],
  },
  headerContent: {
    paddingHorizontal: 24,
    paddingTop: 10,
  },
  screenTitle: {
    fontSize: 28,
    fontFamily: 'Montserrat-Bold',
    color: '#FFF',
    marginBottom: 20,
  },
  // Profile Card
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    marginBottom: 20,
  },
  avatarContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#84cc16', // Lime Green
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: '#FFF',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  avatarText: {
    fontSize: 28,
    fontFamily: 'Montserrat-Bold',
    color: '#0C1559',
  },
  
  // Skeleton Styles
  avatarSkeleton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  nameSkeleton: {
    width: 120,
    height: 18,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 8,
    marginBottom: 8,
  },
  emailSkeleton: {
    width: 160,
    height: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 6,
  },
  profileInfo: {
    flex: 1,
    marginLeft: 16,
  },
  profileName: {
    fontSize: 20,
    fontFamily: 'Montserrat-Bold',
    color: '#FFF',
  },
  profileEmail: {
    fontSize: 13,
    fontFamily: 'Montserrat-Medium',
    color: '#CBD5E1',
    marginTop: 3,
  },
  profileAction: {
    marginLeft: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  // Content
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 75,
  },
  sectionHeader: {
    fontSize: 12,
    fontFamily: 'Montserrat-Bold',
    color: '#94A3B8',
    marginBottom: 6,
    marginTop: 24,
    paddingHorizontal: 20,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionCard: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 24,
    overflow: 'hidden',
  },
  separator: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginLeft: 60,
  },
  // Setting Item
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  settingLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Montserrat-SemiBold',
    color: '#0F172A',
  },
  destructiveLabel: {
    color: '#EF4444',
  },
  // Logout
  logoutContainer: {
    alignItems: 'center',
    marginTop: 10,
    paddingHorizontal: 16,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EF4444',
    gap: 8,
    width: '100%',
    marginBottom: 16,
  },
  logoutText: {
    fontSize: 16,
    fontFamily: 'Montserrat-Bold',
    color: '#EF4444',
  },
  logoutModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.45)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logoutModalCard: {
    backgroundColor: '#FFF',
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 22,
  },
  logoutModalIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 10,
  },
  logoutModalTitle: {
    fontSize: 20,
    color: '#0F172A',
    fontFamily: 'Montserrat-Bold',
    textAlign: 'center',
    marginBottom: 6,
  },
  logoutModalBody: {
    fontSize: 14,
    lineHeight: 20,
    color: '#64748B',
    fontFamily: 'Montserrat-Medium',
    textAlign: 'center',
    marginBottom: 18,
  },
  logoutModalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  logoutCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutCancelText: {
    color: '#334155',
    fontSize: 14,
    fontFamily: 'Montserrat-SemiBold',
  },
  logoutConfirmBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutConfirmText: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
  },
  versionText: {
    fontSize: 12,
    fontFamily: 'Montserrat-Medium',
    color: '#94A3B8',
  },
});
