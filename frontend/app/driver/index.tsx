import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Image, Text } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

// Mock Auth Service (Replace with your actual API context)
const mockCheckDriverStatus = async () => {
  return new Promise<'verified' | 'pending' | 'new'>((resolve) => {
    setTimeout(() => {
      // CHANGE THIS VALUE TO TEST DIFFERENT STATES:
      // 'new'      -> Shows Verification Form
      // 'pending'  -> Shows "Under Review" Screen
      // 'verified' -> Redirects to Dashboard
      resolve('new'); 
    }, 1500);
  });
};

export default function DriverGatekeeper() {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    const driverStatus = await mockCheckDriverStatus();
    
    if (driverStatus === 'verified') {
      router.replace('/driver/dashboard');
    } else {
      // Pass the status param so Verification screen knows whether to show Form or Pending screen
      router.replace({
        pathname: '/driver/verification',
        params: { status: driverStatus }
      });
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" backgroundColor="#0C1559" />
      
      <View style={styles.content}>
        <Image 
          source={require('../../assets/images/splash-icon.png')} // Ensure this path is correct
          style={styles.logo}
          resizeMode="contain"
        />
        <ActivityIndicator size="large" color="#A3E635" style={styles.loader} />
        <Text style={styles.text}>Verifying Driver Profile...</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0C1559',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 40,
    opacity: 0.9,
  },
  loader: {
    marginBottom: 20,
  },
  text: {
    color: '#FFF',
    fontFamily: 'Montserrat-Medium',
    fontSize: 16,
  }
});