import React, { useEffect, useCallback, useMemo } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import AppImage from '@/components/AppImage';
import { useRouter, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { getDriverProfile } from '@/services/api';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';
export default function DriverGatekeeper() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
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
      <StatusBar style="light" backgroundColor={colors.primary} />

      <View style={styles.content}>
        <AppImage
          source={require('../../assets/images/splash-icon.png')}
          style={styles.logo}
          contentFit="contain"
        />
        <ActivityIndicator size="large" color={colors.accent} style={styles.loader} />
        <Text style={styles.text}>Verifying Driver Profile...</Text>
      </View>
    </View>
  );
}
const getStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.primary,
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
    color: c.textInverse, // inverse of primary bg, stays readable in both themes
    fontFamily: 'Montserrat-Medium',
    fontSize: 16,
  }
});