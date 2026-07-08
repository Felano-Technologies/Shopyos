import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { verifyTwoFactorLogin } from '@/services/auth';
import { useOnboarding } from '@/context/OnboardingContext';

const CODE_LENGTH = 6;

function navigateByRole(role: string | undefined) {
  const userRole = role?.toLowerCase();
  if (userRole === 'customer' || userRole === 'buyer') router.replace('/home');
  else if (userRole === 'seller') router.replace('/business/dashboard');
  else if (userRole === 'driver') router.replace('/driver');
  else if (userRole === 'parcel_partner') router.replace('/parcel-partner/dashboard');
  else if (userRole === 'admin') router.replace('/admin/dashboard');
  else router.replace('/home');
}

export default function TwoFactorScreen() {
  const { token, target } = useLocalSearchParams<{ token: string; target?: string }>();
  const { refresh } = useOnboarding();
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const handleVerify = async (finalCode?: string) => {
    const codeToVerify = (finalCode ?? code).trim();
    if (codeToVerify.length !== CODE_LENGTH || verifying) return;
    setVerifying(true);
    try {
      const result = await verifyTwoFactorLogin(token as string, codeToVerify);
      await refresh();
      CustomInAppToast.show({ type: 'success', title: 'Verified', message: 'Welcome back!' });
      if (result.passwordResetRequired) {
        router.replace({ pathname: '/force-reset-password', params: { role: result.role || 'buyer', needsRole: result.needsRole ? '1' : '0' } } as any);
      } else if (result.needsRole) {
        router.replace('/role');
      } else {
        navigateByRole(result.role);
      }
    } catch (e: any) {
      setCode('');
      CustomInAppToast.show({ type: 'error', title: 'Verification Failed', message: e.message || 'Invalid code. Please try again.' });
      // Session expiry means the login attempt must restart
      if (/expired/i.test(e.message || '')) router.replace('/login');
    } finally {
      setVerifying(false);
    }
  };

  const onChangeCode = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(digits);
    if (digits.length === CODE_LENGTH) handleVerify(digits);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor="#0C1559" />
      <SafeAreaView edges={['top', 'left', 'right']} style={{ backgroundColor: '#0C1559' }}>
        <LinearGradient colors={['#0C1559', '#1e3a8a']} style={styles.header}>
          <TouchableOpacity onPress={() => router.replace('/login')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Two-Factor Verification</Text>
          <View style={{ width: 36 }} />
        </LinearGradient>
      </SafeAreaView>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.body}>
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name="shield-lock" size={40} color="#0C1559" />
          </View>
          <Text style={styles.title}>Enter your verification code</Text>
          <Text style={styles.sub}>
            We sent a 6-digit code to {target || 'your email'}. It expires in 5 minutes.
          </Text>

          <TouchableOpacity activeOpacity={1} onPress={() => inputRef.current?.focus()} style={styles.codeRow}>
            {Array.from({ length: CODE_LENGTH }).map((_, i) => (
              <View key={`digit-${i}`} style={[styles.codeBox, code.length === i && styles.codeBoxActive]}>
                <Text style={styles.codeDigit}>{code[i] ?? ''}</Text>
              </View>
            ))}
          </TouchableOpacity>
          <TextInput
            ref={inputRef}
            style={styles.hiddenInput}
            value={code}
            onChangeText={onChangeCode}
            keyboardType="number-pad"
            maxLength={CODE_LENGTH}
            autoFocus
            textContentType="oneTimeCode"
          />

          <TouchableOpacity
            style={[styles.verifyBtn, (code.length !== CODE_LENGTH || verifying) && styles.verifyBtnDisabled]}
            onPress={() => handleVerify()}
            disabled={code.length !== CODE_LENGTH || verifying}
          >
            {verifying ? <ActivityIndicator color="#0C1559" /> : <Text style={styles.verifyTxt}>Verify & Sign In</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.replace('/login')} style={{ marginTop: 20 }}>
            <Text style={styles.backToLogin}>Back to login</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16 },
  backBtn: { padding: 6, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10 },
  headerTitle: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#FFF' },
  body: { flex: 1, alignItems: 'center', paddingHorizontal: 28, paddingTop: 48 },
  iconCircle: {
    width: 84, height: 84, borderRadius: 42, backgroundColor: '#EEF2FF',
    alignItems: 'center', justifyContent: 'center', marginBottom: 22,
  },
  title: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginBottom: 8, textAlign: 'center' },
  sub: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: '#64748B', textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  codeRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  codeBox: {
    width: 46, height: 54, borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center',
  },
  codeBoxActive: { borderColor: '#84cc16' },
  codeDigit: { fontSize: 22, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
  hiddenInput: { position: 'absolute', opacity: 0, height: 1, width: 1 },
  verifyBtn: {
    marginTop: 24, width: '100%', height: 52, borderRadius: 14,
    backgroundColor: '#84cc16', alignItems: 'center', justifyContent: 'center',
  },
  verifyBtnDisabled: { backgroundColor: '#E2E8F0' },
  verifyTxt: { fontSize: 15, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
  backToLogin: { fontSize: 13, fontFamily: 'Montserrat-SemiBold', color: '#64748B' },
});
