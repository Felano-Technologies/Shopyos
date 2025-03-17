import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity,Image } from 'react-native';
import { router } from 'expo-router';

const GetStartedScreen = () => {
  return (
    <View style={styles.container}>
      <Image style={styles.logoImage} source={require("../assets/images/icon.png")} />
      <Text style={styles.heading}>Advertise your Business with us</Text>
      <Text style={styles.description}>
        Sign up for a free account and advertise your Business!
      </Text>

      <TouchableOpacity style={styles.createAccountButton} onPress={() => router.push('/business_register')}>
        <Text style={styles.createAccountText}>Register Business</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.loginButton} onPress={() => router.push('/login')} >
        <Text style={styles.loginText}>Login</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#61A0AF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 300,
    height: 300,
    borderRadius: 75,
    marginBottom: 10,
  },
  heading: {
    fontSize: 24,
    fontWeight: '600',
    color: '#000',
    marginBottom: 16,
  },
  description: {
    fontSize: 14,
    color: '#000',
    textAlign: 'center',
    marginHorizontal: 40,
    marginBottom: 40,
  },
  signupText: {
    color: '000',
    marginTop: 20,
  },
  boldText: {
    fontWeight: 'bold',
  },
  createAccountButton: {
    backgroundColor: '#000',
    width: '80%',
    paddingVertical: 12,
    borderRadius: 30,
    alignItems: 'center',
    marginBottom: 20,
  },
  createAccountText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loginButton: {
    borderWidth: 1,
    borderColor: '#4D5061',
    width: '80%',
    paddingVertical: 12,
    borderRadius: 30,
    alignItems: 'center',
  },
  loginText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default GetStartedScreen;
