// app/_layout.tsx

import React, { useEffect } from 'react';
import {
  View,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomNav from '../components/BottomNav'; 
import DriverBottomNav from '../components/DriverBottomNav'; // <--- 1. Import Driver Nav
import { usePathname } from 'expo-router';
import { CartProvider } from './context/CartContext';
import { ChatProvider } from './context/ChatContext';

// Prevent the splash screen from auto‐hiding before fonts load
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const pathname = usePathname();  
  const [loaded] = useFonts({
    'Montserrat-Regular': require('../assets/fonts/Montserrat-Regular.ttf'),
    'Montserrat-Bold': require('../assets/fonts/Montserrat-Bold.ttf'),
    'Montserrat-SemiBold': require('../assets/fonts/Montserrat-SemiBold.ttf'),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  const navTheme = colorScheme === 'dark' ? DarkTheme : DefaultTheme;
  const screenBg = colorScheme === 'dark' ? '#000000' : '#FFFFFF';

  // --- CUSTOMER NAV LOGIC ---
  const showNavRoutes = [
    '/home',
    '/stores',
    '/search',
    '/settings', 
    '/order',
  ];

  const hideNavRoutes = [
    '/settings/Account', 
    '/settings/changePassword', 
    '/settings/pushNotifications',
    '/settings/helpCenter',
    '/settings/contactUs',
    '/settings/Transactions',
    '/settings/paymentMethods',
    '/cart',
    '/chat/index',
    // We also want to hide the Customer BottomNav if we are on ANY driver page
    '/driver' 
  ];

  const shouldShowNav = 
    (showNavRoutes.some((base) => pathname.startsWith(base)) || pathname.startsWith('/categories'))
    && 
    !hideNavRoutes.some((exclude) => pathname.startsWith(exclude));


  // --- DRIVER NAV LOGIC ---
  // Check if we are currently in the driver section
  const isDriverRoute = pathname.startsWith('/driver');

  // Only show the Driver Bottom Nav on these specific main screens
  // We do NOT want it on 'activeOrder' so the map can take full screen
  const showDriverNav = [
    '/driver/dashboard',
    '/driver/earnings',
    '/driver/history',
    '/driver/settings',
  ].includes(pathname);


  return (
    <CartProvider>
      <ChatProvider>
    <ThemeProvider value={navTheme}>
      <View style={[styles.container, { backgroundColor: screenBg }]}>
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'none',
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="register" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="business/dashboard" options={{ headerShown: false }} />
            <Stack.Screen name="business/register" options={{ headerShown: false }} />
            <Stack.Screen name="business/inventory" options={{ headerShown: false }} />
            <Stack.Screen name="business/analytics" options={{ headerShown: false }} />
            <Stack.Screen name="notification" options={{ headerShown: false }} />
            <Stack.Screen name="userProfile" options={{ headerShown: false }} />
            <Stack.Screen name="home" options={{ headerShown: false }} />
            <Stack.Screen name="role" options={{ headerShown: false }} />
            <Stack.Screen name="search" options={{ headerShown: false }} />
            <Stack.Screen name="order" options={{ headerShown: false }} />
            <Stack.Screen name="settings" options={{ headerShown: false }} />
            
            {/* Driver Screens */}
            <Stack.Screen name="driver/dashboard" options={{ headerShown: false }} />
            <Stack.Screen name="driver/activeOrder" options={{ headerShown: false }} />
            <Stack.Screen name="driver/earnings" options={{ headerShown: false }} />
            <Stack.Screen name="driver/history" options={{ headerShown: false }} />
            <Stack.Screen name="driver/settings" options={{ headerShown: false }} />
            
            {/* Settings Sub-Screens */}
            <Stack.Screen name='settings/Account' options={{ headerShown: false }} />
            <Stack.Screen name='settings/changePassword' options={{ headerShown: false }} />
            <Stack.Screen name='settings/pushNotifications' options={{ headerShown: false }} />
            <Stack.Screen name='settings/helpCenter' options={{ headerShown: false }} />
            <Stack.Screen name='settings/contactUs' options={{ headerShown: false }} />
            <Stack.Screen name='settings/Transactions' options={{ headerShown: false }} />
            <Stack.Screen name='settings/paymentMethods' options={{ headerShown: false }} />
            
            <Stack.Screen name='cart' options={{ headerShown: false }} /> 
            <Stack.Screen name='chat/index' options={{ headerShown: false }} />
            <Stack.Screen name='chat/conversation' options={{ headerShown: false }} />
            <Stack.Screen
              name="business/verification"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="categories/categories"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="categories/[id]"
              options={{ headerShown: false }}
            />

            <Stack.Screen name="stores" options={{ headerShown: false }} />
            <Stack.Screen name="+not-found" />
          </Stack>

        {/* 3. Conditional Rendering based on Route Type */}
        
        {/* Render Customer Nav if applicable */}
        {shouldShowNav && <BottomNav />}

        {/* Render Driver Nav only if on Driver Main Routes */}
        {isDriverRoute && showDriverNav && <DriverBottomNav />}

        <StatusBar style="auto" />
      </View>
    </ThemeProvider>
    </ChatProvider>
  </CartProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  stackContainer: {
    flex: 1,
  },
});