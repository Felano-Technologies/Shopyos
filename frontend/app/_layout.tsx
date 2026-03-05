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
import { QueryProvider } from '../components/QueryProvider';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useBackgroundTasks } from '../hooks/useBackgroundTasks';

// Import task definitions once (safe to import multiple times, but only define once)
import '../src/background/tasks';
import BusinessBottomNav from '@/components/BusinessBottomNav';

SplashScreen.preventAutoHideAsync();

// Inner component that uses hooks requiring QueryClient
function AppContent() {
  const colorScheme = useColorScheme();
  const pathname = usePathname();

  // --- DEBUG LOG ---
  // Check your terminal/metro bundler to see what this prints when you are on the verification page
  console.log("Current Path:", pathname);

  // Apply Push Hook globally
  usePushNotifications();

  // Apply Background Tasks Hook globally (manages driver location tracking)
  // This needs to be inside QueryProvider context
  useBackgroundTasks();

  const navTheme = colorScheme === 'dark' ? DarkTheme : DefaultTheme;
  const screenBg = colorScheme === 'dark' ? '#000000' : '#FFFFFF';

  // --- CUSTOMER NAV LOGIC ---
  const mainCustomerTabs = ['/home', '/stores', '/search', '/settings', '/order'];

  const shouldShowNav =
    (mainCustomerTabs.includes(pathname) || pathname.startsWith('/categories/categories')) &&
    !pathname.startsWith('/driver');

  // --- DRIVER NAV LOGIC ---
  const isDriverRoute = pathname.startsWith('/driver');
  const showDriverNav = [
    '/driver/index',
    '/driver/dashboard',
    '/driver/earnings',
    '/driver/history',
    '/driver/settings',
  ].includes(pathname);

  // --- BUSINESS NAV LOGIC (Updated to exclude verification) ---
  const isBusinessRoute = pathname.startsWith('/business');
  const showBusinessNav = [
    '/business/dashboard',
    '/business/inventory',
    '/business/analytics',
    '/business/orders',
    '/business/products',
    '/business/settings',
    '/business/notifications',
  ].includes(pathname); 

  return (
    <CartProvider>
      <ChatProvider>
        <ThemeProvider value={navTheme}>
            <View style={[styles.container, { backgroundColor: screenBg }]}>
              <Stack
                screenOptions={{
                  headerShown: false,
                  animation: 'slide_from_right',
                }}
              >
              {/* --- MAIN CUSTOMER SCREENS --- */}
              <Stack.Screen name="index" options={{ animation: 'fade' }} />
              <Stack.Screen name="home" options={{ animation: 'none' }} />
              <Stack.Screen name="search" options={{ animation: 'fade' }} />
              <Stack.Screen name="order" options={{ animation: 'none' }} />
              <Stack.Screen name="settings" options={{ animation: 'none' }} />
              <Stack.Screen name="stores" options={{ animation: 'none' }} />

              {/* --- PREMIUM ORDER ANIMATIONS --- */}
              <Stack.Screen
                name="order/[id]"
                options={{ animation: 'slide_from_right', gestureEnabled: true }}
              />
              <Stack.Screen
                name="order/tracking"
                options={{
                  presentation: 'modal',
                  animation: 'slide_from_bottom',
                  gestureEnabled: true
                }}
              />

              {/* --- AUTH & ROLE --- */}
              <Stack.Screen name="login" />
              <Stack.Screen name="register" options={{ animation: 'fade' }} />
              <Stack.Screen name="role" />
              <Stack.Screen name="userProfile" />
              <Stack.Screen name="notification" />
              <Stack.Screen name="forgotPassword" />
              <Stack.Screen name="resetPassword" />
              <Stack.Screen name="getstarted" />

              {/* --- BUSINESS SCREENS (FADE ADDED) --- */}
              <Stack.Screen name="business/dashboard" options={{ animation: 'fade' }} />
              <Stack.Screen name="business/inventory" options={{ animation: 'fade' }} />
              <Stack.Screen name="business/analytics" options={{ animation: 'fade' }} />
              <Stack.Screen name="business/orders" options={{ animation: 'fade' }} />
              <Stack.Screen name="business/products" options={{ animation: 'fade' }} />

              <Stack.Screen name="business/register" />
              <Stack.Screen name="business/verification" />
              <Stack.Screen name="business/verification-status" options={{ animation: 'fade' }} />
              <Stack.Screen name="business/notifications" />
              <Stack.Screen name="business/settings" />
              <Stack.Screen name="business/orderDetails" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="business/Registration" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="business/earnings" options={{ animation: 'slide_from_bottom' }} />

              {/* --- DRIVER SCREENS --- */}
              <Stack.Screen name="driver/index" />
              <Stack.Screen name="driver/dashboard" />
              <Stack.Screen name="driver/activeOrder" options={{ presentation: 'fullScreenModal' }} />
              <Stack.Screen name="driver/earnings" />
              <Stack.Screen name="driver/history" />
              <Stack.Screen name="driver/settings" />
              <Stack.Screen name="driver/verification" />

              {/* --- CATEGORIES & CHAT --- */}
              <Stack.Screen name="categories/categories" />
              <Stack.Screen name="categories/[id]" options={{ animation: 'fade_from_bottom' }} />
              <Stack.Screen name="chat/index" />
              <Stack.Screen name="chat/conversation" />
              <Stack.Screen name="cart" options={{ presentation: 'modal' }} />


              <Stack.Screen name="stores/details" />
              <Stack.Screen name="stores/map" />
              <Stack.Screen name="reviews/[id]" options={{ presentation: 'modal', animation: 'slide_from_bottom', headerShown: false }} />

              {/* --- SETTINGS SUB-SCREENS --- */}
              <Stack.Screen name='settings/Account' />
              <Stack.Screen name='settings/Transactions' />
              <Stack.Screen name='settings/changePassword' />
              <Stack.Screen name='settings/contactUs' />
              <Stack.Screen name='settings/helpCenter' />
              <Stack.Screen name='settings/paymentMethods' />
              <Stack.Screen name='settings/pushNotifications' />





              <Stack.Screen name="+not-found" />
            </Stack>

            {shouldShowNav && <BottomNav />}
            {isDriverRoute && showDriverNav && <DriverBottomNav />}
            {isBusinessRoute && showBusinessNav && <BusinessBottomNav />}

            <StatusBar style="auto" />
          </View>
        </ThemeProvider>
      </ChatProvider>
    </CartProvider>
  );
}

export default function RootLayout() {
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

  return (
    <QueryProvider>
      <AppContent />
    </QueryProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});