import { router } from 'expo-router';
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform, Pressable, Keyboard, ScrollView } from 'react-native';
import AppImage from '@/components/AppImage';
import { Ionicons } from '@expo/vector-icons';
import { CustomInAppToast } from "@/components/InAppToastHost";
import { StatusBar } from 'expo-status-bar';
import { loginUser } from '@/services/api';
import { isGoogleAuthConfigured, useGoogleAuth, signInWithGoogle } from '@/services/auth';
import * as Location from 'expo-location';
import { useOnboarding } from '@/context/OnboardingContext';
import { resetToRoute } from '@/utils/navigation';
import { requestForegroundLocationWithDisclosure } from '@/src/utils/location';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useThemeStore } from '@/store/themeStore';
import { ThemeColors } from '@/constants/Colors';

type LegacyPalette = {
  bg: string;
  navyMid: string;
  body: string;
  muted: string;
  subtle: string;
  badgeBg: string;
  border: string;
  borderStrong: string;
  card: string;
  textInverse: string;
};

function buildC(colors: ThemeColors): LegacyPalette {
  return {
    bg: colors.background,
    navyMid: colors.primaryMid,
    body: colors.text,
    muted: colors.textSecondary,
    subtle: colors.textMuted,
    badgeBg: colors.backgroundAlt,
    border: colors.border,
    borderStrong: colors.borderStrong,
    card: colors.surface,
    textInverse: colors.textInverse,
  };
}

