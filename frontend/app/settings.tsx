import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Switch,
  ScrollView,
  Alert,
  StatusBar,
  Animated,
} from 'react-native';
import { useOnboarding } from './context/OnboardingContext';
import { SpotlightTour } from '@/components/ui/SpotlightTour';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { LinearGradient } from 'expo-linear-gradient';
import { getUserData, getNotificationPreferences, updateNotificationPreferences, logoutUser } from '@/services/api';

export default function SettingsScreen() {
  const router = useRouter();
  const [username, setUsername] = useState('User');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Toggles State
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

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
  }, []);

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
  }, []);

  useFocusEffect(
    useCallback(() => {
      const fetchUserData = async () => {
        setIsLoading(true);
        try {
          const userData = await getUserData();
          if (userData) {
            setUsername(userData.name || 'User');
            setEmail(userData.email || '');
            setAvatarUrl(userData.avatar_url || null);
          }

          const prefs = await getNotificationPreferences();
          if (prefs && prefs.success) {
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
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await logoutUser();
            router.replace('/login');
          } catch (error) {
            console.error('Logout error:', error);
            // Even if API fails, we should clear local and redirect
            router.replace('/login');
          }
        }
      },
    ]);
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
      {rightElement ? (
        rightElement
      ) : (
        <Feather name="chevron-right" size={20} color="#CBD5E1" />
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C1559" />

      {/* --- HEADER --- */}
      <View style={styles.headerContainer}>
        <Image
          source={require('../assets/images/splash-icon.png')}
          style={styles.headerWatermark}
        />
        <SafeAreaView edges={['top', 'left', 'right']}>
          <View style={styles.headerContent}>
            <Text style={styles.screenTitle}>Settings</Text>

            {/* Profile Card */}
            {isLoading ? (
              <View style={styles.profileCard}>
                <Animated.View style={[styles.avatarSkeleton, { opacity: skeletonAnim }]} />
                <View style={styles.profileInfo}>
                  <Animated.View style={[styles.nameSkeleton, { opacity: skeletonAnim }]} />
                  <Animated.View style={[styles.emailSkeleton, { opacity: skeletonAnim }]} />
                </View>
              </View>
            ) : (
              <View style={styles.profileCard} ref={refProfile} onLayout={() => measureElement(refProfile, 'profile')}>
                <View style={styles.avatarContainer}>
                  {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
                  ) : (
                    <Text style={styles.avatarText}>{username.charAt(0)}</Text>
                  )}
                </View>
                <View style={styles.profileInfo}>
                  <Text style={styles.profileName}>{username}</Text>
                  <Text style={styles.profileEmail}>{email}</Text>
                </View>
                <TouchableOpacity style={styles.editBtn} onPress={() => router.push('/settings/Account')} ref={refEdit} onLayout={() => measureElement(refEdit, 'edit')}>
                  <Feather name="edit-2" size={16} color="#FFF" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </SafeAreaView>
      </View>

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
            icon: 'help-circle',
            label: 'Help Center',
            onPress: () => { }
          })}
          <View style={styles.separator} />
          {renderSettingItem({
            icon: 'shield',
            label: 'Privacy & Security',
            onPress: () => router.push('/security')
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
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Feather name="log-out" size={20} color="#EF4444" />
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
          <Text style={styles.versionText}>Version 1.0.0</Text>
        </View>

        {/* Bottom Padding */}
        <View style={{ height: 40 }} />

      </ScrollView>

      <SpotlightTour 
        visible={isTourActive && activeScreen === 'settings'} 
        steps={onboardingSteps}
        onComplete={handleOnboardingComplete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  // Header
  headerContainer: {
    backgroundColor: '#0C1559',
    paddingBottom: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
    position: 'relative',
  },
  headerWatermark: {
    position: 'absolute',
    right: -30,
    top: -20,
    width: 200,
    height: 200,
    opacity: 0.1,
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
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  avatarContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#84cc16', // Lime Green
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  avatarText: {
    fontSize: 24,
    fontFamily: 'Montserrat-Bold',
    color: '#0C1559',
  },
  
  // Skeleton Styles
  avatarSkeleton: {
    width: 56,
    height: 56,
    borderRadius: 28,
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
    fontSize: 18,
    fontFamily: 'Montserrat-Bold',
    color: '#FFF',
  },
  profileEmail: {
    fontSize: 12,
    fontFamily: 'Montserrat-Medium',
    color: '#CBD5E1',
    marginTop: 2,
  },
  editBtn: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
  },

  // Content
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 75,
  },
  sectionHeader: {
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
    color: '#64748B',
    marginBottom: 12,
    marginTop: 8,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    paddingVertical: 4,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  separator: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginLeft: 60, // Indent separator to align with text
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
  versionText: {
    fontSize: 12,
    fontFamily: 'Montserrat-Medium',
    color: '#94A3B8',
  },
});