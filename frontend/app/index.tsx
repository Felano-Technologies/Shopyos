import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity,Image } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Appearance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const GetStartedScreen = () => {
  const colorScheme = Appearance.getColorScheme();
  const isDarkMode = colorScheme === 'dark';

  return (
        <LinearGradient
      colors={isDarkMode ? ['#020b4dff', '#020b4dff'] : ['#020b4dff', '#020b4dff']}
      style={{ flex: 1 }}
    >
      <StatusBar style={isDarkMode ? 'light' : 'dark'} translucent backgroundColor="transparent" />
      <SafeAreaView style={{flex: 1}} edges={['right', 'bottom', 'left']}>
    <View style={styles.container}>
      <Image style={styles.logoImage} source={require("../assets/images/icondark.png")} />
      <Text style={styles.heading}>Let’s get started</Text>
      <Text style={styles.description}>
        Sign up for a free account and start shopping with Shopyos!
      </Text>

      <TouchableOpacity style={styles.createAccountButton} onPress={() => router.push('/register')}>
        <Text style={styles.createAccountText}>Create Account</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.loginButton} onPress={() => router.push('/login')} >
        <Text style={styles.loginText}>Login</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push('/business/business_index')}>
      <Text style={styles.signupText}>To Sign Up as a Business owner/Artisan,<Text style={styles.boldText}>Click Here!</Text></Text>
      </TouchableOpacity>
    </View>
    </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 250,
    height: 62,
    borderRadius: 1,
    marginBottom: 10,
  },
  heading: {
    fontSize: 24,
    fontWeight: '600',
    color: '#ffffffff',
    marginBottom: 16,
  },
  description: {
    fontSize: 14,
    color: '#ffffffff',
    textAlign: 'center',
    marginHorizontal: 40,
    marginBottom: 40,
  },
  signupText: {
    color: '#fff',
    marginTop: 20,
  },
  boldText: {
    fontWeight: 'bold',
    color: '#1b7c22ff',
  },
  createAccountButton: {
    backgroundColor: '#1b7c22ff',
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
    borderColor: '#1b7c22ff',
    width: '80%',
    paddingVertical: 12,
    borderRadius: 30,
    alignItems: 'center',
  },
  loginText: {
    color: '#ffffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default GetStartedScreen;
