import React, { useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, Ionicons } from '@expo/vector-icons';
import AppImage from '@/components/AppImage';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { loginUser } from '@/services/api';
import { useOnboarding } from '@/context/OnboardingContext';
import * as Location from 'expo-location';

const DEV_ACCOUNTS = [
  { label: 'Admin', email: 'shoyosecommercehub@gmail.com', password: 'Shopyos@2026' },
];

const FEATURES = [
  { icon: 'bar-chart-2', text: 'Real-time platform analytics' },
  { icon: 'users',       text: 'Full user & seller management' },
  { icon: 'shield',      text: 'Audit logs & security controls' },
  { icon: 'truck',       text: 'Driver & delivery oversight' },
];

async function getLocation() {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      const loc: any = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise(r => setTimeout(() => r(null), 3000)),
      ]);
      if (loc?.coords) return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
    }
  } catch (e) {
    console.warn('Failed to get geolocation:', e);
  }
  return { latitude: 0, longitude: 0 };
}

export default function AdminLoginScreen() {
  const { refresh } = useOnboarding();
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [showPw, setShowPw]       = useState(false);
  const [loading, setLoading]     = useState(false);

  const { width } = Dimensions.get('window');
  const isTwoPanel = width >= 900;

  const doLogin = async (loginEmail: string, loginPassword: string) => {
    try {
      setLoading(true);
      const { latitude, longitude } = await getLocation();
      const response = await loginUser(loginEmail, loginPassword, latitude, longitude);

      if (response.message !== 'Login successful') {
        CustomInAppToast.show({
          type: 'error',
          title: 'Login Failed',
          message: response.message || 'Please try again.',
        });
        return;
      }

      const role = response.role?.toLowerCase();
      if (role !== 'admin') {
        CustomInAppToast.show({
          type: 'error',
          title: 'Access Denied',
          message: 'This portal is restricted to admin accounts.',
        });
        return;
      }

      CustomInAppToast.show({ type: 'success', title: 'Welcome back', message: 'Signing you into the admin portal…' });
      await refresh();
      router.replace('/admin/dashboard');
    } catch (err: unknown) {
      CustomInAppToast.show({
        type: 'error',
        title: 'Sign In Failed',
        message: err instanceof Error ? err.message : 'Something went wrong.',
      });
    } finally {
      setLoading(false);
    }
  };

  // ── Left branding panel ────────────────────────────────────────────────────
  const BrandPanel = () => (
    <LinearGradient
      colors={['#01217B', '#0C3494', '#0A5CA8']}
      style={[styles.brandPanel, !isTwoPanel && styles.brandPanelMobile]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.6, y: 1 }}
    >
      {/* Decorative circles */}
      <View style={[styles.circle, { width: 340, height: 340, top: -120, right: -80, opacity: 0.06 }]} />
      <View style={[styles.circle, { width: 220, height: 220, bottom: 60, left: -60, opacity: 0.08 }]} />

      <View style={styles.brandContent}>
        <AppImage
          source={require('../assets/images/iconwhite.png')}
          style={styles.brandLogo}
        />

        <Text style={styles.brandHeadline}>Shopyos{'\n'}Admin Portal</Text>
        <Text style={styles.brandSubtitle}>
          Manage your platform, people, and operations from one powerful hub.
        </Text>

        {isTwoPanel && (
          <View style={styles.featureList}>
            {FEATURES.map(f => (
              <View key={f.icon} style={styles.featureRow}>
                <View style={styles.featureIconWrap}>
                  <Feather name={f.icon as any} size={16} color="#85CC16" />
                </View>
                <Text style={styles.featureText}>{f.text}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {isTwoPanel && (
        <View style={styles.brandFooter}>
          <View style={styles.limeDot} />
          <Text style={styles.brandFooterText}>Shopyos © 2026</Text>
        </View>
      )}
    </LinearGradient>
  );

  // ── Right form panel ───────────────────────────────────────────────────────
  const FormPanel = () => (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.formPanel, !isTwoPanel && styles.formPanelMobile]}
    >
      <Pressable style={styles.formInner}>
        <Text style={styles.formTitle}>Sign in</Text>
        <Text style={styles.formSubtitle}>Admin access only</Text>

        {/* Email */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Email address</Text>
          <View style={styles.inputRow}>
            <Ionicons name="mail-outline" size={18} color="#64748B" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="admin@shopyos.com"
              placeholderTextColor="#94A3B8"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              returnKeyType="next"
            />
          </View>
        </View>

        {/* Password */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Password</Text>
          <View style={styles.inputRow}>
            <Ionicons name="lock-closed-outline" size={18} color="#64748B" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#94A3B8"
              secureTextEntry={!showPw}
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={() => doLogin(email, password)}
            />
            <TouchableOpacity onPress={() => setShowPw(p => !p)} style={styles.eyeBtn}>
              <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={18} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={styles.forgotLink}
          onPress={() => router.push('/forgotPassword')}
        >
          <Text style={styles.forgotText}>Forgot password?</Text>
        </TouchableOpacity>

        {/* Sign in button */}
        <TouchableOpacity
          style={[styles.signInBtn, loading && { opacity: 0.7 }]}
          onPress={() => doLogin(email, password)}
          disabled={loading}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={['#01217B', '#1e3a8a']}
            style={styles.signInGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            {loading
              ? <ActivityIndicator color="#FFF" />
              : <>
                  <Text style={styles.signInText}>Sign in to Admin Portal</Text>
                  <Feather name="arrow-right" size={18} color="#85CC16" />
                </>}
          </LinearGradient>
        </TouchableOpacity>

        {/* Dev quick-login */}
        {__DEV__ && (
          <View style={styles.devPanel}>
            <View style={styles.devDivider}>
              <View style={styles.devLine} />
              <Text style={styles.devLabel}>Dev quick-login</Text>
              <View style={styles.devLine} />
            </View>
            <View style={styles.devBtnRow}>
              {DEV_ACCOUNTS.map(acc => (
                <TouchableOpacity
                  key={acc.label}
                  style={styles.devBtn}
                  onPress={() => doLogin(acc.email, acc.password)}
                  disabled={loading}
                >
                  <Text style={styles.devBtnText}>{acc.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={styles.accessNote}>
          <Ionicons name="shield-checkmark-outline" size={14} color="#94A3B8" />
          <Text style={styles.accessNoteText}>
            Restricted to authorised Shopyos administrators
          </Text>
        </View>
      </Pressable>
    </KeyboardAvoidingView>
  );

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      {isTwoPanel ? (
        <View style={styles.twoPanel}>
          <BrandPanel />
          <FormPanel />
        </View>
      ) : (
        <View style={styles.singlePanel}>
          <BrandPanel />
          <FormPanel />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F0F4FF',
  },

  // ── Two-panel (desktop/tablet) ─────────────────────────────────────────────
  twoPanel: {
    flex: 1,
    flexDirection: 'row',
  },
  brandPanel: {
    width: '42%',
    minWidth: 340,
    justifyContent: 'space-between',
    padding: 48,
    overflow: 'hidden',
  },
  brandContent: {
    flex: 1,
    justifyContent: 'center',
  },
  brandLogo: {
    width: 160,
    height: 44,
    resizeMode: 'contain',
    marginBottom: 32,
  },
  brandHeadline: {
    color: '#FFFFFF',
    fontSize: 38,
    fontFamily: 'Montserrat-Bold',
    lineHeight: 46,
    marginBottom: 16,
  },
  brandSubtitle: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 15,
    fontFamily: 'Montserrat-Regular',
    lineHeight: 22,
    marginBottom: 40,
    maxWidth: 320,
  },
  featureList: {
    gap: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  featureIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(133,204,22,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontFamily: 'Montserrat-SemiBold',
  },
  brandFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  limeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#85CC16',
  },
  brandFooterText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontFamily: 'Montserrat-Regular',
  },
  circle: {
    position: 'absolute',
    borderRadius: 9999,
    backgroundColor: '#FFFFFF',
  },

  // ── Form panel ─────────────────────────────────────────────────────────────
  formPanel: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 48,
  },
  formInner: {
    width: '100%',
    maxWidth: 420,
  },
  formTitle: {
    color: '#0F172A',
    fontSize: 30,
    fontFamily: 'Montserrat-Bold',
    marginBottom: 6,
  },
  formSubtitle: {
    color: '#64748B',
    fontSize: 14,
    fontFamily: 'Montserrat-Regular',
    marginBottom: 32,
  },

  fieldGroup: {
    marginBottom: 20,
  },
  fieldLabel: {
    color: '#374151',
    fontSize: 13,
    fontFamily: 'Montserrat-SemiBold',
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Montserrat-Regular',
    color: '#0F172A',
  },
  eyeBtn: {
    padding: 4,
  },
  forgotLink: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotText: {
    color: '#1e3a8a',
    fontSize: 13,
    fontFamily: 'Montserrat-SemiBold',
  },

  signInBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 24,
  },
  signInGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  signInText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'Montserrat-Bold',
  },

  // Dev panel
  devPanel: {
    marginBottom: 24,
  },
  devDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  devLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  devLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontFamily: 'Montserrat-SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  devBtnRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  devBtn: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  devBtnText: {
    color: '#374151',
    fontSize: 12,
    fontFamily: 'Montserrat-SemiBold',
  },

  accessNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
  },
  accessNoteText: {
    color: '#94A3B8',
    fontSize: 12,
    fontFamily: 'Montserrat-Regular',
  },

  // ── Single-panel (mobile) ──────────────────────────────────────────────────
  singlePanel: {
    flex: 1,
  },
  brandPanelMobile: {
    width: '100%',
    paddingVertical: 40,
    paddingHorizontal: 24,
    minHeight: undefined,
    justifyContent: 'center',
  },
  formPanelMobile: {
    flex: 1,
    padding: 24,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -20,
  },
});
