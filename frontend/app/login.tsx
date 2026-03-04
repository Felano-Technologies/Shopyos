import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View, Text, Alert, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, Image, KeyboardAvoidingView, Platform, Pressable, Keyboard, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import * as SecureStore from 'expo-secure-store';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { loginUser } from '@/services/api';
import { Appearance } from 'react-native';
import * as Location from 'expo-location';

const { width } = Dimensions.get('window');



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

      // Get device location
      let latitude = 0;
      let longitude = 0;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({});
          latitude = location.coords.latitude;
          longitude = location.coords.longitude;
        }
      } catch (locationError) {
        console.log('Location access denied or unavailable');
      }

      const response = await loginUser(email, password, latitude, longitude);



      if (response.message == "Login successful") {

        Toast.show({
          type: 'success',
          text1: 'Login Successful 😊',
          text2: 'Welcome back! 🎉',
        });

        // Check if user needs to select a role (using the needsRole flag from API)
        if (response.needsRole) {
          // User has no role assigned, redirect to role selection
          router.push('/role');
        } else {
          // User has a role, proceed with normal navigation
          const userRole = response.role?.toLowerCase();

          if (userRole === 'customer' || userRole === 'buyer') {
            router.push("/home");
          } else if (userRole === 'seller') {
            router.push("/business/dashboard");
          } else if (userRole === 'driver') {
            router.push("/driver");
          } else if (userRole === 'admin') {
            router.push("/admin/dashboard");
          }
        }
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
    <View style={styles.container}>
      <StatusBar style="dark" translucent backgroundColor="transparent" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <Pressable onPress={Keyboard.dismiss} style={{ flex: 1 }}>
          <View style={styles.innerContainer}>
            {/* Logo */}
            <Image
              source={require('../assets/images/icondark.png')}
              style={styles.logo}
            />

            {/* Title */}
            <Text style={styles.title}>Hello, Sign into your account</Text>
            <Text style={styles.subtitle}>
              Welcome back, you’ve been missed!
            </Text>

            {/* Email Input */}
            <View style={styles.inputContainer}>
              <Ionicons name="mail" size={20} color="#333" />
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                placeholderTextColor="#888"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed" size={20} color="#333" />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#888"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
              >
                <Ionicons
                  name={showPassword ? 'eye' : 'eye-off'}
                  size={20}
                  color="#111827"
                />
              </TouchableOpacity>
            </View>

            {/* Forgot Password */}
            <TouchableOpacity onPress={() => router.push('/forgotPassword')}>
              <Text style={styles.forgotPassword}>Forgot password?</Text>
            </TouchableOpacity>


            {/* Sign in (solid pill) */}
            <TouchableOpacity
              style={[styles.signInButton, loading && styles.disabledButton]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.signInText}>Sign in</Text>
              )}
            </TouchableOpacity>

            {/* Register (outlined pill) */}
            <TouchableOpacity
              style={styles.registerButton}
              onPress={() => router.push('/register')}
            >
              <Text style={styles.registerText}>
                Not registered? <Text style={styles.registerBold}>Sign up now!</Text>
              </Text>
            </TouchableOpacity>

            {/* Bottom Logos */}
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
        </Pressable>
      </KeyboardAvoidingView>
      <Toast />
    </View>
  );
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e9f0ff', // pale light-blue like the image
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyboardView: {
    flex: 1,
  },
  pressableContainer: {
    flex: 1,
    justifyContent: 'center', // Fix vertical alignment
    alignItems: 'center',     // Fix horizontal alignment (prevents shift to left)
    width: '100%',
  },
  innerContainer: {
    width: '100%',
    paddingHorizontal: 24, // Use padding instead of percentage width
    alignItems: 'center', // Centers contents horizontally
    justifyContent: 'center',
    flex: 1,
  },
  logo: {
    width: 200,
    height: 60,
    resizeMode: 'contain',
    marginBottom: 10,
    marginTop: 20,
  },
  title: {
    fontSize: 22,
    color: '#1e3a8a', // deep blue heading
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#444',
    textAlign: 'center',
    marginBottom: 28,
    opacity: 0.9,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 28, // pill-like inputs
    borderWidth: 1.5,
    borderColor: '#84cc16', // green border like image
    paddingHorizontal: 16,
    height: 56,
    marginVertical: 8,
    elevation: 2,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    marginLeft: 8,
  },
  eyeIcon: {
    padding: 4,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    color: '#1e3a8a',
    fontSize: 14,
    marginTop: 6,
    marginBottom: 12,
  },
  signInButton: {
    width: 250,
    height: 50,
    backgroundColor: '#84cc16', // solid green
    borderRadius: 25, // big pill
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,

  },
  disabledButton: {
    opacity: 0.85,
  },
  signInText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textTransform: 'none',
  },
  registerButton: {
    width: 250,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: '#84cc16',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  registerText: {
    color: '#1e3a8a',
    fontSize: 15,
  },
  registerBold: {
    color: '#84cc16',
    fontWeight: '700',
  },
  bottomLogos: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginTop: 26,
    paddingHorizontal: 6,
    marginBottom: -20,
  },
  circleLogo: {
    width: 150,
    height: 150,
    resizeMode: 'contain',
    marginLeft: -50,
    marginBottom: -200,

  },
  brandLogo: {
    width: 90,
    height: 30,
    resizeMode: 'contain',
    marginLeft: -50,
    marginBottom: -200,
  },
});

export default LoginScreen;