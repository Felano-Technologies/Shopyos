// app/admin/_layout.tsx
// 4-tab admin layout. Bottom tabs on mobile; sidebar on tablet/desktop.

import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Tabs, usePathname, useRouter } from 'expo-router';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { adminColors, adminShadow, useAdminBreakpoint } from '@/components/admin/adminTheme';
import AdminSidebar from '@/components/admin/AdminSidebar';

// ─── 4-tab navigation ────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { label: 'Home',     route: '/admin/dashboard', icon: 'grid'        as const },
  { label: 'Commerce', route: '/admin/orders',    icon: 'shopping-bag' as const },
  { label: 'People',   route: '/admin/users',     icon: 'users'        as const },
  { label: 'Control',  route: '/admin/settings',  icon: 'sliders'      as const },
];

function AdminTabBar(props: BottomTabBarProps) {
  const router   = useRouter();
  const pathname = usePathname();
  const insets   = useSafeAreaInsets();
  const { isTablet, isDesktop } = useAdminBreakpoint();

  // Sidebar handles navigation on tablet/desktop
  if (isDesktop || isTablet) return null;

  const bottomOffset = Platform.OS === 'ios' ? Math.max(insets.bottom, 8) : 12;

  return (
    <View style={[styles.tabBar, { bottom: bottomOffset }]}>
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
              size={18}
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
  const { isDesktop, isTablet } = useAdminBreakpoint();
  const showSidebar = isDesktop || isTablet;

  return (
    <View style={{ flex: 1, flexDirection: showSidebar ? 'row' : 'column' }}>
      {showSidebar && <AdminSidebar />}
      <View style={{ flex: 1 }}>
        <Tabs
          tabBar={(props) => <AdminTabBar {...props} />}
          screenOptions={{ headerShown: false }}
        >
          {/* Primary tabs */}
          <Tabs.Screen name="dashboard" />
          <Tabs.Screen name="orders" />
          <Tabs.Screen name="users" />
          <Tabs.Screen name="settings" />

          {/* Commerce sub-pages */}
          <Tabs.Screen name="stores"              options={{ href: null }} />
          <Tabs.Screen name="store-details/[id]"  options={{ href: null }} />
          <Tabs.Screen name="revenue"             options={{ href: null }} />
          <Tabs.Screen name="deliveries"          options={{ href: null }} />
          <Tabs.Screen name="product-form"        options={{ href: null }} />

          {/* People sub-pages */}
          <Tabs.Screen name="approvals"           options={{ href: null }} />
          <Tabs.Screen name="user-buyers"         options={{ href: null }} />
          <Tabs.Screen name="user-sellers"        options={{ href: null }} />
          <Tabs.Screen name="driverVerifications" options={{ href: null }} />
          <Tabs.Screen name="driver-verifications/[id]" options={{ href: null }} />
          <Tabs.Screen name="create-user"         options={{ href: null }} />
          <Tabs.Screen name="create-business"     options={{ href: null }} />
          <Tabs.Screen name="create-driver"       options={{ href: null }} />

          {/* Control sub-pages */}
          <Tabs.Screen name="broadcasts"          options={{ href: null }} />
          <Tabs.Screen name="audit-logs"          options={{ href: null }} />
          <Tabs.Screen name="categories"          options={{ href: null }} />
          <Tabs.Screen name="ads"                 options={{ href: null }} />

          {/* Misc sub-pages */}
          <Tabs.Screen name="driver-chat/[id]"    options={{ href: null }} />
          <Tabs.Screen name="driver-chat/index"   options={{ href: null }} />
          <Tabs.Screen name="notifications"       options={{ href: null }} />
        </Tabs>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    zIndex: 100,
    ...adminShadow,
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
