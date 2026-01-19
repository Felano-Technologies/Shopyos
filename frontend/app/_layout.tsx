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
import BottomNav from '../components/BottomNav'; // Adjust the path as necessary
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

  // Pick React Navigation theme
  const navTheme = colorScheme === 'dark' ? DarkTheme : DefaultTheme;
  // Force a pure screen background
  const screenBg = colorScheme === 'dark' ? '#000000' : '#FFFFFF';

  //
  // 1) Define exactly which “base” routes should show the BottomNav.
  //    We’ll show the bar on:
  //      • /home
  //      • /stores
  //      • /cart
  //      • /search
  //      • /settings
  //      • /order
  //      • any /categories* route (list + detail)
  //
  // 2) Use startsWith so that "/categories/c1" (dynamic) still counts.
  //
  const showNavRoutes = [
    '/home',
    '/stores',
    '/search',
    '/settings',
    '/order',
  ];

  // Check if current path starts with any of our “show” patterns
  const shouldShowNav = showNavRoutes.some((base) => 
    pathname.startsWith(base)
    ) || pathname.startsWith('/categories');

  return (
    <CartProvider>
      <ChatProvider>
    <ThemeProvider value={navTheme}>
      {/* 3) Root container uses a plain View so content can go edge-to-edge */}
      <View style={[styles.container, { backgroundColor: screenBg }]}>
        {/* Only respect top notch/status bar safe area */}
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
            <Stack.Screen name='settings/changePassword' options={{ headerShown: false }} />
            <Stack.Screen name='settings/pushNotifications' options={{ headerShown: false }} />
            <Stack.Screen name='settings/helpCenter' options={{ headerShown: false }} />
            <Stack.Screen name='settings/contactUs' options={{ headerShown: false }} />
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

        {/* 4) Render BottomNav only on allowed routes */}
        {shouldShowNav && <BottomNav />}

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
  // No bottom padding—content can extend fully under a floating BottomNav
  stackContainer: {
    flex: 1,
  },
});
