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
} from 'react-native';
import AppImage from '@/components/AppImage';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';

const { width } = Dimensions.get('window');

const OtpVerificationScreen = () => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const inputs = useRef<TextInput[]>([]);

  const handleChange = (text: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    if (text && index < 5) {
      inputs.current[index + 1].focus();
    }
  };

  const isOtpComplete = otp.every((digit) => digit !== '');

  const handleVerify = () => {
    if (isOtpComplete) {
      router.replace('/home'); // Replace this with actual verification logic
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
            Your email or number
          </Text>

          {/* OTP Input Boxes */}
          <View style={styles.otpContainer}>
            {otp.map((digit, index) => (
              <TextInput
                key={'otp-' + index}
                ref={(ref) => { inputs.current[index] = ref!; }}
                style={styles.otpInput}
                keyboardType="numeric"
                maxLength={1}
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
              { opacity: isOtpComplete ? 1 : 0.6 },
            ]}
            disabled={!isOtpComplete}
            onPress={handleVerify}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[colors.accent, colors.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.verifyGradient}
            >
              <Text style={styles.verifyText}>Verify</Text>
            </LinearGradient>
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
    marginBottom: 40,
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
