// components/admin/AdminSidebar.tsx
import React, { useState } from 'react';
import {
  Image,
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAdminBreakpoint } from './adminTheme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const LOGO = require('@/assets/images/icon.png');

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
      { label: 'Stores',     route: '/admin/stores' },
      { label: 'Orders',     route: '/admin/orders' },
      { label: 'Deliveries', route: '/admin/deliveries' },
      { label: 'Revenue',    route: '/admin/revenue' },
      { label: 'Listing Fees', route: '/admin/listing-fees' },
    ],
  },
  {
    key: 'people',
    label: 'People',
    icon: 'users',
    route: '/admin/users',
    sub: [
      { label: 'Users',     route: '/admin/users' },
      { label: 'Approvals', route: '/admin/approvals' },
      { label: 'Drivers',   route: '/admin/driverVerifications' },
    ],
  },
  {
    key: 'control',
    label: 'Control',
    icon: 'sliders',
    route: '/admin/settings',
    sub: [
      { label: 'Broadcasts', route: '/admin/broadcasts' },
      { label: 'Audit Logs', route: '/admin/audit-logs' },
      { label: 'Categories', route: '/admin/categories' },
      { label: 'Ads',        route: '/admin/ads' },
      { label: 'Settings',   route: '/admin/settings' },
    ],
  },
];

const EXPANDED_W = 260;
const COLLAPSED_W = 72;

export default function AdminSidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const { isTablet } = useAdminBreakpoint();

  const [collapsed, setCollapsed] = useState(isTablet);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    commerce: true,
    people: true,
    control: true,
  });

  const handleToggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCollapsed((c) => !c);
  };

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const isActive = (route: string) =>
    pathname === route || pathname.startsWith(route + '/');

  return (
    <View style={[styles.sidebar, { width: collapsed ? COLLAPSED_W : EXPANDED_W, paddingTop: insets.top + 10 }]}>

      {/* ── Branding + toggle ──────────────────────────────────────────────── */}
      <View style={[styles.header, collapsed && styles.headerCollapsed]}>
        <View style={styles.brandRow}>
          <Image source={LOGO} style={styles.logoImg} resizeMode="contain" />
          {!collapsed && <Text style={styles.brandText}>Shopyos</Text>}
        </View>
        <TouchableOpacity style={styles.toggleBtn} onPress={handleToggle} activeOpacity={0.7}>
          <Feather
            name={collapsed ? 'chevrons-right' : 'chevrons-left'}
            size={15}
            color="rgba(255,255,255,0.45)"
          />
        </TouchableOpacity>
      </View>

      {/* ── Nav items ─────────────────────────────────────────────────────── */}
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.navContent}
      >
        {SECTIONS.map((section) => {
          const sectionActive =
            isActive(section.route) || section.sub.some((s) => isActive(s.route));
          const isOpen = !collapsed && openSections[section.key];

          return (
            <View key={section.key} style={styles.sectionWrap}>

              {/* Section header row */}
              <TouchableOpacity
                style={[
                  styles.sectionRow,
                  collapsed && styles.sectionRowCollapsed,
                  sectionActive && styles.sectionRowActive,
                ]}
                onPress={() => {
                  if (section.sub.length === 0 || collapsed) {
                    router.navigate(section.route as any);
                  } else {
                    toggleSection(section.key);
                  }
                }}
                activeOpacity={0.75}
              >
                <View style={[styles.iconWrap, sectionActive && styles.iconWrapActive]}>
                  <Feather
                    name={section.icon}
                    size={18}
                    color={sectionActive ? '#A3E635' : '#94A3B8'}
                  />
                </View>

                {!collapsed && (
                  <>
                    <Text style={[styles.sectionLabel, sectionActive && styles.sectionLabelActive]}>
                      {section.label}
                    </Text>
                    {section.sub.length > 0 && (
                      <Feather
                        name={isOpen ? 'chevron-down' : 'chevron-right'}
                        size={15}
                        color={sectionActive ? 'rgba(255,255,255,0.45)' : '#475569'}
                      />
                    )}
                  </>
                )}
              </TouchableOpacity>

              {/* Sub-items */}
              {isOpen && section.sub.map((sub) => {
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

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        {!collapsed && (
          <View style={styles.userRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>A</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.userName} numberOfLines={1}>Admin</Text>
              <Text style={styles.userRole} numberOfLines={1}>Super Administrator</Text>
            </View>
          </View>
        )}
        <TouchableOpacity
          style={[styles.logoutBtn, collapsed && styles.logoutBtnCollapsed]}
          onPress={() => router.replace('/login' as any)}
          activeOpacity={0.75}
        >
          <Feather name="log-out" size={17} color="#F87171" />
          {!collapsed && <Text style={styles.logoutText}>Sign Out</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    backgroundColor: '#0B1437',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.07)',
    flexDirection: 'column',
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 20,
    gap: 8,
  },
  headerCollapsed: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 0,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    overflow: 'hidden',
  },
  logoImg: {
    width: 36,
    height: 36,
    flexShrink: 0,
  },
  brandText: {
    color: '#FFFFFF',
    fontFamily: 'Montserrat-Bold',
    fontSize: 18,
    letterSpacing: 0.3,
  },
  toggleBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // ── Nav ─────────────────────────────────────────────────────────────────────
  navContent: {
    paddingHorizontal: 10,
    paddingBottom: 16,
  },
  sectionWrap: {
    marginBottom: 2,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 10,
  },
  sectionRowCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 0,
    marginHorizontal: 6,
  },
  sectionRowActive: {
    backgroundColor: 'rgba(163,230,53,0.10)',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconWrapActive: {
    backgroundColor: 'rgba(163,230,53,0.14)',
  },
  sectionLabel: {
    flex: 1,
    color: '#94A3B8',
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 15,
  },
  sectionLabelActive: {
    color: '#FFFFFF',
  },

  // ── Sub-items ────────────────────────────────────────────────────────────────
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    paddingLeft: 54,
    paddingRight: 10,
    borderRadius: 10,
  },
  subRowActive: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  subLabel: {
    flex: 1,
    color: '#64748B',
    fontFamily: 'Montserrat-Medium',
    fontSize: 14,
  },
  subLabelActive: {
    color: '#CBD5E1',
    fontFamily: 'Montserrat-SemiBold',
  },
  badge: {
    backgroundColor: '#EF4444',
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

  // ── Footer ──────────────────────────────────────────────────────────────────
  footer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: 12,
    paddingTop: 14,
    gap: 10,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(163,230,53,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    color: '#A3E635',
    fontFamily: 'Montserrat-Bold',
    fontSize: 15,
  },
  userName: {
    color: '#FFFFFF',
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 14,
  },
  userRole: {
    color: '#475569',
    fontFamily: 'Montserrat-Regular',
    fontSize: 11,
    marginTop: 2,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(239,68,68,0.08)',
  },
  logoutBtnCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  logoutText: {
    color: '#F87171',
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 14,
  },
});
