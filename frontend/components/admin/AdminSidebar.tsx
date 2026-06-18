// components/admin/AdminSidebar.tsx
// Sidebar navigation for tablet (icon-only, 64px) and desktop (expanded, 240px).

import React, { useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { adminColors, useAdminBreakpoint } from './adminTheme';

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

interface SubItem {
  label: string;
  route: string;
  badge?: number;
}

interface Section {
  key: string;
  label: string;
  icon: FeatherIconName;
  route: string;
  sub: SubItem[];
}

const SECTIONS: Section[] = [
  {
    key: 'home',
    label: 'Home',
    icon: 'grid',
    route: '/admin/dashboard',
    sub: [],
  },
  {
    key: 'commerce',
    label: 'Commerce',
    icon: 'shopping-bag',
    route: '/admin/orders',
    sub: [
      { label: 'Stores',      route: '/admin/stores' },
      { label: 'Orders',      route: '/admin/orders' },
      { label: 'Deliveries',  route: '/admin/deliveries' },
      { label: 'Revenue',     route: '/admin/revenue' },
    ],
  },
  {
    key: 'people',
    label: 'People',
    icon: 'users',
    route: '/admin/users',
    sub: [
      { label: 'Users',        route: '/admin/users' },
      { label: 'Approvals',    route: '/admin/approvals' },
      { label: 'Drivers',      route: '/admin/driverVerifications' },
      { label: 'Reports',      route: '/admin/ads' },
    ],
  },
  {
    key: 'control',
    label: 'Control',
    icon: 'sliders',
    route: '/admin/settings',
    sub: [
      { label: 'Broadcasts',  route: '/admin/broadcasts' },
      { label: 'Audit Logs',  route: '/admin/audit-logs' },
      { label: 'Categories',  route: '/admin/categories' },
      { label: 'Ads',         route: '/admin/ads' },
      { label: 'Settings',    route: '/admin/settings' },
    ],
  },
];

export default function AdminSidebar() {
  const pathname  = usePathname();
  const router    = useRouter();
  const insets    = useSafeAreaInsets();
  const { isDesktop } = useAdminBreakpoint();

  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    commerce: true,
    people: true,
    control: true,
  });

  const sidebarWidth = isDesktop ? 240 : 64;

  const isActive = (route: string) =>
    pathname === route || pathname.startsWith(route + '/');

  const toggle = (key: string) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <View
      style={[
        styles.sidebar,
        { width: sidebarWidth, paddingTop: insets.top + 16 },
      ]}
    >
      {/* Branding */}
      <View style={styles.brand}>
        <View style={styles.logoBox}>
          <Feather name="zap" size={18} color={adminColors.lime} />
        </View>
        {isDesktop && (
          <Text style={styles.brandText}>Shopyos</Text>
        )}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        {SECTIONS.map((section) => {
          const sectionActive = isActive(section.route) ||
            section.sub.some((s) => isActive(s.route));
          const isExpanded = expanded[section.key];

          return (
            <View key={section.key}>
              {/* Section header row */}
              <TouchableOpacity
                style={[styles.sectionRow, sectionActive && styles.sectionRowActive]}
                onPress={() => {
                  if (section.sub.length === 0) {
                    router.navigate(section.route as any);
                  } else if (isDesktop) {
                    toggle(section.key);
                  } else {
                    router.navigate(section.route as any);
                  }
                }}
                activeOpacity={0.75}
              >
                <View style={[styles.iconWrap, sectionActive && styles.iconWrapActive]}>
                  <Feather
                    name={section.icon}
                    size={18}
                    color={sectionActive ? adminColors.lime : '#94A3B8'}
                  />
                </View>
                {isDesktop && (
                  <>
                    <Text style={[styles.sectionLabel, sectionActive && styles.sectionLabelActive]}>
                      {section.label}
                    </Text>
                    {section.sub.length > 0 && (
                      <Feather
                        name={isExpanded ? 'chevron-down' : 'chevron-right'}
                        size={14}
                        color="#64748B"
                        style={{ marginLeft: 'auto' }}
                      />
                    )}
                  </>
                )}
              </TouchableOpacity>

              {/* Sub-items (desktop only) */}
              {isDesktop && section.sub.length > 0 && isExpanded &&
                section.sub.map((sub) => {
                  const subActive = isActive(sub.route);
                  return (
                    <TouchableOpacity
                      key={sub.route}
                      style={[styles.subRow, subActive && styles.subRowActive]}
                      onPress={() => router.navigate(sub.route as any)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.subLabel, subActive && styles.subLabelActive]}>
                        {sub.label}
                      </Text>
                      {sub.badge != null && sub.badge > 0 && (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>{sub.badge}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
            </View>
          );
        })}
      </ScrollView>

      {/* User footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        {isDesktop && (
          <View style={styles.userRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>A</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.userName} numberOfLines={1}>Admin</Text>
              <Text style={styles.userEmail} numberOfLines={1}>Admin Portal</Text>
            </View>
          </View>
        )}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => router.replace('/login' as any)}
          activeOpacity={0.75}
        >
          <Feather name="log-out" size={16} color="#EF4444" />
          {isDesktop && <Text style={styles.logoutText}>Sign Out</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    backgroundColor: adminColors.navyDeep,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.06)',
    flexDirection: 'column',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
  logoBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: adminColors.navy,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  brandText: {
    color: '#FFFFFF',
    fontFamily: 'Montserrat-Bold',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 2,
  },
  sectionRowActive: {},
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconWrapActive: {
    backgroundColor: 'rgba(132,204,22,0.12)',
  },
  sectionLabel: {
    flex: 1,
    color: '#94A3B8',
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 13,
    marginLeft: 8,
  },
  sectionLabelActive: {
    color: '#FFFFFF',
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 56,
    paddingRight: 12,
    paddingVertical: 7,
  },
  subRowActive: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    marginHorizontal: 8,
    paddingLeft: 48,
  },
  subLabel: {
    flex: 1,
    color: '#64748B',
    fontFamily: 'Montserrat-Medium',
    fontSize: 12,
  },
  subLabelActive: {
    color: adminColors.lime,
  },
  badge: {
    backgroundColor: adminColors.red,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: 'Montserrat-Bold',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 12,
    paddingTop: 12,
    gap: 8,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: adminColors.navyMid,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    color: adminColors.lime,
    fontFamily: 'Montserrat-Bold',
    fontSize: 14,
  },
  userName: {
    color: '#FFFFFF',
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 12,
  },
  userEmail: {
    color: '#64748B',
    fontFamily: 'Montserrat-Regular',
    fontSize: 10,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  logoutText: {
    color: '#EF4444',
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 13,
  },
});
