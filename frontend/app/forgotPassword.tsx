import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TextInput,
  TouchableOpacity,
  Dimensions,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { requestPasswordReset } from '@/services/api';
import LottieView from 'lottie-react-native';

const { width } = Dimensions.get('window');

const ForgotPasswordScreen = () => {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);

  const handleRequestReset = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;

    try {
      setSending(true);
      await requestPasswordReset(normalizedEmail);
      setSuccessVisible(true);
    } catch (error: any) {
      Alert.alert('Request Failed', error?.message || 'Could not send reset email. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" translucent backgroundColor="transparent" />

      {/* Banner Image */}
      <Image
        source={require('../assets/images/forgotpassword.png')} // local placeholder image
        style={styles.banner}
      />

      {/* Title and Description */}
      <Text style={styles.title}>Forgotten Password?</Text>
      <Text style={styles.subtitle}>
        Please Enter Your Email Address To {'\n'}Receive a Verification Code.
      </Text>

      {/* Input Field */}
      <View style={styles.inputContainer}>
        <Ionicons name="mail-sharp" size={20} color="#000" style={styles.icon} />
        <TextInput
          style={styles.input}
          placeholder="Enter your email address"
          placeholderTextColor="#555"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
        />
      </View>

      {/* Verify Button */}
      <TouchableOpacity
        style={[styles.verifyButton, (!email || sending) && { opacity: 0.4 }]}
        disabled={!email || sending}
        onPress={handleRequestReset}
      >
        {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.verifyText}>Send Reset Link</Text>}
      </TouchableOpacity>

      <Modal
        visible={successVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSuccessVisible(false)}
      >
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <LottieView
              source={require('../assets/animations/reset-success.json')}
              autoPlay
              loop
              style={styles.successArt}
            />
            <Text style={styles.successTitle}>Email Sent</Text>
            <Text style={styles.successMessage}>
              Your reset link is on the way. Please check your inbox and spam folder.
            </Text>
            <TouchableOpacity
              style={styles.successButton}
              onPress={() => setSuccessVisible(false)}
            >
              <Text style={styles.successButtonText}>Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Footer Logos */}
      <View style={styles.bottomLogos}>
        <Image
          source={require('../assets/images/icon.png')}
          style={styles.circleLogo}
        />
        <Image
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
    backgroundColor: '#e9f0ff',
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
    backgroundColor: '#fff',
    borderColor: '#84cc16',
    borderWidth: 1,
    borderRadius: 25,
    width: '85%',
    marginTop: 30,
    paddingHorizontal: 10,
    height: 45,
  },
  icon: {
    marginHorizontal: 8,
  },
  input: {
    flex: 1,
    color: '#000',
    fontSize: 14,
  },
  verifyButton: {
    backgroundColor: '#84cc16',
    borderRadius: 25,
    paddingVertical: 14,
    alignItems: 'center',
    width: '85%',
    marginTop: 40,
  },
  verifyText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  bottomLogos: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '90%',
    marginTop: 210,
  },
  circleLogo: {
    width: 140,
    height: 140,
    resizeMode: 'contain',
    marginLeft: -40,
  },
  brandLogo: {
    width: 100,
    height: 40,
    resizeMode: 'contain',
  },
  successOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  successCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFF',
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingVertical: 26,
    alignItems: 'center',
  },
  successArt: {
    width: 170,
    height: 130,
    marginBottom: 10,
  },
  successBackdropArt: {
    width: 150,
    height: 70,
    resizeMode: 'contain',
    marginBottom: -8,
    opacity: 0.35,
  },
  successTitle: {
    fontSize: 28,
    fontFamily: 'Montserrat-Bold',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  successMessage: {
    fontSize: 14,
    fontFamily: 'Montserrat-Medium',
    color: '#64748B',
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 20,
  },
  successButton: {
    backgroundColor: '#0F172A',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 999,
  },
  successButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
  },
});
