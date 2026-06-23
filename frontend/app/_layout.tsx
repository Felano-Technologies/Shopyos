import React, { useEffect } from 'react';
import { View, Text, StyleSheet, useColorScheme, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, usePathname, useRouter } from 'expo-router';
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
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useAuthStore } from '@/store/authStore';
import { initCartForUser } from '@/store/cartStore';
import { storage } from '@/services/api';

// Import task definitions once (safe to import multiple times, but only define once)
import '../src/background/tasks';
import BusinessBottomNav from '@/components/BusinessBottomNav';
import { ImagePreviewProvider } from '@/context/ImagePreviewContext';
import ParcelPartnerBottomNav from '@/components/ParcelPartnerBottomNav';

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
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const activeMode = useAuthStore((s) => s.activeMode);
  const originalRole = useAuthStore((s) => s.originalRole);
  const exitBuyerMode = useAuthStore((s) => s.exitBuyerMode);

  const handleReturnFromBuyerMode = () => {
    exitBuyerMode();
    if (originalRole === 'driver') {
      router.replace('/driver/dashboard');
    } else if (originalRole === 'parcel_partner') {
      router.replace('/parcel-partner/dashboard');
    } else {
      router.replace('/business/dashboard');
    }
  };


  // Load the cart for the already-logged-in user on app startup
  useEffect(() => {
    storage.getItem('userId').then((uid) => {
      if (uid) initCartForUser(uid);
    }).catch(() => {});
  }, []);

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
    !pathname.startsWith('/driver') &&
    !pathname.startsWith('/parcel-partner');

  // --- DRIVER NAV LOGIC (hidden when actively browsing buyer routes in buyer mode) ---
  const isDriverRoute = pathname.startsWith('/driver');
  const showDriverNav = [
    '/driver/index',
    '/driver/dashboard',
    '/driver/earnings',
    '/driver/history',
    '/driver/settings',
  ].includes(pathname) && !(activeMode === 'buyer' && !isDriverRoute);

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
  ].includes(pathname) && !(activeMode === 'buyer' && !isBusinessRoute);

  // --- PARCEL PARTNER NAV LOGIC ---
  const isParcelPartnerRoute = pathname.startsWith('/parcel-partner');
  const showParcelPartnerNav = [
    '/parcel-partner/dashboard',
    '/parcel-partner/parcels',
    '/parcel-partner/scan',
    '/parcel-partner/notifications',
    '/parcel-partner/settings',
  ].includes(pathname) && !(activeMode === 'buyer' && !isParcelPartnerRoute);

  return (
    <ThemeProvider value={navTheme}>
          <View style={[styles.container, { backgroundColor: screenBg }]}>
            <Stack
              screenOptions={{
                headerShown: false,
                animation: 'slide_from_right',
              }}
            >

              {/* --- ADMIN SCREENS --- */}
              <Stack.Screen name="admin" options={{ animation: 'fade' }} />
              
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
              <Stack.Screen name="admin-login" options={{ animation: 'fade' }} />
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

              <Stack.Screen name="business/community" options={{ animation: 'fade' }} />
              <Stack.Screen name="business/bargains" options={{ animation: 'fade' }} />
              <Stack.Screen name="business/flash-sales" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="business/flash-sale-submit" options={{ animation: 'slide_from_right' }} />
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

              {/* --- PARCEL PARTNER SCREENS --- */}
              <Stack.Screen name="parcel-partner/dashboard" options={{ animation: 'none' }} />
              <Stack.Screen name="parcel-partner/parcels" options={{ animation: 'none' }} />
              <Stack.Screen name="parcel-partner/parcel-detail" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="parcel-partner/scan" options={{ animation: 'none' }} />
              <Stack.Screen name="parcel-partner/notifications" options={{ animation: 'none' }} />
              <Stack.Screen name="parcel-partner/settings" options={{ animation: 'none' }} />

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





              {/* --- BARGAIN SCREENS --- */}
              <Stack.Screen name="bargain/make-offer" options={{ animation: 'slide_from_bottom' }} />
              <Stack.Screen name="bargain/my-offers" options={{ animation: 'fade' }} />

              {/* --- FORCED PASSWORD RESET --- */}
              <Stack.Screen name="force-reset-password" options={{ animation: 'fade' }} />

              <Stack.Screen name="+not-found" />
            </Stack>

            {shouldShowNav && <BottomNav />}
            {isDriverRoute && showDriverNav && <DriverBottomNav />}
            {isBusinessRoute && showBusinessNav && <BusinessBottomNav />}
            {isParcelPartnerRoute && showParcelPartnerNav && <ParcelPartnerBottomNav />}

            <StatusBar style="auto" />
            <Toast config={toastConfig} topOffset={50} visibilityTime={4000} />
            <InAppToastHost />
            {activeMode === 'buyer' && (
              <TouchableOpacity
                style={[styles.buyerBanner, { top: insets.top }]}
                onPress={handleReturnFromBuyerMode}
                activeOpacity={0.85}
              >
                <Text style={styles.buyerBannerLabel}>Shopping as buyer</Text>
                <Text style={styles.buyerBannerReturn}>
                  Return to {originalRole === 'driver' ? 'Driver' : originalRole === 'parcel_partner' ? 'Parcel Partner' : 'Business'} Dashboard →
                </Text>
              </TouchableOpacity>
            )}
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
    <ErrorBoundary>
      <QueryProvider>
        <OnboardingProvider>
          <ImagePreviewProvider>
            <AppContent />
          </ImagePreviewProvider>
        </OnboardingProvider>
      </QueryProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  buyerBanner: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#0C1559',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    zIndex: 9999,
    elevation: 20,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
    }),
  },
  buyerBannerLabel: {
    color: '#A3E635',
    fontSize: 12,
    fontFamily: 'Montserrat-SemiBold',
  },
  buyerBannerReturn: {
    color: '#FFF',
    fontSize: 12,
    fontFamily: 'Montserrat-Medium',
  },
});