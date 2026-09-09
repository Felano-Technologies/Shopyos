import React, { useState, useRef, useMemo } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import AppImage from '@/components/AppImage';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams } from 'expo-router';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';
import { verifySignupOtp, resendSignupOtp } from '@/services/api';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { resetToRoute } from '@/utils/navigation';

const { width } = Dimensions.get('window');

const OtpVerificationScreen = () => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { userId, maskedTarget } = useLocalSearchParams<{ userId: string; maskedTarget?: string }>();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const inputs = useRef<TextInput[]>([]);

  const handleChange = (text: string, index: number) => {
    const digits = text.replace(/\D/g, '');

    // iOS/Android SMS autofill delivers the WHOLE code into whichever box is
    // focused (not one digit per box) — split it across all 6 here instead
    // of just dropping everything but the first character into that one box.
    if (digits.length > 1) {
      const chars = digits.slice(0, 6).split('');
      const newOtp = ['', '', '', '', '', ''];
      chars.forEach((c, i) => { newOtp[i] = c; });
      setOtp(newOtp);
      const nextIndex = Math.min(chars.length, 5);
      inputs.current[nextIndex]?.focus();
      if (chars.length >= 6) inputs.current[5]?.blur();
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = digits;
    setOtp(newOtp);

    if (digits && index < 5) {
      inputs.current[index + 1].focus();
    }
  };

  const isOtpComplete = otp.every((digit) => digit !== '');

  const handleVerify = async () => {
    if (!isOtpComplete || !userId) return;
    setVerifying(true);
    try {
      const data = await verifySignupOtp(userId, otp.join(''));
      CustomInAppToast.show({ type: 'success', title: 'Account verified', message: 'Welcome to Shopyos!' });
      resetToRoute(data.needsRole ? '/role' : '/home');
    } catch (error: any) {
      CustomInAppToast.show({ type: 'error', title: 'Verification failed', message: error.message || 'Please check the code and try again.' });
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!userId || resending) return;
    setResending(true);
    try {
      await resendSignupOtp(userId);
      CustomInAppToast.show({ type: 'success', title: 'Code resent', message: maskedTarget ? `Check ${maskedTarget}` : 'Check your email/phone.' });
    } catch (error: any) {
      CustomInAppToast.show({ type: 'error', title: 'Could not resend code', message: error.message || 'Please try again shortly.' });
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" translucent backgroundColor="transparent" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Banner */}
          <View style={styles.bannerContainer}>
            <AppImage
              source={require('../assets/images/otp.png')}
              style={styles.banner}
              contentFit="contain"
            />
          </View>

          {/* Instruction text */}
          <Text style={styles.instructionText}>
            Please Enter The 6 Digit Code Sent To{'\n'}
            {maskedTarget || 'your email or number'}
          </Text>

          {/* OTP Input Boxes */}
          <View style={styles.otpContainer}>
            {otp.map((digit, index) => (
              <TextInput
                key={'otp-' + index}
                ref={(ref) => { inputs.current[index] = ref!; }}
                style={styles.otpInput}
                keyboardType="numeric"
                // No maxLength — a maxLength={1} here would truncate an
                // autofilled 6-digit code down to 1 char natively before
                // onChangeText ever sees it. handleChange() already handles
                // both a single keystroke and a full autofilled code.
                textContentType="oneTimeCode"
                autoComplete="sms-otp"
                value={digit}
                onChangeText={(text) => handleChange(text, index)}
                returnKeyType="next"
              />
            ))}
          </View>

          {/* Verify Button */}
          <TouchableOpacity
            style={[
              styles.verifyButton,
              { opacity: isOtpComplete && !verifying ? 1 : 0.6 },
            ]}
            disabled={!isOtpComplete || verifying}
            onPress={handleVerify}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[colors.accent, colors.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.verifyGradient}
            >
              {verifying ? <ActivityIndicator color={colors.accentText} /> : <Text style={styles.verifyText}>Verify</Text>}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleResend} disabled={resending} style={styles.resendBtn}>
            <Text style={styles.resendText}>{resending ? 'Resending…' : "Didn't get a code? Resend"}</Text>
          </TouchableOpacity>

          {/* Footer Logo */}
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

const getStyles = (c: ThemeColors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: c.backgroundAlt,
  },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 40,
  },
  bannerContainer: {
    marginTop: 20,
    marginBottom: 20,
  },
  banner: {
    width: width * 0.85,
    height: 160,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 5,
    elevation: 5,
  },
  instructionText: {
    fontSize: 15,
    textAlign: 'center',
    color: c.text,
    marginBottom: 20,
    lineHeight: 22,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 40,
    
  },
  otpInput: {
    width: 45,
    height: 50,
    borderRadius: 8,
    backgroundColor: c.border,
    textAlign: 'center',
    fontSize: 20,
    color: c.text,
    marginHorizontal: 6,
    borderWidth: 1,
    borderColor: c.borderStrong,
  },
  verifyButton: {
    width: width * 0.85,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  resendBtn: {
    marginBottom: 24,
  },
  resendText: {
    color: c.primaryMid,
    fontSize: 14,
    fontWeight: '600',
  },
  verifyGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 12,
  },
  verifyText: {
    color: c.accentText,
    fontSize: 17,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '90%',
    marginTop: 80,
  },
  footerCircle: {
    width: 130,
    height: 130,
    resizeMode: 'contain',
    marginLeft: -40,
    marginBottom: -45,
  },
  footerLogo: {
    width: 100,
    height: 40,
    marginBottom: -45,
    resizeMode: 'contain',
  },
});

export default OtpVerificationScreen;
