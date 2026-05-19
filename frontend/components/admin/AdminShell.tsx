import React from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { adminColors, adminShadow, useAdminBreakpoint } from './adminTheme';

type AdminShellProps = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  children: React.ReactNode;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onSearchSubmit?: () => void;
  searchPlaceholder?: string;
  onRefresh?: () => void;
  actions?: React.ReactNode;
  aside?: React.ReactNode;
  scroll?: boolean;
  contentContainerStyle?: any;
};

type AdminPanelProps = {
  children: React.ReactNode;
  style?: any;
};

const NAV_ITEMS = [
  { label: 'Home',       route: '/admin/dashboard',     icon: 'grid'          as const },
  { label: 'Orders',     route: '/admin/orders',        icon: 'shopping-bag'  as const },
  { label: 'Stores',     route: '/admin/stores',        icon: 'shopping-cart' as const },
  { label: 'Users',      route: '/admin/users',         icon: 'users'         as const },
  { label: 'Broadcasts', route: '/admin/notifications', icon: 'bell'          as const },
  { label: 'Settings',   route: '/admin/settings',      icon: 'settings'      as const },
];

export function AdminPanel({ children, style }: AdminPanelProps) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

export function AdminSectionHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action}
    </View>
  );
}

export default function AdminShell({
  title,
  subtitle,
  eyebrow = 'Admin Workspace',
  children,
  searchValue,
  onSearchChange,
  onSearchSubmit,
  searchPlaceholder = 'Quick search…',
  onRefresh,
  actions,
  aside,
  scroll = false,
  contentContainerStyle,
}: AdminShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isMobile, isTablet, isDesktop, width } = useAdminBreakpoint();

  // Adaptive title size: shrink on small phones
  const titleFontSize = width < 400 ? 22 : width < 600 ? 26 : 32;

  const content = scroll ? (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.contentScroll, contentContainerStyle]}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.contentFill, contentContainerStyle]}>{children}</View>
  );

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.appBg} />
      <View style={styles.watermarkWrap} pointerEvents="none">
        <Image source={require('../../assets/images/splash-icon.png')} style={styles.watermark} />
      </View>

      {/* Desktop: row layout with sidebar */}
      {isDesktop ? (
        <View style={styles.frameDesktop}>
          {/* Sidebar */}
          <LinearGradient colors={[adminColors.navy, adminColors.navyMid]} style={styles.sidebar}>
            <View>
              <View style={styles.logoTile}>
                <Image
                  source={require('../../assets/images/iconwhite.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.navStack}>
                {NAV_ITEMS.map((item) => {
                  const active = pathname.startsWith(item.route);
                  return (
                    <Pressable
                      key={item.route}
                      onPress={() => router.push(item.route as any)}
                      style={[styles.navButton, active && styles.navButtonActive]}
                    >
                      {active ? (
                        <LinearGradient
                          colors={[adminColors.navy, adminColors.navyMid]}
                          style={StyleSheet.absoluteFillObject}
                        />
                      ) : null}
                      <Feather name={item.icon} size={20} color={active ? '#FFFFFF' : '#D7E3FF'} />
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.sidebarBottom}>
              <View style={styles.navButton}>
                <Feather name="message-circle" size={20} color="#D7E3FF" />
              </View>
              <View style={styles.navButton}>
                <Feather name="log-out" size={20} color="#D7E3FF" />
              </View>
            </View>
          </LinearGradient>

          {/* Main content */}
          <View style={styles.mainShell}>
            <TopBar
              eyebrow={eyebrow}
              title={title}
              titleFontSize={titleFontSize}
              subtitle={subtitle}
              isMobile={false}
              isTablet={isTablet}
              onRefresh={onRefresh}
              actions={actions}
              searchValue={searchValue}
              onSearchChange={onSearchChange}
              onSearchSubmit={onSearchSubmit}
              searchPlaceholder={searchPlaceholder}
            />
            <View style={styles.bodyRow}>
              <View style={styles.contentColumn}>{content}</View>
              {aside ? <View style={styles.aside}>{aside}</View> : null}
            </View>
          </View>
        </View>
      ) : (
        /* Mobile/Tablet: column layout, tab bar handled by _layout.tsx */
        <View style={styles.frameMobile}>
          <View style={styles.mainShell}>
            <TopBar
              eyebrow={eyebrow}
              title={title}
              titleFontSize={titleFontSize}
              subtitle={subtitle}
              isMobile={isMobile}
              isTablet={isTablet}
              onRefresh={onRefresh}
              actions={actions}
              searchValue={searchValue}
              onSearchChange={onSearchChange}
              onSearchSubmit={onSearchSubmit}
              searchPlaceholder={searchPlaceholder}
            />
            <View style={styles.bodyRow}>
              <View style={styles.contentColumn}>{content}</View>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

/** Extracted TopBar so we avoid repetition */
function TopBar({
  eyebrow,
  title,
  titleFontSize,
  subtitle,
  isMobile,
  isTablet,
  onRefresh,
  actions,
  searchValue,
  onSearchChange,
  onSearchSubmit,
  searchPlaceholder,
}: {
  eyebrow: string;
  title: string;
  titleFontSize: number;
  subtitle?: string;
  isMobile: boolean;
  isTablet: boolean;
  onRefresh?: () => void;
  actions?: React.ReactNode;
  searchValue?: string;
  onSearchChange?: (v: string) => void;
  onSearchSubmit?: () => void;
  searchPlaceholder: string;
}) {
  return (
    <LinearGradient colors={[adminColors.navy, adminColors.navyMid]} style={styles.topbar}>
      {/* Title row */}
      <View style={styles.topbarRow}>
        <View style={styles.topbarTitleWrap}>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          <Text style={[styles.pageTitle, { fontSize: titleFontSize }]} numberOfLines={1} adjustsFontSizeToFit>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.pageSubtitle} numberOfLines={isMobile ? 2 : 1}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        <View style={styles.topbarControls}>
          {onRefresh ? (
            <TouchableOpacity style={styles.iconButtonGhost} onPress={onRefresh}>
              <Feather name="refresh-cw" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          ) : null}
          {!isMobile && (
            <View style={styles.iconButtonGhost}>
              <Feather name="mail" size={18} color="#FFFFFF" />
            </View>
          )}
          <View style={styles.iconButtonGhost}>
            <Ionicons name="notifications-outline" size={20} color="#FFFFFF" />
          </View>
          {actions}
          <View style={styles.profilePill}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileLetter}>A</Text>
            </View>
            {!isMobile ? <Text style={styles.profileName}>Admin Team</Text> : null}
          </View>
        </View>
      </View>

      {/* Search bar — full width below title on mobile */}
      {onSearchChange ? (
        <View style={[styles.searchBar, isMobile && styles.searchBarMobile]}>
          <Feather name="search" size={18} color="rgba(255,255,255,0.72)" />
          <TextInput
            value={searchValue}
            onChangeText={onSearchChange}
            onSubmitEditing={onSearchSubmit}
            placeholder={searchPlaceholder}
            placeholderTextColor="rgba(255,255,255,0.58)"
            style={styles.searchInput}
            returnKeyType="search"
          />
        </View>
      ) : null}

      <View style={styles.headerArc} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: adminColors.appBg,
  },
  appBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: adminColors.appBg,
  },
  watermarkWrap: {
    position: 'absolute',
    bottom: -20,
    left: -20,
    opacity: 0.06,
    zIndex: 0,
  },
  watermark: {
    width: 180,
    height: 180,
    resizeMode: 'contain',
  },

  // ── Desktop layout ──────────────────────────────────────────────────────────
  frameDesktop: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  sidebar: {
    width: 92,
    borderRadius: 28,
    paddingVertical: 22,
    paddingHorizontal: 14,
    justifyContent: 'space-between',
    ...adminShadow,
  },
  logoTile: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.16)',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 28,
  },
  logoImage: {
    width: 34,
    height: 34,
  },
  navStack: {
    gap: 14,
    alignItems: 'center',
  },
  navButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  navButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  sidebarBottom: {
    gap: 12,
    alignItems: 'center',
  },

  // ── Mobile/Tablet layout ─────────────────────────────────────────────────
  frameMobile: {
    flex: 1,
    padding: 8,
  },

  // ── Shared shell container ────────────────────────────────────────────────
  mainShell: {
    flex: 1,
    backgroundColor: adminColors.appBg,
    borderRadius: 28,
    overflow: 'hidden',
  },

  // ── Topbar ────────────────────────────────────────────────────────────────
  topbar: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 26,
    gap: 12,
    position: 'relative',
  },
  topbarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    alignItems: 'flex-start',
  },
  topbarTitleWrap: {
    gap: 3,
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 10,
    fontFamily: 'Montserrat-SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  pageTitle: {
    color: '#FFFFFF',
    fontFamily: 'Montserrat-Bold',
  },
  pageSubtitle: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: 13,
    fontFamily: 'Montserrat-Regular',
    lineHeight: 18,
  },
  topbarControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    maxWidth: 520,
  },
  searchBarMobile: {
    maxWidth: undefined,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontFamily: 'Montserrat-Regular',
    fontSize: 14,
    paddingVertical: 0,
  },
  iconButtonGhost: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 42,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  profileAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileLetter: {
    color: adminColors.navy,
    fontFamily: 'Montserrat-Bold',
    fontSize: 13,
  },
  profileName: {
    color: '#FFFFFF',
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 13,
  },
  headerArc: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 20,
    backgroundColor: adminColors.appBg,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },

  // ── Body ──────────────────────────────────────────────────────────────────
  bodyRow: {
    flex: 1,
    flexDirection: 'row',
  },
  contentColumn: {
    flex: 1,
    minWidth: 0,
  },
  contentScroll: {
    paddingHorizontal: 14,
    paddingTop: 0,
    paddingBottom: 32,
    gap: 14,
  },
  contentFill: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 0,
    paddingBottom: 24,
  },
  aside: {
    width: 300,
    padding: 10,
  },

  // ── Panel / Section ───────────────────────────────────────────────────────
  panel: {
    backgroundColor: adminColors.surface,
    borderRadius: 20,
    padding: 16,
    ...adminShadow,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    gap: 12,
  },
  sectionTitle: {
    color: adminColors.text,
    fontSize: 20,
    fontFamily: 'Montserrat-Bold',
  },

  // ── Mobile bottom tab bar ─────────────────────────────────────────────────
  mobileTabbar: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 20 : 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 28,
    padding: 5,
    borderWidth: 1,
    borderColor: 'rgba(215,227,255,0.7)',
    overflow: 'hidden',
    ...adminShadow,
  },
  mobileTab: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderRadius: 22,
    overflow: 'hidden',
  },
  mobileTabActive: {
    backgroundColor: adminColors.navy,
  },
  mobileTabLabel: {
    color: adminColors.textSoft,
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 10,
  },
  mobileTabLabelActive: {
    color: '#FFFFFF',
  },

  // ── Tablet tab bar (horizontal, slightly bigger) ──────────────────────────
  tabletTabbar: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 20 : 12,
    left: 24,
    right: 24,
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 32,
    padding: 6,
    borderWidth: 1,
    borderColor: 'rgba(215,227,255,0.7)',
    overflow: 'hidden',
    ...adminShadow,
  },
  tabletTab: {
    flex: 1,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 26,
    overflow: 'hidden',
  },
});
