import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, Image, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, Dimensions } from 'react-native';
import { registerUser } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import CountryPicker from '@/components/CountryPicker';
import Toast from 'react-native-toast-message';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Appearance } from 'react-native';
import Swiper from 'react-native-swiper';


const { width } = Dimensions.get('window');

const RegisterScreen = () => {
    const [name, setName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [countryCode, setCountryCode] = useState('US');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [callingCode, setCallingCode] = useState('1');
    const [showCountryPicker, setShowCountryPicker] = useState(false);
    const [loading, setLoading] = useState(false);
    const isDarkMode = Appearance.getColorScheme() === 'dark';

  const formatPhoneNumber = (callingCode: string, phoneNumber: string) => {
    // Remove leading zero if present
    const formattedNumber = phoneNumber.replace(/^0/, '');
    return `+${callingCode}${formattedNumber}`;
  };


  const handleRegister = async () => {
    try {
      const fullPhoneNumber = formatPhoneNumber (callingCode, phoneNumber);
      setLoading(true);
      const data = await registerUser(name, email, password, fullPhoneNumber);
      if (data.message == "User created successfully") {
        Toast.show({
          type: 'success',
          text1: 'Sign up Successful',
          text2: 'Welcome! 🎉',
        });
        router.push('/login');
      } else {
        Toast.show({
          type: 'error',
          text1: 'Sign up Failed',
          text2: data.message || 'Please try again.',
        });
      }
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Sign Up Failed',
        text2: error.message || 'Something went wrong.',
      });
    } finally {
      setLoading(false);
    }
  };


  return (
    <LinearGradient
      colors={['#EAF0FF', '#F4F6FF']}
      style={{ flex: 1 }}
    >
      <StatusBar style="dark" translucent backgroundColor="transparent" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            
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
                  <Image
                    source={require('../assets/images/customer.jpg')}
                    style={styles.bannerImage}
                    resizeMode="cover"
                  />
                </View>
                <View style={styles.slide}>
                  <Image
                    source={require('../assets/images/seller.jpg')}
                    style={styles.bannerImage}
                    resizeMode="cover"
                  />
                </View>
                <View style={styles.slide}>
                  <Image
                    source={require('../assets/images/driver.jpg')}
                    style={styles.bannerImage}
                    resizeMode="cover"
                  />
                </View>
              </Swiper>
            </View>

            {/* 🧾 Input fields */}
            <View style={styles.formContainer}>
              <View style={styles.inputContainer}>
                <Ionicons name="person" size={20} color="#1b1b1b" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your name"
                  placeholderTextColor="#666"
                  autoCorrect={false}
                  value={name}
                  onChangeText={setName}
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="mail" size={20} color="#1b1b1b" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your email"
                  placeholderTextColor="#666"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={email}
                  onChangeText={setEmail}
                />
              </View>

              <View style={styles.inputContainer}>
                <TouchableOpacity
                  style={styles.countryCodeButton}
                  onPress={() => setShowCountryPicker(true)}
                >
                  <Text style={styles.callingCode}>{callingCode}</Text>
                  <Ionicons name="chevron-down-sharp" size={16} color="#444" />
                </TouchableOpacity>
                <TextInput
                  style={[styles.input, styles.phoneInput]}
                  placeholder="Phone number"
                  placeholderTextColor="#666"
                  keyboardType="phone-pad"
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                />
              <CountryPicker
                visible={showCountryPicker}
                onClose={() => setShowCountryPicker(false)}
                onSelect={(country) => {
                  // 1. Use 'code' instead of 'cca2'
                  setCountryCode(country.code); 
                  
                  // 2. Use 'dial_code' instead of 'callingCode[0]'
                  setCallingCode(country.dial_code); 
                }}
              />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed" size={20} color="#1b1b1b" style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder="Password"
                  placeholderTextColor="#666"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons
                    name={showPassword ? 'eye' : 'eye-off'}
                    size={20}
                    color="#666"
                  />
                </TouchableOpacity>
              </View>

              {/* Sign Up Button */}
              <TouchableOpacity style={styles.button} onPress={handleRegister}>
                {loading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.buttonText}>Sign Up</Text>
                )}
              </TouchableOpacity>

              <Text style={styles.roleText}>Select your role to continue registration.</Text>

            {/* Register (outlined pill) */}
            <TouchableOpacity
              style={styles.loginButton}
              onPress={() => router.push('/login')}
            >
              <Text style={styles.loginText}>
                Already registered? <Text style={styles.loginBold}>Sign in now!</Text>
              </Text>
            </TouchableOpacity>
              <View style={styles.bottomLogos}>
                <Image source={require('../assets/images/icon.png')} style={styles.circleLogo} />
                <Image source={require('../assets/images/icondark.png')} style={styles.brandLogo} />
              </View>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
        <Toast />
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#e9f0ff' },
  scrollContent: { flexGrow: 1, alignItems: 'center', paddingVertical: 30 },
  
  bannerContainer: { height: 180, width: width * 0.9, borderRadius: 16, overflow: 'hidden', marginBottom: 30 },
  slide: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  bannerImage: { width: '100%', height: '100%', borderRadius: 16, marginBottom: -10 },

  dot: { backgroundColor: '#ccc', width: 6, height: 6, borderRadius: 3, margin: 3 },
  activeDot: { backgroundColor: '#1b7c22', width: 6, height: 6, borderRadius: 3, margin: 3 },

  formContainer: { width: '100%', alignItems: 'center' },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: 25,
    borderWidth: 1.2,
    borderColor: '#A3D977',
    marginVertical: 8,
    paddingHorizontal: 16,
    height: 50,
  },
  input: { flex: 1, fontSize: 16, color: '#000' },
  inputIcon: { marginRight: 10 },
  passwordInput: { paddingRight: 35 },
  eyeIcon: { position: 'absolute', right: 16, padding: 4 },

  countryCodeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
    borderRightWidth: 1,
    borderRightColor: '#ddd',
    paddingRight: 8,
  },
  callingCode: { fontSize: 16, color: '#000', fontWeight: '500' },
  phoneInput: { marginLeft: 4 },

  button: {
    width: '90%',
    height: 50,
    backgroundColor: '#7ACB22',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  roleText: { marginTop: 20, fontSize: 14, color: '#000', textAlign: 'center', fontWeight: '500' },

  bottomLogos: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '90%',
    marginTop: 25,
  },
  circleLogo: {
    width: 150,
    height: 150,
    resizeMode: 'contain',
    marginLeft: -50,
    marginBottom: -280,

  },
  brandLogo: {
    width: 90,
    height: 30,
    resizeMode: 'contain',
    marginLeft: -50,
    marginBottom: -200,
  },
    loginButton: {
    width: 250,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: '#84cc16',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  loginText: {
    color: '#1e3a8a',
    fontSize: 15,
  },
  loginBold: {
    color: '#84cc16',
    fontWeight: '700',
  },
});

export default RegisterScreen;