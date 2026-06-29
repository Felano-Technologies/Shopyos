import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import AppImage from '@/components/AppImage';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import { requestPasswordResetOTP, verifyPasswordResetOTP } from '@/services/api';

const { width } = Dimensions.get('window');
const RESEND_COOLDOWN = 60;

const ForgotPasswordOTPScreen = () => {
  const { email, method, maskedTarget } = useLocalSearchParams<{
    email: string;
    method: 'email' | 'sms';
    maskedTarget: string;
  }>();

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN);
  const inputs = useRef<TextInput[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCountdown = useCallback(() => {
    setCountdown(RESEND_COOLDOWN);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    startCountdown();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [startCountdown]);

  const handleChange = (text: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);
    if (text && index < 5) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleBackspace = (key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const isOtpComplete = otp.every((d) => d !== '');

  const handleVerify = async () => {
    if (!isOtpComplete || verifying) return;
    try {
      setVerifying(true);
      const result = await verifyPasswordResetOTP(email, otp.join(''));
      router.replace({ pathname: '/resetPassword', params: { resetToken: result.resetToken } });
    } catch (error: unknown) {
      CustomInAppToast.show({ type: 'error', title: 'Invalid Code', message: error instanceof Error ? error.message : 'Please try again.' });
      setOtp(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || resending) return;
    try {
      setResending(true);
      await requestPasswordResetOTP(email, method ?? 'email');
      setOtp(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
      startCountdown();
    } catch (error: unknown) {
      CustomInAppToast.show({ type: 'error', title: 'Resend Failed', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setResending(false);
    }
  };

  const resendLabel = countdown > 0
    ? `Resend in 0:${String(countdown).padStart(2, '0')}`
    : 'Resend code';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" translucent backgroundColor="transparent" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.bannerContainer}>
            <AppImage
              source={require('../assets/images/otp.png')}
              style={styles.banner}
              contentFit="contain"
            />
          </View>

          <Text style={styles.title}>Enter Verification Code</Text>
          <Text style={styles.subtitle}>
            A 6-digit code was sent to{'\n'}
            <Text style={styles.target}>{maskedTarget || '—'}</Text>
          </Text>

          <View style={styles.otpContainer}>
            {otp.map((digit, index) => (
              <TextInput
                key={'otp-' + index}
                ref={(ref) => { inputs.current[index] = ref!; }}
                style={[styles.otpInput, digit ? styles.otpInputFilled : null]}
                keyboardType="numeric"
                maxLength={1}
                value={digit}
                onChangeText={(text) => handleChange(text, index)}
                onKeyPress={({ nativeEvent }) => handleBackspace(nativeEvent.key, index)}
                returnKeyType="next"
              />
            ))}
          </View>

          <TouchableOpacity
            style={[styles.verifyButton, (!isOtpComplete || verifying) && { opacity: 0.5 }]}
            disabled={!isOtpComplete || verifying}
            onPress={handleVerify}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#84cc16', '#84cc16']}
              style={styles.verifyGradient}
            >
              {verifying ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.verifyText}>Verify</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.resendButton, (countdown > 0 || resending) && { opacity: 0.4 }]}
            disabled={countdown > 0 || resending}
            onPress={handleResend}
            activeOpacity={0.7}
          >
            {resending ? (
              <ActivityIndicator size="small" color="#1e3a8a" />
            ) : (
              <Text style={[styles.resendText, countdown === 0 && styles.resendTextActive]}>
                {resendLabel}
              </Text>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <AppImage
              source={require('../assets/images/icon.png')}
              style={styles.footerCircle}
              contentFit="contain"
            />
            <AppImage
              source={require('../assets/images/icondark.png')}
              style={styles.footerLogo}
              contentFit="contain"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default ForgotPasswordOTPScreen;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#E9F0FF',
  },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: 32,
  },
  bannerContainer: {
    marginBottom: 16,
  },
  banner: {
    width: width * 0.85,
    height: 160,
    borderRadius: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    marginTop: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    color: '#475569',
    marginTop: 8,
    lineHeight: 22,
    marginBottom: 28,
  },
  target: {
    fontWeight: '700',
    color: '#1e3a8a',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 32,
  },
  otpInput: {
    width: 45,
    height: 52,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    textAlign: 'center',
    fontSize: 22,
    color: '#0F172A',
    marginHorizontal: 6,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
  },
  otpInputFilled: {
    borderColor: '#1e3a8a',
    backgroundColor: '#EEF2FF',
  },
  verifyButton: {
    width: width * 0.85,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 16,
  },
  verifyGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 14,
  },
  verifyText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  resendButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  resendText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
  },
  resendTextActive: {
    color: '#1e3a8a',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '90%',
    marginTop: 'auto',
    paddingTop: 40,
  },
  footerCircle: {
    width: 130,
    height: 130,
    marginLeft: -40,
    marginBottom: -45,
  },
  footerLogo: {
    width: 100,
    height: 40,
    marginBottom: -45,
  },
});
