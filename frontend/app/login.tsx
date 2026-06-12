import { router } from 'expo-router';
import React, {  useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform, Pressable, Keyboard, Dimensions , Appearance } from 'react-native';
import AppImage from '@/components/AppImage';
import { Ionicons } from '@expo/vector-icons';
import { CustomInAppToast } from "@/components/InAppToastHost";
import { StatusBar } from 'expo-status-bar';
import { loginUser } from '@/services/api';
import * as Location from 'expo-location';
import { useOnboarding } from '@/context/OnboardingContext';

const LoginScreen = () => {
  const { refresh } = useOnboarding();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  // Handle Sign In
  const handleLogin = async () => {
    try {
      setLoading(true);
      // Get device location
      let latitude = 0;
      let longitude = 0;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          // Add a 3-second timeout to prevent the app from hanging forever if GPS is slow
          const locationPromise = Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 3000));
          
          const location: any = await Promise.race([locationPromise, timeoutPromise]);
          if (location && location.coords) {
            latitude = location.coords.latitude;
            longitude = location.coords.longitude;
          }
        }
      } catch {
        console.log('Location access denied or unavailable');
      }
      const response = await loginUser(email, password, latitude, longitude);
      if (response.message === "Login successful") {
        CustomInAppToast.show({
          type: 'success',
          title: 'Login Successful 😊',
          message: 'Welcome back! 🎉',
        });
        
        // Refresh onboarding state for the newly logged-in user
        await refresh();
        
        // Check if user needs to select a role (using the needsRole flag from API)
        if (response.needsRole) {
          // User has no role assigned, redirect to role selection
          router.push('/role');
        } else {
          // User has a role, proceed with normal navigation
          const userRole = response.role?.toLowerCase();
          if (userRole === 'customer' || userRole === 'buyer') {
            router.push("/home");
          } else if (userRole === 'seller') {
            router.push("/business/dashboard");
          } else if (userRole === 'driver') {
            router.push("/driver");
          } else if (userRole === 'admin') {
            router.push("/admin/dashboard");
          }
        }
      } else {
        CustomInAppToast.show({
          type: 'error',
          title: 'Login Failed ❌',
          message: response.message || 'Please try again.',
        });
      }
    } catch (error: any) {
      CustomInAppToast.show({
        type: 'error',
        title: 'Sign In Failed ⚠️',
        message: error.message || 'Something went wrong.',
      });
    } finally {
      setLoading(false);
    }
  };
  return (
    <View style={styles.container}>
      <StatusBar style="dark" translucent backgroundColor="transparent" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <Pressable onPress={Keyboard.dismiss} style={{ flex: 1 }}>
          <View style={styles.innerContainer}>
            {/* Logo */}
            <AppImage
              source={require('../assets/images/icondark.png')}
              style={styles.logo}
              contentFit="contain"
            />
            {/* Title */}
            <Text style={styles.title}>Sign into your account</Text>
            <Text style={styles.subtitle}>
              Welcome back, you’ve been missed!
            </Text>
            {/* Email Input */}
            <View style={styles.inputContainer}>
              <Ionicons name="mail" size={20} color="#333" />
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                placeholderTextColor="#888"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>
            {/* Password Input */}
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed" size={20} color="#333" />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#888"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
              >
                <Ionicons
                  name={showPassword ? 'eye' : 'eye-off'}
                  size={20}
                  color="#111827"
                />
              </TouchableOpacity>
            </View>
            {/* Forgot Password */}
            <TouchableOpacity onPress={() => router.push('/forgotPassword')}>
              <Text style={styles.forgotPassword}>Forgot password?</Text>
            </TouchableOpacity>
            {/* Sign in (solid pill) */}
            <TouchableOpacity
              style={[styles.signInButton, loading && styles.disabledButton]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.signInText}>Sign in</Text>
              )}
            </TouchableOpacity>
            {/* Register (outlined pill) */}
            <TouchableOpacity
              style={styles.registerButton}
              onPress={() => router.push('/register')}
            >
              <Text style={styles.registerText}>
                Not registered? <Text style={styles.registerBold}>Sign up now!</Text>
              </Text>
            </TouchableOpacity>
            {/* Bottom Logos */}
            <View style={styles.bottomLogos}>
              <AppImage source={require('../assets/images/adaptive-icon.png')} style={styles.circleLogo} contentFit="contain" />
              <AppImage source={require('../assets/images/icondark.png')} style={styles.brandLogo} contentFit="contain" />
            </View>
          </View>
        </Pressable>
      </KeyboardAvoidingView>
    </View>
  );
};
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyboardView: {
    flex: 1,
  },
  pressableContainer: {
    flex: 1,
    justifyContent: 'center', // Fix vertical alignment
    alignItems: 'center',     // Fix horizontal alignment (prevents shift to left)
    width: '100%',
  },
  innerContainer: {
    width: '100%',
    paddingHorizontal: 24, // Use padding instead of percentage width
    alignItems: 'center', // Centers contents horizontally
    justifyContent: 'center',
    flex: 1,
  },
  logo: {
    width: 200,
    height: 60,
    resizeMode: 'contain',
    marginBottom: 10,
    marginTop: 20,
  },
  title: {
    fontSize: 22,
    color: '#1e3a8a', // deep blue heading
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#444',
    textAlign: 'center',
    marginBottom: 28,
    opacity: 0.9,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: '#EEF2FF',
    borderRadius: 14,
    borderWidth: 0,
    paddingHorizontal: 16,
    height: 54,
    marginVertical: 7,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    marginLeft: 8,
  },
  eyeIcon: {
    padding: 4,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    color: '#1e3a8a',
    fontSize: 14,
    marginTop: 6,
    marginBottom: 12,
  },
  signInButton: {
    width: '100%',
    height: 50,
    backgroundColor: '#1e3a8a',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  disabledButton: {
    opacity: 0.85,
  },
  signInText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textTransform: 'none',
  },
  registerButton: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#1e3a8a',
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  registerText: {
    color: '#1e3a8a',
    fontSize: 15,
  },
  registerBold: {
    color: '#1e3a8a',
    fontWeight: '700',
  },
  bottomLogos: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginTop: 26,
    paddingHorizontal: 6,
    marginBottom: -20,
  },
  circleLogo: {
    width: 150,
    height: 150,
    resizeMode: 'contain',
    marginLeft: -50,
    marginBottom: -200,
  },
  brandLogo: {
    width: 90,
    height: 30,
    resizeMode: 'contain',
    marginLeft: -50,
    marginBottom: -200,
  },
});
export default LoginScreen;