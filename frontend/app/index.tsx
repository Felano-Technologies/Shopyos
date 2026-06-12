import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ImageBackground, Animated, Appearance } from 'react-native';
import { router } from 'expo-router';
import * as Updates from 'expo-updates';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getUserData, secureStorage } from '@/services/api';
import { cacheUserProfile, getCachedUserProfile } from '@/services/storage';

const { width, height } = Dimensions.get('window');

// ⚙️ DEV: Force the update overlay visible so you can test its look.
// Set to `false` (or remove) before shipping to production.
const DEV_FORCE_SHOW_UPDATE = false;

const IndexScreen = () => {
  const colorScheme = Appearance.getColorScheme();

  // In production: block until OTA check finishes if this is an embedded launch.
  // In dev: always start as false (we simulate via DEV_FORCE_SHOW_UPDATE).
  const [isUpdating, setIsUpdating] = useState(
    !__DEV__ && Updates.isEmbeddedLaunch
  );
  const [updateStatusText, setUpdateStatusText] = useState('Checking for updates…');

  const dotAnim = useRef(new Animated.Value(0)).current;
  const updateBannerOpacity = useRef(new Animated.Value(DEV_FORCE_SHOW_UPDATE ? 1 : 0)).current;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const fadeOutAnim = useRef(new Animated.Value(1)).current;
  const bgScale = useRef(new Animated.Value(1)).current;
  const bgTranslateY = useRef(new Animated.Value(0)).current;

  // --- OTA Update Check ---
  useEffect(() => {
    const runUpdateCheck = async () => {
      if (__DEV__) {
        // In dev: just show the banner for 2s so it's testable, then proceed.
        setUpdateStatusText('Checking for updates…');
        setTimeout(() => {
          setUpdateStatusText('App is up to date ✓');
          setTimeout(() => {
            Animated.timing(updateBannerOpacity, {
              toValue: 0,
              duration: 500,
              useNativeDriver: true,
            }).start();
          }, 800);
        }, 1800);
        return;
      }
      if (!Updates.isEmbeddedLaunch) return;
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          setUpdateStatusText('Downloading update…');
          await Updates.fetchUpdateAsync();
          setUpdateStatusText('Restarting…');
          await Updates.reloadAsync();
        } else {
          setUpdateStatusText('App is up to date ✓');
          setTimeout(() => {
            Animated.timing(updateBannerOpacity, {
              toValue: 0,
              duration: 500,
              useNativeDriver: true,
            }).start(() => setIsUpdating(false));
          }, 600);
        }
      } catch (error) {
        console.warn('OTA Update Check failed:', error);
        Animated.timing(updateBannerOpacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }).start(() => setIsUpdating(false));
      }
    };
    runUpdateCheck();
  }, []);

  // --- Animated dots for "Checking…" text ---
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(dotAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(dotAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // --- Main index animation (runs once update phase is done) ---
  useEffect(() => {
    if (isUpdating) return;

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 2200,
        useNativeDriver: true,
      }),
      Animated.timing(bgScale, {
        toValue: 1.08,
        duration: 2800,
        useNativeDriver: true,
      }),
      Animated.timing(bgTranslateY, {
        toValue: -12,
        duration: 3000,
        useNativeDriver: true,
      }),
    ]).start();

    const routeForUser = (user: any) => {
      const role = user.role?.toLowerCase();
      if (user.requiresRoleSelection || !role || role === 'none') return '/role';
      if (role === 'customer' || role === 'buyer') return '/home';
      if (role === 'seller') return '/business/dashboard';
      if (role === 'driver') return '/driver';
      if (role === 'admin') return '/admin/dashboard';
      return '/home';
    };

    const authCheckPromise = async () => {
      try {
        const token = await secureStorage.getItem('userToken');
        if (!token) return '/getstarted';
        const cached = await getCachedUserProfile();
        if (cached) {
          getUserData().then(cacheUserProfile).catch(() => {});
          return routeForUser(cached);
        }
        const user = await getUserData();
        await cacheUserProfile(user);
        return routeForUser(user);
      } catch (error) {
        console.warn('Startup Auth Check Failed:', error);
        return '/getstarted';
      }
    };

    const runStartup = async () => {
      const cached = await getCachedUserProfile();
      const minWait = cached ? 800 : 2000;
      const minWaitPromise = new Promise((resolve) => setTimeout(resolve, minWait));
      const [nextRoute] = await Promise.all([authCheckPromise(), minWaitPromise]);
      Animated.timing(fadeOutAnim, {
        toValue: 0,
        duration: 1000,
        useNativeDriver: true,
      }).start(() => {
        router.replace(nextRoute as any);
      });
    };

    runStartup();
  }, [bgScale, bgTranslateY, fadeAnim, fadeOutAnim, isUpdating]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={{
          flex: 1,
          transform: [{ scale: bgScale }, { translateY: bgTranslateY }],
        }}
      >
        <ImageBackground
          source={require('../assets/images/shopbackground.png')}
          style={styles.backgroundImage}
          imageStyle={styles.backgroundImageStyle}
        >
          <View style={styles.overlay} />
          <StatusBar style="light" translucent backgroundColor="transparent" />
          <SafeAreaView style={styles.safeArea} edges={['right', 'bottom', 'left']}>
            {/* Centered logo */}
            <View style={styles.logoAbsoluteContainer}>
              <Animated.Image
                source={require('../assets/images/iconwhite.png')}
                style={[styles.logo, { opacity: isUpdating ? 1 : fadeAnim }]}
                resizeMode="contain"
              />
            </View>
            {/* Hidden buttons */}
            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.createAccountButton, { opacity: 0 }]}
                onPress={() => router.push('/register')}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#1b7c22', '#34a853']}
                  style={styles.gradientButton}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.createAccountText}>Create Account</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.loginButton, { opacity: 0 }]}
                onPress={() => router.push('/login')}
                activeOpacity={0.7}
              >
                <Text style={styles.loginText}>Already have an account? Login</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </ImageBackground>
      </Animated.View>

      {/* Screen fade-out overlay */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: '#061f65',
            opacity: fadeOutAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.9],
            }),
          },
        ]}
      />

      {/* OTA Update status banner — overlaid on the animation, no separate screen */}
      <Animated.View
        style={[styles.updateBanner, { opacity: updateBannerOpacity }]}
        pointerEvents="none"
      >
        <View style={styles.updateBannerInner}>
          <Animated.View
            style={[
              styles.updateDot,
              {
                opacity: dotAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.3, 1],
                }),
              },
            ]}
          />
          <Text style={styles.updateBannerText}>{updateStatusText}</Text>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#061f65ff',
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  backgroundImageStyle: {
    opacity: 0.5,
    transform: [
      { rotate: '-20deg' },
      { translateX: 30 },
      { translateY: 20 },
    ],
    resizeMode: 'contain',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#061f65ff',
    opacity: 0.93,
  },
  safeArea: {
    flex: 1,
  },
  logoAbsoluteContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  logo: {
    width: width * 0.55,
    height: height * 0.12,
  },
  footer: {
    paddingHorizontal: 30,
    paddingBottom: 40,
  },
  createAccountButton: {
    width: '100%',
    borderRadius: 25,
    marginBottom: 16,
  },
  gradientButton: {
    paddingVertical: 16,
    borderRadius: 25,
    alignItems: 'center',
  },
  createAccountText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  loginButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 25,
    alignItems: 'center',
  },
  loginText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  // Update banner styles (replaces the old full-screen updateContainer)
  updateBanner: {
    position: 'absolute',
    bottom: 48,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  updateBannerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 8,
    gap: 8,
  },
  updateDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#4ade80',
  },
  updateBannerText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
});
export default IndexScreen;