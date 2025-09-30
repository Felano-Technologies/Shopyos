import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Appearance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

const GetStartedScreen = () => {
  const colorScheme = Appearance.getColorScheme();
  const isDarkMode = colorScheme === 'dark';

  return (
    <LinearGradient
      colors={isDarkMode ? ['#020b4d', '#1a237e'] : ['#020b4d', '#1a237e']}
      style={styles.gradient}
    >
      <StatusBar style="light" translucent backgroundColor="transparent" />
      <SafeAreaView style={styles.safeArea} edges={['right', 'bottom', 'left']}>
        
        {/* Header Section */}
        <View style={styles.header}>
          <Image 
            style={styles.logoImage} 
            source={require("../assets/images/icondark.png")} 
            resizeMode="contain"
          />
        </View>

        {/* Main Content */}
        <View style={styles.content}>
          {/* Hero Text */}
          <View style={styles.heroSection}>
            <Text style={styles.heading}>Welcome to Shopyos</Text>
            <Text style={styles.subHeading}>Let's get started</Text>
            <Text style={styles.description}>
              Join thousands of shoppers and discover amazing products. 
              Create your free account today!
            </Text>
          </View>

          {/* Features Icons */}
          <View style={styles.featuresContainer}>
            <View style={styles.featureItem}>
              <View style={styles.featureIcon}>
                <Text style={styles.featureEmoji}>🛒</Text>
              </View>
              <Text style={styles.featureText}>Easy Shopping</Text>
            </View>
            <View style={styles.featureItem}>
              <View style={styles.featureIcon}>
                <Text style={styles.featureEmoji}>🚚</Text>
              </View>
              <Text style={styles.featureText}>Fast Delivery</Text>
            </View>
            <View style={styles.featureItem}>
              <View style={styles.featureIcon}>
                <Text style={styles.featureEmoji}>🔒</Text>
              </View>
              <Text style={styles.featureText}>Secure Payments</Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.footer}>
          <TouchableOpacity 
            style={styles.createAccountButton} 
            onPress={() => router.push('/register')}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#1b7c22', '#34a853']}
              style={styles.gradientButton}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.createAccountText}>Create Account</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.loginButton} 
            onPress={() => router.push('/login')}
            activeOpacity={0.7}
          >
            <Text style={styles.loginText}>Already have an account? Login</Text>
          </TouchableOpacity>

          {/* Business Option */}
          {/* <TouchableOpacity 
            style={styles.businessButton}
            onPress={() => router.push('/business/business_index')}
          >
            <Text style={styles.businessText}>
              Are you a business owner? <Text style={styles.businessHighlight}>Get Started Here</Text>
            </Text>
          </TouchableOpacity> */}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingTop: height * 0.02,
    paddingBottom: height * 0.02,
    marginTop: 60,
  },
  logoImage: {
    width: width * 0.6,
    height: 70,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  heading: {
    fontSize: 32,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subHeading: {
    fontSize: 18,
    fontWeight: '500',
    color: '#a8b1ff',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: '#e8eaf6',
    textAlign: 'center',
    lineHeight: 22,
    marginHorizontal: 20,
  },
  featuresContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 30,
  },
  featureItem: {
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 8,
  },
  featureIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureEmoji: {
    fontSize: 24,
  },
  featureText: {
    fontSize: 12,
    color: '#ffffff',
    textAlign: 'center',
    fontWeight: '500',
  },
  footer: {
    paddingHorizontal: 30,
    paddingBottom: 40,
    paddingTop: 20,
  },
  createAccountButton: {
    width: '100%',
    borderRadius: 25,
    marginBottom: 16,
    shadowColor: '#1b7c22',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  gradientButton: {
    paddingVertical: 16,
    borderRadius: 25,
    alignItems: 'center',
  },
  createAccountText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  loginButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 25,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    marginBottom: 12,
  },
  loginText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  businessButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  businessText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    textAlign: 'center',
  },
  businessHighlight: {
    color: '#4caf50',
    fontWeight: '600',
  },
});

export default GetStartedScreen;