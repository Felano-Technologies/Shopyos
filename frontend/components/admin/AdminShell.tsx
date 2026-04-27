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
  { label: 'Home', route: '/admin/dashboard', icon: 'grid' as const },
  { label: 'Orders', route: '/admin/orders', icon: 'shopping-bag' as const },
  { label: 'Stores', route: '/admin/stores', icon: 'shopping-cart' as const },
  { label: 'Users', route: '/admin/users', icon: 'users' as const },
  { label: 'Settings', route: '/admin/settings', icon: 'settings' as const },
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
  const { isMobile, isDesktop } = useAdminBreakpoint();

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

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.appBg} />
      <View style={styles.watermarkWrap} pointerEvents="none">
        <Image source={require('../../assets/images/splash-icon.png')} style={styles.watermark} />
      </View>

      <View style={[styles.frame, isDesktop ? styles.frameDesktop : styles.frameMobile]}>
        {isDesktop ? (
          <LinearGradient colors={[adminColors.navy, adminColors.navyMid]} style={styles.sidebar}>
            <View>
              <View style={styles.logoTile}>
                <Image source={require('../../assets/images/iconwhite.png')} style={styles.logoImage} resizeMode="contain" />
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
                        <LinearGradient colors={[adminColors.navy, adminColors.navyMid]} style={StyleSheet.absoluteFillObject} />
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
        ) : null}

        <View style={styles.mainShell}>
          <LinearGradient colors={[adminColors.navy, adminColors.navyMid]} style={styles.topbar}>
            <View style={styles.topbarRow}>
              <View style={styles.topbarTitleWrap}>
                <Text style={styles.eyebrow}>{eyebrow}</Text>
                <Text style={styles.pageTitle}>{title}</Text>
                {subtitle ? <Text style={styles.pageSubtitle}>{subtitle}</Text> : null}
              </View>

              <View style={styles.topbarControls}>
                {onRefresh ? (
                  <TouchableOpacity style={styles.iconButtonGhost} onPress={onRefresh}>
                    <Feather name="refresh-cw" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                ) : null}
                <View style={styles.iconButtonGhost}>
                  <Feather name="mail" size={18} color="#FFFFFF" />
                </View>
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

            {onSearchChange ? (
              <View style={styles.searchBar}>
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

          <View style={styles.bodyRow}>
            <View style={styles.contentColumn}>{content}</View>
            {isDesktop && aside ? <View style={styles.aside}>{aside}</View> : null}
          </View>
        </View>
      </View>

      {isMobile ? (
        <View style={styles.mobileTabbar}>
          {NAV_ITEMS.map((item) => {
            const active = pathname.startsWith(item.route);
            return (
              <TouchableOpacity
                key={item.route}
                onPress={() => router.push(item.route as any)}
                style={[styles.mobileTab, active && styles.mobileTabActive]}
              >
                {active ? (
                  <LinearGradient colors={[adminColors.navy, adminColors.navyMid]} style={StyleSheet.absoluteFillObject} />
                ) : null}
                <Feather name={item.icon} size={18} color={active ? '#FFFFFF' : adminColors.textSoft} />
                <Text style={[styles.mobileTabLabel, active && styles.mobileTabLabelActive]}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
    </SafeAreaView>
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
  },
  watermark: {
    width: 180,
    height: 180,
    resizeMode: 'contain',
  },
  frame: {
    flex: 1,
    padding: 12,
  },
  frameDesktop: {
    flexDirection: 'row',
    gap: 12,
  },
  frameMobile: {
    paddingBottom: 88,
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
  mainShell: {
    flex: 1,
    backgroundColor: adminColors.appBg,
    borderRadius: 32,
    overflow: 'hidden',
  },
  topbar: {
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 26,
    gap: 16,
    position: 'relative',
  },
  topbarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    alignItems: 'flex-start',
  },
  topbarTitleWrap: {
    gap: 4,
    flex: 1,
  },
  eyebrow: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 11,
    fontFamily: 'Montserrat-SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  pageTitle: {
    color: '#FFFFFF',
    fontSize: 32,
    fontFamily: 'Montserrat-Bold',
  },
  pageSubtitle: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: 14,
    fontFamily: 'Montserrat-Regular',
  },
  topbarControls: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  searchBar: {
    minWidth: 240,
    maxWidth: 520,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    height: 50,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontFamily: 'Montserrat-Regular',
    fontSize: 14,
  },
  iconButtonGhost: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  profileAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileLetter: {
    color: adminColors.navy,
    fontFamily: 'Montserrat-Bold',
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
    height: 22,
    backgroundColor: adminColors.appBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  bodyRow: {
    flex: 1,
    flexDirection: 'row',
  },
  contentColumn: {
    flex: 1,
    minWidth: 0,
  },
  contentScroll: {
    paddingHorizontal: 18,
    paddingTop: 0,
    paddingBottom: 24,
    gap: 18,
  },
  contentFill: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 0,
    paddingBottom: 24,
  },
  aside: {
    width: 320,
    padding: 12,
  },
  panel: {
    backgroundColor: adminColors.surface,
    borderRadius: 20,
    padding: 18,
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
    fontSize: 22,
    fontFamily: 'Montserrat-Bold',
  },
  mobileTabbar: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 16 : 12,
    left: 16,
    right: 16,
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 30,
    padding: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    overflow: 'hidden',
    ...adminShadow,
  },
  mobileTab: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 24,
    overflow: 'hidden',
  },
  mobileTabActive: {
    backgroundColor: adminColors.navy,
  },
  mobileTabLabel: {
    color: adminColors.textSoft,
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 11,
  },
  mobileTabLabelActive: {
    color: '#FFFFFF',
  },
});
