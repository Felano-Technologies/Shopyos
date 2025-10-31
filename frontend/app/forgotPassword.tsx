import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TextInput,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

const { width } = Dimensions.get('window');

const ForgotPasswordScreen = () => {
  const [email, setEmail] = useState('');

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
        style={[styles.verifyButton, !email && { opacity: 0.4 }]}
        disabled={!email}
        onPress={() => router.push('/otp')}
      >
        <Text style={styles.verifyText}>Verify</Text>
      </TouchableOpacity>

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
});
