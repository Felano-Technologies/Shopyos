import { router } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform, Pressable, Keyboard } from 'react-native';
import AppImage from '@/components/AppImage';
import { Ionicons } from '@expo/vector-icons';
import { CustomInAppToast } from "@/components/InAppToastHost";
import { StatusBar } from 'expo-status-bar';
import { loginUser } from '@/services/api';
import { useGoogleAuth, signInWithGoogle } from '@/services/auth';
import * as Location from 'expo-location';
import { useOnboarding } from '@/context/OnboardingContext';

async function getDeviceLocation(): Promise<{ latitude: number; longitude: number }> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      const locationPromise = Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 3000));
      const location: any = await Promise.race([locationPromise, timeoutPromise]);
      if (location?.coords) {
        return { latitude: location.coords.latitude, longitude: location.coords.longitude };
      }
    }
  } catch {
    console.log('Location access denied or unavailable');
  }
  return { latitude: 0, longitude: 0 };
}

function navigateByRole(role: string | undefined) {
  const userRole = role?.toLowerCase();
  if (userRole === 'customer' || userRole === 'buyer') {
    router.push('/home');
  } else if (userRole === 'seller') {
    router.push('/business/dashboard');
  } else if (userRole === 'driver') {
    router.push('/driver');
  } else if (userRole === 'parcel_partner') {
    router.push('/parcel-partner/dashboard');
  } else if (userRole === 'admin') {
    router.replace('/admin/dashboard');
  }
}

const DEV_ACCOUNTS = [
  { label: 'Admin',   email: 'shoyosecommercehub@gmail.com', password: 'Shopyos@2026' },
  { label: 'Buyer',   email: 'kwame@test.com',               password: 'Password123!' },
  { label: 'Seller',  email: 'kofi.sells@test.com',          password: 'Password123!' },
  { label: 'Driver',  email: 'driver@test.com',              password: 'Password123!' },
  { label: 'Hub',     email: 'hub@test.com',                 password: 'Password123!' },
];

const LoginScreen = () => {
  const { refresh } = useOnboarding();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [request, response, promptAsync] = useGoogleAuth();

  useEffect(() => {
    if (response?.type === 'success') {
      const idToken = response.params?.id_token;
      if (!idToken) {
        CustomInAppToast.show({ type: 'error', title: 'Google Sign-In Failed', message: 'No token received.' });
        return;
      }
      setLoading(true);
      signInWithGoogle(idToken)
        .then(async (data) => {
          await refresh();
          CustomInAppToast.show({ type: 'success', title: 'Welcome!', message: 'Signed in with Google.' });
          if (data.needsRole) {
            router.push('/role');
          } else {
            navigateByRole(data.role);
          }
        })
        .catch((err) => {
          CustomInAppToast.show({ type: 'error', title: 'Google Sign-In Failed', message: err.message });
        })
        .finally(() => setLoading(false));
    }
  }, [response]);
  const handleLogin = async () => {
    try {
      setLoading(true);
      const { latitude, longitude } = await getDeviceLocation();
      const response = await loginUser(email, password, latitude, longitude);
      if (response.message === 'Login successful') {
        CustomInAppToast.show({ type: 'success', title: 'Login Successful', message: 'Welcome back!' });
        await refresh();
        if (response.passwordResetRequired) {
          router.push({ pathname: '/force-reset-password', params: { role: response.role || 'buyer', needsRole: response.needsRole ? '1' : '0' } });
        } else if (response.needsRole) {
          router.push('/role');
        } else {
          navigateByRole(response.role);
        }
      } else {
        CustomInAppToast.show({ type: 'error', title: 'Login Failed', message: response.message || 'Please try again.' });
      }
    } catch (error: unknown) {
      CustomInAppToast.show({ type: 'error', title: 'Sign In Failed', message: error instanceof Error ? error.message : 'Something went wrong.' });
    } finally {
      setLoading(false);
    }
  };
  const handleQuickLogin = async (quickEmail: string, quickPassword: string) => {
    try {
      setLoading(true);
      const { latitude, longitude } = await getDeviceLocation();
      const response = await loginUser(quickEmail, quickPassword, latitude, longitude);
      if (response.message === 'Login successful') {
        CustomInAppToast.show({ type: 'success', title: 'Login Successful', message: 'Welcome back!' });
        await refresh();
        if (response.passwordResetRequired) {
          router.push({ pathname: '/force-reset-password', params: { role: response.role || 'buyer', needsRole: response.needsRole ? '1' : '0' } });
        } else if (response.needsRole) {
          router.push('/role');
        } else {
          navigateByRole(response.role);
        }
      } else {
        CustomInAppToast.show({ type: 'error', title: 'Login Failed', message: response.message || 'Please try again.' });
      }
    } catch (error: unknown) {
      CustomInAppToast.show({ type: 'error', title: 'Sign In Failed', message: error instanceof Error ? error.message : 'Something went wrong.' });
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
                accessibilityLabel="Email address"
                accessibilityRole="none"
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
                accessibilityLabel="Password"
                accessibilityRole="none"
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#888"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                accessibilityRole="button"
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
            <TouchableOpacity accessibilityLabel="Reset forgotten password" accessibilityRole="link" onPress={() => router.push('/forgotPassword')}>
              <Text style={styles.forgotPassword}>Forgot password?</Text>
            </TouchableOpacity>
            {/* Sign in (solid pill) */}
            <TouchableOpacity
              accessibilityLabel="Sign in to account"
              accessibilityRole="button"
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
            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>
            {/* Continue with Google */}
            <TouchableOpacity
              accessibilityLabel="Continue with Google"
              accessibilityRole="button"
              style={styles.googleButton}
              onPress={() => promptAsync()}
              disabled={!request || loading}
            >
              <Ionicons name="logo-google" size={18} color="#444" style={{ marginRight: 8 }} />
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </TouchableOpacity>
            {/* Register (outlined pill) */}
            <TouchableOpacity
              accessibilityLabel="Create a new account"
              accessibilityRole="button"
              style={styles.registerButton}
              onPress={() => router.push('/register')}
            >
              <Text style={styles.registerText}>
                Not registered? <Text style={styles.registerBold}>Sign up now!</Text>
              </Text>
            </TouchableOpacity>
            {/* DEV QUICK LOGIN */}
            {__DEV__ && (
              <View style={styles.devPanel}>
                <Text style={styles.devLabel}>Dev</Text>
                <View style={styles.devButtonRow}>
                  {DEV_ACCOUNTS.map((account) => (
                    <TouchableOpacity
                      accessibilityLabel={`Quick login as ${account.label}`}
                      accessibilityRole="button"
                      key={account.label}
                      style={styles.devButton}
                      onPress={() => handleQuickLogin(account.email, account.password)}
                      disabled={loading}
                    >
                      <Text style={styles.devButtonText}>{account.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
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
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  dividerText: {
    marginHorizontal: 10,
    color: '#9ca3af',
    fontSize: 13,
  },
  googleButton: {
    width: '100%',
    height: 50,
    backgroundColor: '#f3f4f6',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d1d5db',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  googleButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
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
    marginLeft: -60,
    marginBottom: -210,
  },
  brandLogo: {
    width: 90,
    height: 30,
    resizeMode: 'contain',
    marginLeft: -50,
    marginBottom: -200,
  },
  devPanel: {
    width: '100%',
    marginTop: 14,
    alignItems: 'center',
  },
  devLabel: {
    fontSize: 10,
    color: '#9ca3af',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  devButtonRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  devButton: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  devButtonText: {
    fontSize: 11,
    color: '#374151',
    fontWeight: '600',
  },
});
export default LoginScreen;