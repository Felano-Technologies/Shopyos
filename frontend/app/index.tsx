import Reac, { useEffect, useRef} from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions, ImageBackground, Animated } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Appearance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// import * as SecureStore from 'expo-secure-store'; // ⛔ temporarily disabled

import { storage, getUserData, secureStorage } from '@/services/api';

const { width, height } = Dimensions.get('window');

const IndexScreen = () => {
  const colorScheme = Appearance.getColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const fadeAnim = useRef(new Animated.Value(0)).current; // animation value for logo opacity
  const fadeOutAnim = useRef(new Animated.Value(1)).current; // Screen fade-out overlay
  const bgScale = useRef(new Animated.Value(1)).current; // background zoom
  const bgTranslateY = useRef(new Animated.Value(0)).current; // background drift

  useEffect(() => {
    // Parallel fade + background zoom animations
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

    // Perform auth check concurrently with animation wait
    const authCheckPromise = async () => {
      try {
        const token = await secureStorage.getItem('userToken');
        if (!token) return '/getstarted';

        const user = await getUserData();
        const role = user.role?.toLowerCase();

        if (user.requiresRoleSelection || !role || role === 'none') return '/role';
        if (role === 'customer' || role === 'buyer') return '/home';
        if (role === 'seller') return '/business/dashboard';
        if (role === 'driver') return '/driver';
        if (role === 'admin') return '/admin/dashboard';

        return '/home';
      } catch (error) {
        console.warn('Startup Auth Check Failed:', error);
        return '/getstarted'; // Session invalid or network issue
      }
    };

    const runStartup = async () => {
      const minWaitPromise = new Promise((resolve) => setTimeout(resolve, 2000));
      const [nextRoute] = await Promise.all([authCheckPromise(), minWaitPromise]);

      Animated.timing(fadeOutAnim, {
        toValue: 0,
        duration: 1000, // smooth fade out
        useNativeDriver: true,
      }).start(() => {
        router.replace(nextRoute as any);
      });
    };

    runStartup();
  }, []);

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

          {/* Centered logo (responsive true center) */}
          <View style={styles.logoAbsoluteContainer}>
            <Animated.Image
              source={require('../assets/images/iconwhite.png')}
              style={[styles.logo, { opacity: fadeAnim }]}
              resizeMode="contain"
            />
          </View>

          {/* Hidden buttons (keep functionality for later) */}
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
});

export default IndexScreen;