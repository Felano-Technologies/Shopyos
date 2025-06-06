import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, Image, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { registerUser } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import CountryPicker from 'react-native-country-picker-modal'
import Toast from 'react-native-toast-message';

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

  const formatPhoneNumber = (callingCode: string, phoneNumber: string) => {
    // Remove leading zero if present
    const formattedNumber = phoneNumber.replace(/^0/, '');
    return `+${callingCode}${formattedNumber}`;
  };


  const handleBusinessVerification = async () => {
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
        router.push('/business_verification');
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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView contentContainerStyle={{flexGrow: 1, justifyContent: 'center', alignItems: 'center'}}>
          <Image style={styles.logoImage} source={require('../assets/images/icon.png')} />
          <Text style={styles.logoText}>Register Your Business</Text>
          <Text style={styles.title}>Create your Business Account</Text>

          {/* Basic Info */}

          <Text style={styles.header}>Basic Information</Text>

          <TextInput
            style={styles.input}
            placeholder="Enter your Business Name"
            placeholderTextColor={"gainsboro"}
            autoCorrect={false}
            value={name}
            onChangeText={setName}
          />
          <TextInput
            style={styles.input}
            placeholder="Owner's Full Name"
           />
          <TextInput
            style={styles.input}
            placeholder="Enter your Business email"
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
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Confirm Password"
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


          {/* Business Details */}

          <Text style={styles.header}>Business Details</Text>

            <TextInput
            style={styles.input}
            placeholder="Business Type eg: Sole Proprietor, Partnership"
            placeholderTextColor={"gainsboro"}
            autoCorrect={false}
            value={name}
            onChangeText={setName}
            />
            <TextInput
            style={styles.input}
            placeholder="Owner's Full Name"
            />
             <TextInput
            style={styles.input}
            placeholder="Country of Operation"
            />
             <TextInput
            style={styles.input}
            placeholder="Business Address"
            />
             <TextInput
            style={styles.input}
            placeholder="Social Media eg: WhatsApp, Instagram etc "
            />

            {/* Product Information */}
            <Text style={styles.header}>Product Information</Text>

            <TextInput
            style={styles.input}
            placeholder=" Product Category eg: Fashion, Handcrafted goods etc"
            />


          <TouchableOpacity style={styles.button} onPress={handleBusinessVerification}>
          {loading ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.buttonText}> Next >>></Text>
          )}
          </TouchableOpacity>
        </ScrollView>
      </TouchableWithoutFeedback>
      <Toast />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#B7990D',
    padding: 16,
  },
  logoText: {
    fontSize: 25,
    color: '#000',
    fontWeight: 'bold',
  },
  header: {
    fontSize: 20,
    color: '#000',
    fontWeight: 'bold',
    marginTop: 20,
    marginLeft: -180,
    },
  title: {
    fontSize: 20,
    color: '#000',
    textAlign: 'center',
    marginBottom: 22,
  },
  input: {
    width: '100%',
    height: 40,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginVertical: 10,
    fontSize: 15,
    color: '#000',
  },
  button: {
    width: '100%',
    height: 48,
    backgroundColor: '#000',
    borderRadius: 30,
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
    color: '#000',
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
    height: 40,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 18,
    color: '#000',
  },
  phoneInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 95,
    marginVertical: 10,
    fontSize: 18,
    color: '#000',
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
    height: 40,
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
