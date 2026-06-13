import React, { useEffect } from 'react';
import { View, StyleSheet, useColorScheme } from 'react-native';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, usePathname } from 'expo-router';
import { FontFamily, FontSize } from '@/constants/Typography';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import BottomNav from '../components/BottomNav';
import DriverBottomNav from '../components/DriverBottomNav';
import { QueryProvider } from '../components/QueryProvider';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useBackgroundTasks } from '../hooks/useBackgroundTasks';
import { useUnreadNotificationCount } from '../hooks/useNotifications';
import { useSocketSetup } from '../hooks/useSocketSetup';
import Toast, { BaseToast, ErrorToast } from 'react-native-toast-message';
import { InAppToastHost } from '../components/InAppToastHost';
import { OnboardingProvider } from '@/context/OnboardingContext';

// Import task definitions once (safe to import multiple times, but only define once)
import '../src/background/tasks';
import BusinessBottomNav from '@/components/BusinessBottomNav';
import { ImagePreviewProvider } from '@/context/ImagePreviewContext';

SplashScreen.preventAutoHideAsync().catch(() => {});

const toastText1 = { fontSize: FontSize.md, fontFamily: FontFamily.bold, color: '#0F172A' };
const toastText2 = { fontSize: FontSize.sm, fontFamily: FontFamily.regular, color: '#64748B' };

const toastConfig = {
  success: (props: any) => (
    <BaseToast
      {...props}
      style={{ borderLeftColor: '#84cc16', backgroundColor: '#FFF', borderRadius: 12 }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={toastText1}
      text2Style={toastText2}
    />
  ),
  error: (props: any) => (
    <ErrorToast
      {...props}
      style={{ borderLeftColor: '#EF4444', backgroundColor: '#FFF', borderRadius: 12 }}
      text1Style={toastText1}
      text2Style={toastText2}
    />
  ),
  info: (props: any) => (
    <BaseToast
      {...props}
      style={{ borderLeftColor: '#0C1559', backgroundColor: '#FFF', borderRadius: 12 }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={toastText1}
      text2Style={toastText2}
    />
  )
};

function getScreenBg(colorScheme: string | null | undefined, isIndexRoute: boolean, isHomeRoute: boolean): string {
  if (colorScheme === 'dark') return '#000000';
  if (isIndexRoute) return '#061f65';
  if (isHomeRoute) return '#E9F0FF';
  return '#FFFFFF';
}

// Inner component that uses hooks requiring QueryClient
function AppContent() {
  const colorScheme = useColorScheme();
  const pathname = usePathname();


  // Apply Push Hook globally
  usePushNotifications();

  // Apply Background Tasks Hook globally (manages driver location tracking)
  // This needs to be inside QueryProvider context
  useBackgroundTasks();

  // Listen for socket events and show root-level Toast popups globally
  useUnreadNotificationCount();

  // Connect socket and load currentUserId into Zustand (replaces ChatProvider)
  useSocketSetup();

  const navTheme = colorScheme === 'dark' ? DarkTheme : DefaultTheme;
  const isIndexRoute = pathname === '/' || pathname === '/index';
  const isHomeRoute = pathname === '/home';
  const screenBg = getScreenBg(colorScheme, isIndexRoute, isHomeRoute);

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
    <ThemeProvider value={navTheme}>
          <View style={[styles.container, { backgroundColor: screenBg }]}>
            <Stack
              screenOptions={{
                headerShown: false,
                animation: 'slide_from_right',
              }}
            >
              {/* --- MAIN CUSTOMER SCREENS --- */}
              <Stack.Screen name="index" options={{ animation: 'fade', contentStyle: { backgroundColor: '#061f65' } }} />
              <Stack.Screen name="home" options={{ animation: 'none', contentStyle: { backgroundColor: '#E9F0FF' } }} />
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
              <Stack.Screen name="business/businessRegistration" options={{ animation: 'slide_from_right' }} />
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
              <Stack.Screen name="cart" options={{ animation: 'slide_from_bottom' }} />
              <Stack.Screen name="checkout" options={{ animation: 'slide_from_right' }} />


              <Stack.Screen name="stores/details" />
              {/* stores/map and reviews/[id] removed — no matching files exist; add back when files are created */}

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
            <Toast config={toastConfig} topOffset={50} visibilityTime={4000} />
            <InAppToastHost />
          </View>
        </ThemeProvider>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    'Montserrat-Regular': require('../assets/fonts/Montserrat-Regular.ttf'),
    'Montserrat-SemiBold': require('../assets/fonts/Montserrat-SemiBold.ttf'),
    'Montserrat-Bold': require('../assets/fonts/Montserrat-Bold.ttf'),
    'Montserrat-Black': require('../assets/fonts/Montserrat-Black.ttf'),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [loaded]);

  if (!loaded) return null;

  return (
    <QueryProvider>
      <OnboardingProvider>
        <ImagePreviewProvider>
          <AppContent />
        </ImagePreviewProvider>
      </OnboardingProvider>
    </QueryProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});