import React, { useEffect } from 'react';
import { View, StyleSheet, useColorScheme } from 'react-native';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import BottomNav from '../components/BottomNav'; 
import DriverBottomNav from '../components/DriverBottomNav'; 
import { CartProvider } from './context/CartContext';
import { ChatProvider } from './context/ChatContext';

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

  if (!loaded) return null;

  const navTheme = colorScheme === 'dark' ? DarkTheme : DefaultTheme;
  const screenBg = colorScheme === 'dark' ? '#000000' : '#FFFFFF';

  // --- NAVIGATION LOGIC ---
  const mainCustomerTabs = ['/home', '/stores', '/search', '/settings', '/order'];
  const shouldShowNav = mainCustomerTabs.includes(pathname) || pathname.startsWith('/categories');

  const isDriverRoute = pathname.startsWith('/driver');
  const showDriverNav = ['/driver/dashboard', '/driver/earnings', '/driver/history', '/driver/settings'].includes(pathname);

  return (
    <CartProvider>
      <ChatProvider>
        <ThemeProvider value={navTheme}>
          <View style={[styles.container, { backgroundColor: screenBg }]}>
            <Stack
              screenOptions={{
                headerShown: false,
                animation: 'slide_from_right', // Default animation for most screens
              }}
            >
              {/* --- FADE ANIMATIONS FOR SEARCH & CATEGORIES --- */}
              <Stack.Screen 
                name="search" 
                options={{ animation: 'fade' }} 
              />
              <Stack.Screen 
                name="categories/[id]" 
                options={{ animation: 'fade_from_bottom' }} 
              />

              {/* --- PREMIUM MODAL FOR TRACKING --- */}
              <Stack.Screen 
                name="order/tracking" 
                options={{ 
                  presentation: 'modal', 
                  animation: 'slide_from_bottom',
                  gestureEnabled: true 
                }} 
              />

              {/* --- STANDARD SLIDE FOR DETAILS --- */}
              <Stack.Screen 
                name="order/[id]" 
                options={{ 
                  animation: 'slide_from_right',
                  gestureEnabled: true 
                }} 
              />

              {/* Main Screens */}
              <Stack.Screen name="index" />
              <Stack.Screen name="home" />
              <Stack.Screen name="order" />
              <Stack.Screen name="settings" />
              <Stack.Screen name="stores" />
              
              {/* Driver & Other */}
              <Stack.Screen name="driver/index" />
              <Stack.Screen name="login" options={{ animation: 'fade' }} />
            </Stack>

            {shouldShowNav && <BottomNav />}
            {isDriverRoute && showDriverNav && <DriverBottomNav />}

            <StatusBar style="auto" />
          </View>
        </ThemeProvider>
      </ChatProvider>
    </CartProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});