async function getDeviceLocation(): Promise<{ latitude: number; longitude: number }> {
  try {
    const { status } = await requestForegroundLocationWithDisclosure();
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

function navigateByRole(role: string | undefined, userObj?: any) {
  const userRole = String(role || userObj?.role || userObj?.account_type || '').toLowerCase();
  const rolesArr = Array.isArray(userObj?.roles) ? userObj.roles : [];

  const hasRole = (target: string) => {
    if (userRole === target) return true;
    return rolesArr.some((item: any) => {
      if (typeof item === 'string') return item.toLowerCase() === target;
      return String(item?.name ?? item?.role ?? '').toLowerCase() === target;
    });
  };

  console.log(`[LoginScreen] navigateByRole received role="${role}" (normalized="${userRole}")`);
  if (hasRole('customer') || hasRole('buyer')) {
    resetToRoute('/home');
  } else if (hasRole('seller')) {
    resetToRoute('/business/dashboard');
  } else if (hasRole('driver')) {
    resetToRoute('/driver');
  } else if (hasRole('parcel_partner')) {
    resetToRoute('/parcel-partner/dashboard');
  } else if (hasRole('admin')) {
    resetToRoute('/admin/dashboard');
  } else {
    console.warn(`[LoginScreen] navigateByRole: unrecognized role "${role}" — no navigation will happen, user stays on login screen`);
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
  const themeColors = useThemeColors();
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);
  const C = useMemo(() => buildC(themeColors), [themeColors]);
  const styles = useMemo(() => getStyles(C), [C]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const googleAuthConfigured = isGoogleAuthConfigured();
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
            resetToRoute('/role');
          } else {
            navigateByRole(data.role, data);
          }
        })
        .catch((err) => {
          CustomInAppToast.show({ type: 'error', title: 'Google Sign-In Failed', message: err.message });
        })
        .finally(() => setLoading(false));
    }
  }, [response]);
  const handleLogin = async () => {
    const t0 = Date.now();
    const log = (msg: string) => console.log(`[LoginScreen] +${Date.now() - t0}ms ${msg}`);
    try {
      log('handleLogin started');
      setLoading(true);
      log('Fetching device location...');
      const { latitude, longitude } = await getDeviceLocation();
      log(`Location resolved: lat=${latitude} lng=${longitude}`);
      const response = await loginUser(email, password, latitude, longitude);
      log(`loginUser() resolved — message=${response.message} role=${response.role} needsRole=${response.needsRole} requiresTwoFactor=${response.requiresTwoFactor}`);
      if (response.requiresTwoFactor) {
        log('Branch: requiresTwoFactor -> navigating to /two-factor');
        router.push({ pathname: '/two-factor' as any, params: { token: response.twoFaToken, target: response.maskedTarget || '' } });
        return;
      }
      if (response.message === 'Login successful') {
        CustomInAppToast.show({ type: 'success', title: 'Login Successful', message: 'Welcome back!' });
        log('Calling onboarding refresh()...');
        await refresh();
        log('onboarding refresh() done');
        if (response.passwordResetRequired) {
          log('Branch: passwordResetRequired -> navigating to /force-reset-password');
          router.push({ pathname: '/force-reset-password', params: { role: response.role || 'buyer', needsRole: response.needsRole ? '1' : '0' } });
        } else if (response.needsRole) {
          log('Branch: needsRole -> navigating to /role');
          resetToRoute('/role');
        } else {
          log(`Branch: navigateByRole(${response.role})`);
          navigateByRole(response.role, response);
          log('navigateByRole() call returned — if no navigation happened, the role string did not match any known case');
        }
      } else {
        log(`Branch: unexpected message "${response.message}" -> showing error toast, no navigation`);
        CustomInAppToast.show({ type: 'error', title: 'Login Failed', message: response.message || 'Please try again.' });
      }
    } catch (error: unknown) {
      log(`handleLogin FAILED: ${error instanceof Error ? error.message : error}`);
      CustomInAppToast.show({ type: 'error', title: 'Sign In Failed', message: error instanceof Error ? error.message : 'Something went wrong.' });
    } finally {
      log('handleLogin finished — clearing loading state');
      setLoading(false);
    }
  };
  const handleQuickLogin = async (quickEmail: string, quickPassword: string) => {
    try {
      setLoading(true);
      const { latitude, longitude } = await getDeviceLocation();
      const response = await loginUser(quickEmail, quickPassword, latitude, longitude);
      if (response.requiresTwoFactor) {
        router.push({ pathname: '/two-factor' as any, params: { token: response.twoFaToken, target: response.maskedTarget || '' } });
        return;
      }
      if (response.message === 'Login successful') {
        CustomInAppToast.show({ type: 'success', title: 'Login Successful', message: 'Welcome back!' });
        await refresh();
        if (response.passwordResetRequired) {
          router.push({ pathname: '/force-reset-password', params: { role: response.role || 'buyer', needsRole: response.needsRole ? '1' : '0' } });
        } else if (response.needsRole) {
          resetToRoute('/role');
        } else {
          navigateByRole(response.role, response);
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
  const handleGoogleSignIn = () => {
    if (!googleAuthConfigured) {
      CustomInAppToast.show({
        type: 'error',
        title: 'Google Sign-In Unavailable',
        message: 'Google OAuth is not configured for this platform.',
      });
      return;
    }
    promptAsync();
  };
  return (
    <View style={styles.container}>
      <StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'} translucent backgroundColor="transparent" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <Pressable onPress={Keyboard.dismiss} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} bounces={false} keyboardShouldPersistTaps="handled">
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
              <Ionicons name="mail" size={20} color={C.body} />
              <TextInput
                accessibilityLabel="Email address"
                accessibilityRole="none"
                style={styles.input}
                placeholder="Enter your email"
                placeholderTextColor={C.subtle}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>
            {/* Password Input */}
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed" size={20} color={C.body} />
              <TextInput
                accessibilityLabel="Password"
                accessibilityRole="none"
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={C.subtle}
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
                  color={C.body}
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
                <ActivityIndicator color={C.textInverse} />
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
              style={[styles.googleButton, (!googleAuthConfigured || loading) && styles.disabledButton]}
              onPress={handleGoogleSignIn}
              disabled={loading || (googleAuthConfigured && !request)}
            >
              <Ionicons name="logo-google" size={18} color={C.muted} style={{ marginRight: 8 }} />
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
          </ScrollView>
        </Pressable>
      </KeyboardAvoidingView>
    </View>
  );
};
const getStyles = (C: LegacyPalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
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
    color: C.navyMid,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 6,
  },
  subtitle: {
    fontSize: 14,
    color: C.muted,
    textAlign: 'center',
    marginBottom: 28,
    opacity: 0.9,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: C.badgeBg,
    borderRadius: 14,
    borderWidth: 0,
    paddingHorizontal: 16,
    height: 54,
    marginVertical: 7,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: C.body,
    marginLeft: 8,
  },
  eyeIcon: {
    padding: 4,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    color: C.navyMid,
    fontSize: 14,
    marginTop: 6,
    marginBottom: 12,
  },
  signInButton: {
    width: '100%',
    height: 50,
    backgroundColor: C.navyMid,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  disabledButton: {
    opacity: 0.85,
  },
  signInText: {
    color: C.textInverse,
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
    backgroundColor: C.border,
  },
  dividerText: {
    marginHorizontal: 10,
    color: C.subtle,
    fontSize: 13,
  },
  googleButton: {
    width: '100%',
    height: 45,
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.borderStrong,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  googleButtonText: {
    color: C.body,
    fontSize: 16,
    fontWeight: '600',
  },
  registerButton: {
    width: '100%',
    minHeight: 45,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.navyMid,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  registerText: {
    color: C.navyMid,
    fontSize: 15,
  },
  registerBold: {
    color: C.navyMid,
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
    width: 120,
    height: 120,
    resizeMode: 'contain',
    marginLeft: -50,
    marginBottom: -120,
  },
  brandLogo: {
    width: 90,
    height: 30,
    resizeMode: 'contain',
    marginLeft: -50,
    marginBottom: -140,
  },
  devPanel: {
    width: '100%',
    marginTop: 14,
    alignItems: 'center',
  },
  devLabel: {
    fontSize: 10,
    color: C.subtle,
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
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.borderStrong,
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  devButtonText: {
    fontSize: 11,
    color: C.body,
    fontWeight: '600',
  },
});
export default LoginScreen;
