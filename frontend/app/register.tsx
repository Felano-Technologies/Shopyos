import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, Image, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';
import * as Font from 'expo-font';
import AppLoading from 'expo-app-loading';
import { registerUser } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import CountryPicker from 'react-native-country-picker-modal'

const RegisterScreen = () => {
    const [name, setName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [countryCode, setCountryCode] = useState('US');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [callingCode, setCallingCode] = useState('1');
  const [showCountryPicker, setShowCountryPicker] = useState(false);


  const handleRegister = async () => {
    try {
      const fullPhoneNumber = `${countryCode}${phoneNumber}`;
      const data = await registerUser(name, email, password, fullPhoneNumber);
      console.log('Registration successful', data);
      router.push('/');
    } catch (error) {
      alert(error.error || 'Registration failed');
    }
  };

  const [fontsLoaded, setFontsLoaded] = useState(false);
  useEffect(() => {
    //loadFonts().then(() => setFontsLoaded(true));
  }, []);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView contentContainerStyle={{flexGrow: 1, justifyContent: 'center', alignItems: 'center'}}>
          <Image style={styles.logoImage} source={require('../assets/images/icon.png')} />
          <Text style={styles.logoText}>Register</Text>
          <Text style={styles.title}>Sign up as a user</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your name"
            placeholderTextColor={"gainsboro"}
            autoCorrect={false}
            value={name}
            onChangeText={setName}
          />
          <TextInput
            style={styles.input}
            placeholder="Enter your email"
            placeholderTextColor={"gainsboro"}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
          />
   <View style={styles.phoneContainer}>
            <TouchableOpacity
              style={styles.countryCodeWrapper}
              onPress={() => setShowCountryPicker(true)}
            >
              <CountryPicker
                withFlag
                withCallingCode
                withFilter
                countryCode={countryCode}
                onSelect={(country) => {
                  setCountryCode(country.cca2);
                  setCallingCode(country.callingCode[0]);
                }}
                visible={showCountryPicker}
                onClose={() => setShowCountryPicker(false)}
              />
              <Text style={styles.callingCode}>+{callingCode}</Text>
            </TouchableOpacity>
            <TextInput
              style={styles.phoneInput}
              placeholder="Phone Number"
              placeholderTextColor={"gainsboro"}
              keyboardType="numeric"
              autoCapitalize="none"
              autoCorrect={false}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
            />
          </View>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Password"
              placeholderTextColor={"gainsboro"}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowPassword(!showPassword)}>
              <Ionicons name={showPassword ? 'eye' : 'eye-off'} size={24} color="black" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.button} onPress={handleRegister}>
            <Text style={styles.buttonText}>Register</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.loginButton} onPress={() => router.push('/')}>
            <Text style={styles.loginText}>Already have an account? Login</Text>
          </TouchableOpacity>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#CDD1C4',
    padding: 16,
  },
  logoText: {
    fontSize: 32,
    color: '#fff',
    fontWeight: 'bold',
  },
  title: {
    fontSize: 24,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 22,
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
  button: {
    width: '100%',
    height: 48,
    backgroundColor: '#000',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 16,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loginButton: {
    marginTop: 16,
  },
  loginText: {
    color: '#fff',
  },
  logoImage: {
    width: 150,
    height: 150,
    marginBottom: 32,
    marginTop: -45,
    resizeMode: 'contain',
    alignSelf: 'center',
    borderRadius: 999,
  },
  phoneContainer: {
    flexDirection: 'row',
    width: '100%',
    alignItems: 'center',
  },
  countryCodeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    left: 0,
    zIndex: 1,
  },
  flag: {
    fontSize: 24,
    marginRight: 4,
  },
  countryCodeInput: {
    width: 60,
    height: 48,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 18,
    color: '#000',
  },
  phoneInput: {
    flex: 1,
    height: 48,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 95,
    marginVertical: 10,
    fontSize: 18,
    color: '#000',
  },
  countryCodeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    left: 0,
    zIndex: 1,
  },
  callingCode: {
    marginLeft: 8,
    fontSize: 18,
    color: '#000',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    position: 'relative',
  },
  passwordInput: {
    flex: 1,
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
});

export default RegisterScreen;
