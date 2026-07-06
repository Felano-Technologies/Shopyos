// app/admin/_layout.tsx
// Persistent tab layout for the Admin area.
// Using Expo Router's Tabs keeps each screen mounted so navigating between
// tabs does NOT trigger a full re-render / data reload — the state is preserved.

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Tabs, usePathname, useRouter } from 'expo-router';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { adminColors, adminShadow, useAdminBreakpoint } from '@/components/admin/adminTheme';
import { getUserData } from '@/services/auth';

const NAV_ITEMS = [
  { label: 'Home',       route: '/admin/dashboard',     icon: 'grid'          as const },
  { label: 'Orders',     route: '/admin/orders',        icon: 'shopping-bag'  as const },
  { label: 'Users',      route: '/admin/users',         icon: 'users'         as const },
  { label: 'Broadcasts', route: '/admin/broadcasts', icon: 'bell'          as const },
  { label: 'Settings',   route: '/admin/settings',      icon: 'settings'      as const },
];

function hasAdminRole(user: any): boolean {
  const role = String(user?.role ?? user?.account_type ?? '').toLowerCase();
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  return role === 'admin' || roles.some((item: any) => {
    if (typeof item === 'string') return item.toLowerCase() === 'admin';
    return String(item?.name ?? item?.role ?? '').toLowerCase() === 'admin';
  });
}

function AdminTabBar(props: BottomTabBarProps) {
  const router   = useRouter();
  const pathname = usePathname();
  const insets   = useSafeAreaInsets();
  const { isTablet, isDesktop } = useAdminBreakpoint();

  // Desktop uses the sidebar inside AdminShell — no floating bar needed
  if (isDesktop) return null;

  const bottomOffset = Platform.OS === 'ios' ? Math.max(insets.bottom, 8) : 12;

  return (
    <View
      style={[
        styles.tabBar,
        isTablet && styles.tabBarTablet,
        { bottom: bottomOffset },
      ]}
    >
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.route || pathname.startsWith(item.route + '/');
        return (
          <TouchableOpacity
            key={item.route}
            onPress={() => router.navigate(item.route as any)}
            style={[styles.tab, active && styles.tabActive]}
            activeOpacity={0.8}
          >
            {active ? (
              <LinearGradient
                colors={[adminColors.navy, adminColors.navyMid]}
                style={StyleSheet.absoluteFillObject}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
            ) : null}
            <Feather
              name={item.icon}
              size={isTablet ? 20 : 18}
              color={active ? '#FFFFFF' : adminColors.textSoft}
            />
            <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function AdminLayout() {
  const router = useRouter();
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);

  useEffect(() => {
    let active = true;

    const checkAccess = async () => {
      try {
        const user = await getUserData();
        if (!active) return;
        if (!hasAdminRole(user)) {
          router.replace('/home');
          return;
        }
        setIsCheckingAccess(false);
      } catch {
        if (active) router.replace('/login');
      }
    };

    checkAccess();

    return () => {
      active = false;
    };
  }, [router]);

  if (isCheckingAccess) {
    return (
      <View style={styles.accessCheck}>
        <ActivityIndicator size="large" color={adminColors.navy} />
      </View>
    );
  }

  return (
    <Tabs
    tabBar={(props) => <AdminTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
        <Tabs.Screen name="dashboard" />
        <Tabs.Screen name="orders" />
        <Tabs.Screen name="users" />
        <Tabs.Screen name="settings" />
        {/* Sub-pages: hide from tab bar but keep under /admin layout */}
        <Tabs.Screen name="revenue"             options={{ href: null }} />
        <Tabs.Screen name="audit-logs"          options={{ href: null }} />
        <Tabs.Screen name="categories"          options={{ href: null }} />
        <Tabs.Screen name="ads"                 options={{ href: null }} />
        <Tabs.Screen name="stores"              options={{ href: null }} />
        <Tabs.Screen name="user-buyers"         options={{ href: null }} />
        <Tabs.Screen name="driverVerifications" options={{ href: null }} />
        <Tabs.Screen name="driver-verifications/[id]" options={{ href: null }} />
        <Tabs.Screen name="store-details/[id]"       options={{ href: null }} />
        <Tabs.Screen name="driver-chat/[id]"         options={{ href: null }} />
        <Tabs.Screen name="driver-chat/index"         options={{ href: null }} />
        <Tabs.Screen name="notifications"        options={{ href: null }} />
      </Tabs>
  );
}

const styles = StyleSheet.create({
  accessCheck: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: adminColors.surface,
  },
  tabBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderRadius: 28,
    padding: 5,
    borderWidth: 1,
    borderColor: 'rgba(215,227,255,0.8)',
    overflow: 'hidden',
    ...adminShadow,
    // Slightly elevate above content
    zIndex: 100,
  },
  tabBarTablet: {
    left: 24,
    right: 24,
    borderRadius: 32,
    padding: 6,
  },
  tab: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderRadius: 22,
    overflow: 'hidden',
  },
  tabActive: {
    backgroundColor: adminColors.navy,
  },
  tabLabel: {
    color: adminColors.textSoft,
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 9,
    letterSpacing: 0.2,
  },
  tabLabelActive: {
    color: '#FFFFFF',
  },
});
