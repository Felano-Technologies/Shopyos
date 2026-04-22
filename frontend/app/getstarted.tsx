import { router } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Animated,
  Dimensions,
  ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
const { width } = Dimensions.get('window');
const GetStartedScreen = () => {
  const carouselRef = useRef<ScrollView>(null);
  const carouselImages = [
    require('../assets/images/slide1.jpg'),
    require('../assets/images/slide2.jpg'),
    require('../assets/images/slide3.jpg'),
  ];
  useEffect(() => {
    let currentIndex = 0;
    const timer = setInterval(() => {
      currentIndex = (currentIndex + 1) % carouselImages.length;
      if (carouselRef.current) {
        carouselRef.current.scrollTo({
          x: currentIndex * width * 0.85,
          animated: true,
        });
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [carouselImages.length]);
  return (
    
    <View style={styles.container}>
      <StatusBar style="dark" translucent backgroundColor="transparent" />
      {/* Welcome Text */}
      <Text style={styles.title}>Welcome to Shopyos</Text>
      {/* Carousel Section */}
      <Animated.ScrollView
        ref={carouselRef}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.carousel}
      >
        {carouselImages.map((img, index) => (
          <Image key={index} source={img} style={styles.carouselImage} />
        ))}
      </Animated.ScrollView>
      {/* Indicator Dots */}
      <View style={styles.dotsContainer}>
        {carouselImages.map((_, i) => (
          <View key={i} style={[styles.dot]} />
        ))}
      </View>
      <Text style={styles.subtitle}>
        Browse and shop products from local artisans and businesses. {'\n'}
        Get started in just a few taps!
      </Text>
      {/* Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => router.push('/register')}
        >
          <Text style={styles.createText}>Create Account</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.loginLink}
          onPress={() => router.push('/login')}
        >
          <Text style={styles.loginText}>Already have an account? Login</Text>
        </TouchableOpacity>
      </View>
      {/* Bottom Logo */}
      <View style={styles.bottomLogos}>
        <Image source={require('../assets/images/icon.png')} style={styles.circleLogo} />
        <Image source={require('../assets/images/icondark.png')} style={styles.brandLogo} />
        </View>
      </View>
  );
};
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e9f0ff',
    alignItems: 'center',
  },
  carousel: {
    marginTop: 50,
  },
  carouselImage: {
    width: width * 0.85,
    height: 140,
    borderRadius: 14,
    resizeMode: 'cover',
    marginHorizontal: 10,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 13,
    marginBottom: 50,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#84cc16',
    marginHorizontal: 3,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginTop: 90,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#444',
    textAlign: 'center',
    marginTop: 70,
    marginBottom: 20,
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  buttonContainer: {
    width: '90%',
    marginTop: 30,
    borderRadius: 25,
  },
  createButton: {
    backgroundColor: '#84cc16',
    borderRadius: 25,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 10,
  },
  createText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  loginLink: {
    borderWidth: 1,
    borderColor: '#84cc16',
    borderRadius: 25,
    paddingVertical: 14,
    alignItems: 'center',
  },
  loginText: {
    color: '#1e3a8a',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomLogoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 40,
  },
  bottomLogo: {
    width: 90,
    height: 70,
    marginTop: 30,
  },
    bottomLogos: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '90%',
    marginTop: 25,
  },
  circleLogo: {
    width: 130,
    height: 130,
    resizeMode: 'contain',
    marginLeft: -40,
  },
  brandLogo: {
    width: 90,
    height: 30,
    resizeMode: 'contain',
  },
  bottomBrand: {
    color: '#1e3a8a',
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 6,
  },
});
export default GetStartedScreen;