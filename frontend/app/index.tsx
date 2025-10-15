import Reac, { useEffect, useRef} from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions, ImageBackground, Animated } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Appearance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// import * as SecureStore from 'expo-secure-store'; // ⛔ temporarily disabled


const { width, height } = Dimensions.get('window');

const IndexScreen = () => {
  const colorScheme = Appearance.getColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const fadeAnim = useRef(new Animated.Value(0)).current; // animation value for logo opacity
  const fadeOutAnim = useRef(new Animated.Value(1)).current; // Screen fade-out overlay




  useEffect(() => {
    // Start fade-in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1200, // 1.2 seconds
      useNativeDriver: true,
    }).start();

    // Temporarily simplified navigation (skip login check)
    const timer = setTimeout(() => {
      Animated.timing(fadeOutAnim, {
        toValue: 0,
        duration: 800, // smooth fade out
        useNativeDriver: true,
      }).start(() => {
        // Step 3: Navigate only after fade-out finishes
        router.replace('/getstarted');
      });
    }, 1800); // Start fade-out after 1.8s


    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <ImageBackground
        source={require('../assets/images/shopbackground.png')}
        style={styles.backgroundImage}
        imageStyle={styles.backgroundImageStyle}
      >
        <View style={styles.overlay} />
        <StatusBar style="light" translucent backgroundColor="transparent" />

        <SafeAreaView style={styles.safeArea} edges={['right', 'bottom', 'left']}>
          {/* Centered Logo with Fade-in */}
          <View style={styles.logoContainer}>
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  backgroundImageStyle: {
    opacity: 0.5,
    transform: [
      { rotate: '-20deg' }, // slight left tilt
      { translateX: 30 },  // move right
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
  logoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: width * 0.55,
    height: 120,
  },
  footer: {
    paddingHorizontal: 30,
    paddingBottom: 40,
    paddingTop: 20,
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