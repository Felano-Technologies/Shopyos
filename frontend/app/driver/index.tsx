import React, { useEffect, useState, useCallback } from 'react';
import { View, ActivityIndicator, StyleSheet, Image, Text } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { getDriverProfile } from '@/services/api';
export default function DriverGatekeeper() {
  const router = useRouter();
  const checkStatus = useCallback(async () => {
    try {
      const response = await getDriverProfile();
      const driver = response?.profile || response?.data || response;
      // If driver record exists (even if not verified), let them see their dashboard.
      // The dashboard's useDriverGuard will handle specific restrictions if they are pending.
      if (driver) {
        router.replace('/driver/dashboard');
      } else {
        router.replace({
          pathname: '/driver/verification',
          params: { status: 'new' }
        });
      }
    } catch {
      // If profile not found, it's a new driver
      router.replace({
        pathname: '/driver/verification',
        params: { status: 'new' }
      });
    }
  }, [router]);
  useEffect(() => {
    checkStatus();
  }, [checkStatus]);
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