import { router } from 'expo-router';
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform, Pressable, Keyboard, Dimensions } from 'react-native';
import AppImage from '@/components/AppImage';
import { registerUser } from '@/services/api';
import { isGoogleAuthConfigured, useGoogleAuth, signInWithGoogle } from '@/services/auth';
import { Ionicons } from '@expo/vector-icons';
import CountryPicker from '@/components/CountryPicker';
import { CustomInAppToast } from "@/components/InAppToastHost";
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import Swiper from 'react-native-swiper';
import DisclaimerModal from '@/components/DisclaimerModal';
import { resetToRoute } from '@/utils/navigation';
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

const { width } = Dimensions.get('window');

const RegisterScreen = () => {
  const themeColors = useThemeColors();
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);
  const C = useMemo(() => buildC(themeColors), [themeColors]);
  const styles = useMemo(() => getStyles(C), [C]);
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [callingCode, setCallingCode] = useState('233');
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const googleAuthConfigured = isGoogleAuthConfigured();
  const [request, response, promptAsync] = useGoogleAuth();
  const [errors, setErrors] = useState<Record<string, string>>({});


  const isFormValid = useMemo(() => {
    return name.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && password.length >= 6 && phoneNumber.replace(/\D/g, '').length >= 6;
  }, [name, email, password, phoneNumber]);

  useEffect(() => {
    if (response?.type === 'success') {
      const idToken = response.params?.id_token;
      if (!idToken) {
        CustomInAppToast.show({ type: 'error', title: 'Google Sign-Up Failed', message: 'No token received.' });
        return;
      }
      setLoading(true);
      signInWithGoogle(idToken, referralCode)
        .then(async () => {
          CustomInAppToast.show({ type: 'success', title: 'Welcome to Shopyos!', message: 'Account created with Google.' });
          resetToRoute('/role');
        })
        .catch((err: Error) => {
          if (/referral code/i.test(err.message)) {
            setErrors(prev => ({ ...prev, referralCode: err.message }));
          }
          CustomInAppToast.show({ type: 'error', title: 'Google Sign-Up Failed', message: err.message });
        })
        .finally(() => setLoading(false));
    }
  }, [response]);


  const formatPhoneNumber = (callingCode: string, phoneNumber: string) => {
    const cleanCode = callingCode.replace('+', '');
    const formattedNumber = phoneNumber.replace(/^0/, '');
    return `+${cleanCode}${formattedNumber}`;
  };
  const handleRegister = async () => {
    const fieldErrors: Record<string, string> = {};
    if (!name.trim()) fieldErrors.name = 'Full name is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fieldErrors.email = 'Enter a valid email address';
    if (password.length < 6) fieldErrors.password = 'Password must be at least 6 characters';
    if (phoneNumber.replace(/\D/g, '').length < 6) fieldErrors.phoneNumber = 'Enter a valid phone number';
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;

    if (!termsAccepted || !privacyAccepted) {
      CustomInAppToast.show({
        type: 'error',
        title: 'Agreement Required',
        message: 'Please accept the Terms of Service and Privacy Policy to continue.',
      });
      return;
    }
    const t0 = Date.now();
    const log = (msg: string) => console.log(`[RegisterScreen] +${Date.now() - t0}ms ${msg}`);
    try {
      log('handleRegister started');
      const fullPhoneNumber = formatPhoneNumber(callingCode, phoneNumber);
      setLoading(true);
      const data = await registerUser(name, email, password, fullPhoneNumber, referralCode, termsAccepted, privacyAccepted);
      log(`registerUser() resolved — message=${data.message}`);
      if (data.message === "User created successfully") {
        CustomInAppToast.show({
          type: 'success',
          title: 'Sign up Successful',
          message: 'Welcome!',
        });
        log('Branch: success -> navigating to /login');
        resetToRoute('/login');
      } else {
        log(`Branch: unexpected message "${data.message}" -> showing error toast, no navigation`);
        CustomInAppToast.show({
          type: 'error',
          title: 'Sign up Failed',
          message: data.message || 'Please try again.',
        });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Something went wrong.';
      log(`handleRegister FAILED: ${message}`);
      if (/referral code/i.test(message)) {
        setErrors(prev => ({ ...prev, referralCode: message }));
      }
      CustomInAppToast.show({
        type: 'error',
        title: 'Sign Up Failed',
        message,
      });
    } finally {
      log('handleRegister finished — clearing loading state');
      setLoading(false);
    }
  };

  const handleGoogleSignUp = () => {
    if (!googleAuthConfigured) {
      CustomInAppToast.show({
        type: 'error',
        title: 'Google Sign-Up Unavailable',
        message: 'Google OAuth is not configured for this platform.',
      });
      return;
    }
    promptAsync();
  };
  
  const content = (
    <Pressable onPress={Keyboard.dismiss} style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* 🖼️ Top Banner Carousel */}
        <View style={styles.bannerContainer}>
          <Swiper
            autoplay
            autoplayTimeout={3}
            loop
            showsPagination
            dotStyle={styles.dot}
            activeDotStyle={styles.activeDot}
          >
            <View style={styles.slide}>
              <AppImage source={require('../assets/images/customer.jpg')} style={styles.bannerImage} contentFit="cover" />
            </View>
            <View style={styles.slide}>
              <AppImage source={require('../assets/images/seller.jpg')} style={styles.bannerImage} contentFit="cover" />
            </View>
            <View style={styles.slide}>
              <AppImage source={require('../assets/images/driver.jpg')} style={styles.bannerImage} contentFit="cover" />
            </View>
          </Swiper>
        </View>
        {/* Form heading */}
        <Text style={styles.formTitle}>Create your account</Text>
        <Text style={styles.formSubtitle}>Join thousands of shoppers and sellers on Shopyos</Text>
        {/* 🧾 Input fields */}
        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <Ionicons name="person" size={20} color={C.body} style={styles.inputIcon} />
            <TextInput
              accessibilityLabel="Full name"
              accessibilityRole="none"
              style={styles.input}
              placeholder="Enter your name"
              placeholderTextColor={C.subtle}
              autoCorrect={false}
              value={name}
              onChangeText={(v) => { setName(v); setErrors((e) => ({ ...e, name: '' })); }}
            />
          </View>
          {errors.name ? <Text style={styles.fieldError}>{errors.name}</Text> : null}
          <View style={styles.inputContainer}>
            <Ionicons name="mail" size={20} color={C.body} style={styles.inputIcon} />
            <TextInput
              accessibilityLabel="Email address"
              accessibilityRole="none"
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor={C.subtle}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={(v) => { setEmail(v); setErrors((e) => ({ ...e, email: '' })); }}
            />
          </View>
          {errors.email ? <Text style={styles.fieldError}>{errors.email}</Text> : null}
          <View style={styles.inputContainer}>
            <TouchableOpacity
              accessibilityLabel="Select country code"
              accessibilityRole="button"
              style={styles.countryCodeButton}
              onPress={() => setShowCountryPicker(true)}
            >
              <Text style={styles.callingCode}>{callingCode}</Text>
              <Ionicons name="chevron-down-sharp" size={16} color={C.muted} />
            </TouchableOpacity>
            <TextInput
              accessibilityLabel="Phone number"
              accessibilityRole="none"
              style={[styles.input, styles.phoneInput]}
              placeholder="Phone number"
              placeholderTextColor={C.subtle}
              keyboardType="phone-pad"
              value={phoneNumber}
              onChangeText={(v) => { setPhoneNumber(v); setErrors((e) => ({ ...e, phoneNumber: '' })); }}
            />
            <CountryPicker
              visible={showCountryPicker}
              onClose={() => setShowCountryPicker(false)}
              onSelect={(country) => {
                setCallingCode(country.dial_code);
              }}
            />
          </View>
          {errors.phoneNumber ? <Text style={styles.fieldError}>{errors.phoneNumber}</Text> : null}
          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed" size={20} color={C.body} style={styles.inputIcon} />
            <TextInput
              accessibilityLabel="Password"
              accessibilityRole="none"
              style={[styles.input, styles.passwordInput]}
              placeholder="Password"
              placeholderTextColor={C.subtle}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              value={password}
              onChangeText={(v) => { setPassword(v); setErrors((e) => ({ ...e, password: '' })); }}
            />
            <TouchableOpacity accessibilityLabel={showPassword ? 'Hide password' : 'Show password'} accessibilityRole="button" style={styles.eyeIcon} onPress={() => setShowPassword(!showPassword)}>
              <Ionicons
                name={showPassword ? 'eye' : 'eye-off'}
                size={20}
                color={C.subtle}
              />
            </TouchableOpacity>
          </View>
          {errors.password ? <Text style={styles.fieldError}>{errors.password}</Text> : null}
          <View style={styles.inputContainer}>
            <Ionicons name="gift" size={20} color={C.body} style={styles.inputIcon} />
            <TextInput
              accessibilityLabel="Referral code"
              accessibilityRole="none"
              style={styles.input}
              placeholder="Referral Code (Optional)"
              placeholderTextColor={C.subtle}
              autoCapitalize="characters"
              autoCorrect={false}
              value={referralCode}
              onChangeText={(text) => {
                setReferralCode(text);
                if (errors.referralCode) setErrors(prev => ({ ...prev, referralCode: '' }));
              }}
            />
          </View>
          {errors.referralCode ? <Text style={styles.fieldError}>{errors.referralCode}</Text> : null}
          {/* Disclaimer checkboxes */}
          <View style={styles.disclaimerRow}>
            <TouchableOpacity accessibilityLabel="Accept terms of service" accessibilityRole="checkbox" onPress={() => setTermsAccepted(!termsAccepted)} activeOpacity={0.8}>
              <View style={[styles.disclaimerBox, termsAccepted && styles.disclaimerBoxChecked]}>
                {termsAccepted && <Ionicons name="checkmark" size={13} color="#FFF" />}
              </View>
            </TouchableOpacity>
            <Text style={styles.disclaimerText}>
              I agree to the{' '}
              <Text style={styles.disclaimerLink} accessibilityRole="link" accessibilityLabel="View terms of service" onPress={() => setShowTermsModal(true)}>
                Terms of Service
              </Text>
            </Text>
          </View>
          <View style={[styles.disclaimerRow, { marginBottom: 16 }]}>
            <TouchableOpacity accessibilityLabel="Accept privacy policy" accessibilityRole="checkbox" onPress={() => setPrivacyAccepted(!privacyAccepted)} activeOpacity={0.8}>
              <View style={[styles.disclaimerBox, privacyAccepted && styles.disclaimerBoxChecked]}>
                {privacyAccepted && <Ionicons name="checkmark" size={13} color="#FFF" />}
              </View>
            </TouchableOpacity>
            <Text style={styles.disclaimerText}>
              I agree to the{' '}
              <Text style={styles.disclaimerLink} accessibilityRole="link" accessibilityLabel="View privacy policy" onPress={() => setShowPrivacyModal(true)}>
                Privacy Policy
              </Text>
            </Text>
          </View>
          {/* Sign Up Button */}
          <TouchableOpacity accessibilityLabel="Create account" accessibilityRole="button" style={[styles.button, !isFormValid && styles.buttonDisabled]} onPress={handleRegister} disabled={loading || !isFormValid}>
            {loading ? (
              <ActivityIndicator size="small" color={C.textInverse} />
            ) : (
              <Text style={styles.buttonText}>Sign Up</Text>
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
            style={[styles.googleButton, (!googleAuthConfigured || loading) && styles.buttonDisabled]}
            onPress={handleGoogleSignUp}
            disabled={loading || (googleAuthConfigured && !request)}
          >
            <Ionicons name="logo-google" size={18} color={C.muted} style={{ marginRight: 8 }} />
            <Text style={styles.googleButtonText}>Continue with Google</Text>
          </TouchableOpacity>
          {/* Already registered */}
          <TouchableOpacity
            accessibilityLabel="Sign in to existing account"
            accessibilityRole="button"
            style={styles.loginButton}
            onPress={() => router.push('/login')}
          >
            <Text style={styles.loginText}>
              Already registered? <Text style={styles.loginBold}>Sign in now!</Text>
            </Text>
          </TouchableOpacity>
          <View style={styles.bottomLogos}>
            <AppImage source={require('../assets/images/adaptive-icon.png')} style={styles.circleLogo} contentFit="contain" />
            <AppImage source={require('../assets/images/icondark.png')} style={styles.brandLogo} contentFit="contain" />
          </View>
        </View>
        <DisclaimerModal
          type="terms_of_service"
          localOnly
          visible={showTermsModal}
          onClose={() => setShowTermsModal(false)}
          onAcknowledge={() => { setTermsAccepted(true); setShowTermsModal(false); }}
        />
        <DisclaimerModal
          type="privacy_policy"
          localOnly
          visible={showPrivacyModal}
          onClose={() => setShowPrivacyModal(false)}
          onAcknowledge={() => { setPrivacyAccepted(true); setShowPrivacyModal(false); }}
        />
      </ScrollView>
    </Pressable>
  );

  return (
    <LinearGradient
      colors={[C.bg, C.bg]}
      style={{ flex: 1 }}
    >
      <StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'} translucent backgroundColor="transparent" />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* ✅ KeyboardAvoidingView only on iOS; on Android just render content directly */}
        {Platform.OS === 'ios' ? (
          <KeyboardAvoidingView behavior="padding" style={styles.container}>
            {content}
          </KeyboardAvoidingView>
        ) : (
          <View style={styles.container}>
            {content}
          </View>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
};

const getStyles = (C: LegacyPalette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scrollContent: { alignItems: 'center', paddingTop: 16, paddingBottom: 15 },
  bannerContainer: { height: 180, width: width * 0.9, borderRadius: 16, overflow: 'hidden', marginBottom: 16 },
  slide: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  bannerImage: { width: '100%', height: '100%', borderRadius: 16, marginBottom: -10 },
  dot: { backgroundColor: C.borderStrong, width: 6, height: 6, borderRadius: 3, margin: 3 },
  activeDot: { backgroundColor: C.navyMid, width: 6, height: 6, borderRadius: 3, margin: 3 },
  formTitle: { fontSize: 20, fontWeight: '700', color: C.navyMid, textAlign: 'center', marginTop: 4, marginBottom: 4 },
  formSubtitle: { fontSize: 13, color: C.muted, textAlign: 'center', marginBottom: 16, paddingHorizontal: 24 },
  formContainer: { width: '100%', alignItems: 'center', paddingHorizontal: 24 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: C.badgeBg,
    borderRadius: 14,
    borderWidth: 0,
    marginVertical: 7,
    paddingHorizontal: 16,
    height: 50,
  },
  input: { flex: 1, fontSize: 16, color: C.body },
  inputIcon: { marginRight: 10 },
  passwordInput: { paddingRight: 35 },
  eyeIcon: { position: 'absolute', right: 16, padding: 4 },
  countryCodeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
    borderRightWidth: 1,
    borderRightColor: C.borderStrong,
    paddingRight: 8,
  },
  callingCode: { fontSize: 16, color: C.body, fontWeight: '500' },
  phoneInput: { marginLeft: 4 },
  button: {
    width: '90%',
    height: 50,
    backgroundColor: C.navyMid,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: { color: C.textInverse, fontSize: 17, fontWeight: '600' },
  roleText: { marginTop: 8, fontSize: 12, color: C.subtle, textAlign: 'center' },
  bottomLogos: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginTop: 24,
    paddingHorizontal: 8,
  },
  circleLogo: {
    width: 120,
    height: 120,
    resizeMode: 'contain',
    marginLeft: -50,
  },
  brandLogo: {
    width: 80,
    height: 80,
    resizeMode: 'contain',
  },
  loginButton: {
    width: '90%',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.navyMid,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  loginText: {
    color: C.navyMid,
    fontSize: 15,
  },
  loginBold: {
    color: C.navyMid,
    fontWeight: '700',
  },
  disclaimerRow: { flexDirection: 'row', alignItems: 'center', width: '100%', marginTop: 8, paddingHorizontal: 4 },
  disclaimerBox: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: C.navyMid, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  disclaimerBoxChecked: { backgroundColor: C.navyMid },
  disclaimerText: { flex: 1, fontSize: 13, color: C.muted, lineHeight: 18 },
  disclaimerLink: { color: C.navyMid, fontWeight: '700', textDecorationLine: 'underline' },
  divider: { flexDirection: 'row', alignItems: 'center', width: '100%', marginVertical: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.border },
  dividerText: { marginHorizontal: 10, color: C.subtle, fontSize: 13 },
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
  googleButtonText: { color: C.body, fontSize: 16, fontWeight: '600' },
  fieldError: { color: '#DC2626', fontSize: 12, marginTop: -8, marginBottom: 8, paddingHorizontal: 16 },
  buttonDisabled: { opacity: 0.5 },
});
export default RegisterScreen;
