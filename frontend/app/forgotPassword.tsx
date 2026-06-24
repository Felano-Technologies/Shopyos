import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Dimensions,
  Alert,
  ActivityIndicator,
} from 'react-native';
import AppImage from '@/components/AppImage';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { requestPasswordResetOTP } from '@/services/api';

const { width } = Dimensions.get('window');

type Method = 'email' | 'sms';

const ForgotPasswordScreen = () => {
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
      Alert.alert('Failed', error instanceof Error ? error.message : 'Could not send code. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" translucent backgroundColor="transparent" />

      <AppImage
        source={require('../assets/images/forgotpassword.png')}
        style={styles.banner}
      />

      <Text style={styles.title}>Forgotten Password?</Text>
      <Text style={styles.subtitle}>
        Enter your email and choose how you'd{'\n'}like to receive your verification code.
      </Text>

      {/* Email input */}
      <View style={styles.inputContainer}>
        <Ionicons name="mail-sharp" size={20} color="#000" style={styles.icon} />
        <TextInput
          style={styles.input}
          placeholder="Enter your email address"
          placeholderTextColor="#555"
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
            color={method === 'email' ? '#1e3a8a' : '#64748b'}
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
            color={method === 'sms' ? '#1e3a8a' : '#64748b'}
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
          <ActivityIndicator color="#fff" />
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
    </View>
  );
};

export default ForgotPasswordScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
    color: '#000',
    textAlign: 'center',
    marginTop: 20,
  },
  subtitle: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
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
    color: '#000',
    fontSize: 14,
  },
  methodLabel: {
    alignSelf: 'flex-start',
    marginLeft: '5%',
    marginTop: 20,
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
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
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    gap: 4,
  },
  methodCardActive: {
    borderColor: '#1e3a8a',
    backgroundColor: '#EEF2FF',
  },
  methodText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  methodTextActive: {
    color: '#1e3a8a',
  },
  methodHint: {
    fontSize: 10,
    color: '#94a3b8',
    textAlign: 'center',
  },
  sendButton: {
    backgroundColor: '#1e3a8a',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    width: '90%',
    marginTop: 28,
  },
  sendText: {
    color: '#fff',
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
