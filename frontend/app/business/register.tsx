import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ActivityIndicator,
  Image,
  ScrollView,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { registerBusiness } from '@/services/api';

const BusinessRegister = () => {
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    try {
      setLoading(true);
      const response = await registerBusiness(businessName, email, phone, password);

      if (response.message == "Business registered successfully") {
        Toast.show({
          type: 'success',
          text1: 'Registration Successful 🎉',
          text2: response.message,
        });
  
        router.push('/business/login');
      }

    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Registration Failed ❌',
        text2: error.response?.data?.message || 'Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView contentContainerStyle={styles.innerContainer} keyboardShouldPersistTaps="handled">
          <Image style={styles.logoImage} source={require('../../assets/images/icon.png')} />
          <Text style={styles.header}>Register Your Business</Text>
          <Text style={styles.subHeader}>Start selling to a wider audience!</Text>

          <TextInput
            style={styles.input}
            placeholder="Business Name"
            placeholderTextColor="gainsboro"
            value={businessName}
            onChangeText={setBusinessName}
          />
          <TextInput
            style={styles.input}
            placeholder="Email Address"
            placeholderTextColor="gainsboro"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Phone Number"
            placeholderTextColor="gainsboro"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="gainsboro"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity style={styles.loginButton} onPress={handleRegister}>
            {loading ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.loginText}>Register</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.signupText}>
              Go back to <Text style={styles.boldText}>Login</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </TouchableWithoutFeedback>
      <Toast />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#61A0AF', padding: 16 },
  innerContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 40,
  },
  logoImage: { width: 250, height: 200, borderRadius: 20, marginBottom: 20 },
  header: { fontSize: 20, color: '#000', fontWeight: 'bold', marginBottom: 8 },
  subHeader: { fontSize: 14, color: '#000', marginBottom: 24 },
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
  loginButton: {
    width: '100%',
    height: 48,
    backgroundColor: '#000',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 16,
  },
  loginText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  signupText: { color: '#000' },
  boldText: { fontWeight: 'bold' },
});

export default BusinessRegister;
