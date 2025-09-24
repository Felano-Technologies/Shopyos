import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View, Text, Alert, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, Image, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { loginUser } from '@/services/api';

import { Appearance } from 'react-native';

const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const isDarkMode = Appearance.getColorScheme() === 'dark';

// Handle Sign In
const handleLogin = async () => {
  try {
    setLoading(true);

    // Request location permissions
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Location permission is required to proceed.');
      setLoading(false); // Hide loading indicator
      return;
    }

    // Get the current location
    const location = await Location.getCurrentPositionAsync({});
    const { latitude, longitude } = location.coords;

    const response = await loginUser(email, password, latitude, longitude);

    if (response.message == "Login successful") {
      // Set the token securely using expo-secure-store with 7 days expiration
      await SecureStore.setItemAsync('userId', response.token); // Securely store the token

      Toast.show({
        type: 'success',
        text1: 'Login Successful 😊',
        text2: 'Welcome back! 🎉',
      });
      router.push("/home");
    } else {
      Toast.show({
        type: 'error',
        text1: 'Login Failed ❌',
        text2: response.message || 'Please try again.',
      });
    }
  } catch (error: any) {
    Toast.show({
      type: 'error',
      text1: 'Sign In Failed ⚠️',
      text2: error.message || 'Something went wrong.',
    });
  } finally {
    setLoading(false);
  }
};
  return (
        <LinearGradient
      colors={isDarkMode ? ['#0F0F1A', '#1A1A2E'] : ['#FDFBFB', '#EBEDEE']}
      style={{ flex: 1 }}
    >
      <StatusBar style={isDarkMode ? 'light' : 'dark'} translucent backgroundColor="transparent" />
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.innerContainer}>
        <Image style={styles.logoImage} source={require("../assets/images/icondark.png")} />
          <Text style={styles.header}>Hello, Sign into your Account</Text>
          <Text style={styles.subHeader}>Welcome back you've been missed!</Text>

          <TextInput
            style={styles.input}
            placeholder="Enter your email"
            placeholderTextColor={"gainsboro"}
            keyboard-type="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />

          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Password"
              placeholderTextColor={"gainsboro"}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Ionicons
                name={showPassword ? 'eye' : 'eye-off'}
                size={24}
                color="black"
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => alert('Reset Password')}>
            <Text style={styles.forgotPassword}>Forgot password?</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
            {loading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={styles.loginText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/register')}>
            <Text style={styles.signupText}>Not registered? <Text style={styles.boldText}>Sign up now!</Text></Text>
          </TouchableOpacity>
        </View>
      </TouchableWithoutFeedback>
      <Toast  />
    </KeyboardAvoidingView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020b4dff',
    padding: 16,
  },
  innerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImage: {
    width: 250,
    height: 62,
    borderRadius: 1,
    marginBottom: 10,
  },
  header: {
    fontSize: 18,
    color: '#ffffffff',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subHeader: {
    fontSize: 14,
    color: '#ffffffff',
    marginBottom: 24,
  },
  input: {
    width: '100%',
    height: 48,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginVertical: 10,
    fontSize: 18,
    color: '#000',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 12,
  },
  passwordInput: {
    width: '100%',
    height: 48,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginVertical: 10,
    fontSize: 18,
    color: '#000',
  },
  eyeIcon: {
    position: 'absolute',
    right: 16,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    color: '#ffffffff',
    marginBottom: 24,
  },
  loginButton: {
    width: '100%',
    height: 48,
    backgroundColor: '#028f2cff',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 16,
  },
  loginText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  signupText: {
    color: '#fff',
  },
  boldText: {
    fontWeight: 'bold',
  },
});

export default LoginScreen;
