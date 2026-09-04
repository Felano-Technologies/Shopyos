import React, { useState, useEffect, useMemo } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Dimensions, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { getBusinessDashboard, storage } from '@/services/api';
import { useSellerUnreadCount } from '@/hooks/useChat';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width } = Dimensions.get('window');

const Badge = ({ count }: Readonly<{ count: number }>) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <View style={styles.badgeContainer}>
      <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
    </View>
  );
};

const BusinessBottomNav = () => {
  const pathname = usePathname();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [orderCount, setOrderCount] = useState(0); // Default to 0
  const { data: chatCount = 0 } = useSellerUnreadCount();

  useEffect(() => {
    // Fetch real stats (Orders)
    const fetchCounts = async () => {
      try {
        const businessId = await storage.getItem('currentBusinessId');
        if (businessId) {
          // Fetch order count
          const dashResp = await getBusinessDashboard(businessId);
          if (dashResp?.stats) {
            setOrderCount(dashResp.stats.pendingOrders || 0);
          }
        }
      } catch (error) {
        console.error('Failed to fetch counts:', error);
      }
    };
    fetchCounts();
  }, []);

  const navItems = [
    { name: 'Home', icon: 'grid', route: '/business/dashboard', count: 0 },
    { name: 'Products', icon: 'box', route: '/business/products', count: 0 },
    { name: 'Orders', icon: 'shopping-bag', route: '/business/orders', hasBadge: true, count: orderCount },
    { name: 'Stats', icon: 'bar-chart-2', route: '/business/analytics', count: 0 },
    { name: 'Community', icon: 'message-circle', route: '/business/community', hasBadge: true, count: chatCount },
  ];

  const handlePress = (route: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    router.replace(route as any);
  };

  return (
    <View style={styles.wrapper}>
      {/* Creative Touch: 
        Glassmorphism-style container with a subtle white border 
      */}
      <View style={styles.container}>
        {navItems.map((item) => {
          const isActive = pathname === item.route;

          return (
            <TouchableOpacity
              key={item.name}
              activeOpacity={0.8}
              onPress={() => handlePress(item.route)}
              style={[
                styles.navItem,
                // THE TRICK: Active gets flex: 1 (expands), Inactive gets fixed width
                isActive ? styles.navItemActive : styles.navItemInactive
              ]}
            >
              {isActive ? (
                <LinearGradient
                  colors={colors.headerGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.activePill}
                >
                  <View style={{ position: 'relative' }}>
                    <Feather name={item.icon as any} size={18} color="#FFF" />
                    {item.hasBadge && (item.count || 0) > 0 && <Badge count={item.count || 0} />}
                  </View>

                  <Text style={styles.activeText} numberOfLines={1} ellipsizeMode="clip">
                    {item.name}
                  </Text>
                </LinearGradient>
              ) : (
                <View style={styles.iconWrapper}>
                  <Feather name={item.icon as any} size={22} color={colors.textSecondary} />
                  {item.hasBadge && (item.count || 0) > 0 && <Badge count={item.count || 0} />}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const getStyles = (c: ThemeColors) => StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 25, // Floating effect
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 100,
  },
  container: {
    flexDirection: 'row',
    backgroundColor: c.surface,
    width: width - 40, // 20px padding on each side
    height: 70, // Slightly taller for better touch targets
    borderRadius: 35,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
    // Premium Shadow
    shadowColor: c.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: c.border,
  },

  // --- Flex Logic ---
  navItem: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 30,
  },
  navItemActive: {
    flex: 1, // Expands to fill available space
    marginLeft: 5,
    marginRight: 5,
  },
  navItemInactive: {
    width: 50, // Fixed width for icons
  },

  // --- Active State Styling ---
  activePill: {
    flexDirection: 'row',
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center', // Centers content within the expanded pill
    borderRadius: 30,
    paddingHorizontal: 12,
  },
  activeText: {
    color: '#FFF',
    fontSize: 12, // Slightly smaller to fit long names
    fontFamily: 'Montserrat-Bold',
    marginLeft: 8, // Space between icon and text
  },

  // --- Inactive State Styling ---
  iconWrapper: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },

  // --- Badge Styling ---
  badgeContainer: {
    position: 'absolute',
    top: -6,
    right: -8,
    backgroundColor: c.error,
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFF',
    zIndex: 10,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 8,
    fontFamily: 'Montserrat-Bold',
  },
});

export default BusinessBottomNav;