import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Dimensions,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import AppImage from '@/components/AppImage';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { requestPasswordResetOTP } from '@/services/api';
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
  borderStrong: string;
  surfaceElevated: string;
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
    borderStrong: colors.borderStrong,
    surfaceElevated: colors.surfaceElevated,
    textInverse: colors.textInverse,
  };
}

const { width } = Dimensions.get('window');

type Method = 'email' | 'sms';

const ForgotPasswordScreen = () => {
  const themeColors = useThemeColors();
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);
  const C = useMemo(() => buildC(themeColors), [themeColors]);
  const styles = useMemo(() => getStyles(C), [C]);
  const [email, setEmail] = useState('');
  const [method, setMethod] = useState<Method>('email');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;

    try {
      setSending(true);
      const result = await requestPasswordResetOTP(normalizedEmail, method);
      router.push({
        pathname: '/forgotPasswordOTP',
        params: { email: normalizedEmail, method, maskedTarget: result.maskedTarget },
      });
    } catch (error: unknown) {
      CustomInAppToast.show({ type: 'error', title: 'Failed', message: error instanceof Error ? error.message : 'Could not send code. Please try again.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      bounces={false}
    >
      <StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'} translucent backgroundColor="transparent" />

      <AppImage
        source={require('../assets/images/forgotpassword.png')}
        style={styles.banner}
      />

      <Text style={styles.title}>Forgotten Password?</Text>
      <Text style={styles.subtitle}>
        {`Enter your email and choose how you'd\nlike to receive your verification code.`}
      </Text>

      {/* Email input */}
      <View style={styles.inputContainer}>
        <Ionicons name="mail-sharp" size={20} color={C.body} style={styles.icon} />
        <TextInput
          style={styles.input}
          placeholder="Enter your email address"
          placeholderTextColor={C.subtle}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      {/* Method selector */}
      <Text style={styles.methodLabel}>Send code via</Text>
      <View style={styles.methodRow}>
        <TouchableOpacity
          style={[styles.methodCard, method === 'email' && styles.methodCardActive]}
          onPress={() => setMethod('email')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="mail-outline"
            size={22}
            color={method === 'email' ? C.navyMid : C.muted}
          />
          <Text style={[styles.methodText, method === 'email' && styles.methodTextActive]}>
            Email
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.methodCard, method === 'sms' && styles.methodCardActive]}
          onPress={() => setMethod('sms')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="chatbubble-outline"
            size={22}
            color={method === 'sms' ? C.navyMid : C.muted}
          />
          <Text style={[styles.methodText, method === 'sms' && styles.methodTextActive]}>
            SMS
          </Text>
          <Text style={styles.methodHint}>Phone on your account</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.sendButton, (!email || sending) && { opacity: 0.4 }]}
        disabled={!email || sending}
        onPress={handleSend}
        activeOpacity={0.8}
      >
        {sending ? (
          <ActivityIndicator color={C.textInverse} />
        ) : (
          <Text style={styles.sendText}>Send Code</Text>
        )}
      </TouchableOpacity>

      <View style={styles.bottomLogos}>
        <AppImage
          source={require('../assets/images/adaptive-icon.png')}
          style={styles.circleLogo}
        />
        <AppImage
          source={require('../assets/images/icondark.png')}
          style={styles.brandLogo}
        />
      </View>
    </ScrollView>
  );
};

export default ForgotPasswordScreen;

const getStyles = (C: LegacyPalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  banner: {
    width: width * 0.9,
    height: 160,
    borderRadius: 14,
    resizeMode: 'cover',
    marginTop: 90,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: C.body,
    textAlign: 'center',
    marginTop: 20,
  },
  subtitle: {
    fontSize: 14,
    color: C.muted,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.badgeBg,
    borderRadius: 14,
    width: '90%',
    marginTop: 24,
    paddingHorizontal: 10,
    height: 50,
  },
  icon: {
    marginHorizontal: 8,
  },
  input: {
    flex: 1,
    color: C.body,
    fontSize: 14,
  },
  methodLabel: {
    alignSelf: 'flex-start',
    marginLeft: '5%',
    marginTop: 20,
    fontSize: 13,
    fontWeight: '600',
    color: C.body,
  },
  methodRow: {
    flexDirection: 'row',
    width: '90%',
    marginTop: 10,
    gap: 12,
  },
  methodCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.borderStrong,
    backgroundColor: C.surfaceElevated,
    gap: 4,
  },
  methodCardActive: {
    borderColor: C.navyMid,
    backgroundColor: C.badgeBg,
  },
  methodText: {
    fontSize: 14,
    fontWeight: '600',
    color: C.muted,
  },
  methodTextActive: {
    color: C.navyMid,
  },
  methodHint: {
    fontSize: 10,
    color: C.subtle,
    textAlign: 'center',
  },
  sendButton: {
    backgroundColor: C.navyMid,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    width: '90%',
    marginTop: 28,
  },
  sendText: {
    color: C.textInverse,
    fontSize: 17,
    fontWeight: '700',
  },
  bottomLogos: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '90%',
    marginTop: 'auto',
    paddingBottom: 20,
  },
  circleLogo: {
    width: 140,
    height: 140,
    resizeMode: 'contain',
    marginLeft: -40,
  },
  brandLogo: {
    width: 130,
    height: 32,
    resizeMode: 'contain',
  },
});
