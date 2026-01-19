import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Dimensions, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width } = Dimensions.get('window');

const BusinessBottomNav = () => {
  const pathname = usePathname();
  const [orderCount, setOrderCount] = useState(0);

  useEffect(() => {
    // Simulate fetching order count
    setOrderCount(5); 
  }, []);

  const navItems = [
    { name: 'Home', icon: 'grid', route: '/business/dashboard' },
    { name: 'Products', icon: 'box', route: '/business/products' },
    { name: 'Orders', icon: 'shopping-bag', route: '/business/orders', hasBadge: true },
    { name: 'Stats', icon: 'bar-chart-2', route: '/business/analytics' },
    { name: 'Community', icon: 'users', route: '/business/community' }, // Changed icon to users for community
  ];

  const handlePress = (route: string) => {
    // Trigger smooth layout transition when switching tabs
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    router.push(route as any);
  };

  const Badge = ({ count }: { count: number }) => {
    if (count === 0) return null;
    return (
      <View style={styles.badgeContainer}>
        <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
      </View>
    );
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
                  colors={['#0C1559', '#1e3a8a']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.activePill}
                >
                  <View style={{ position: 'relative' }}>
                    <Feather name={item.icon as any} size={18} color="#FFF" />
                    {item.hasBadge && <Badge count={orderCount} />}
                  </View>
                  
                  <Text style={styles.activeText} numberOfLines={1} ellipsizeMode="clip">
                    {item.name}
                  </Text>
                </LinearGradient>
              ) : (
                <View style={styles.iconWrapper}>
                  <Feather name={item.icon as any} size={22} color="#94A3B8" />
                  {item.hasBadge && <Badge count={orderCount} />}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
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
    backgroundColor: '#FFFFFF',
    width: width - 40, // 20px padding on each side
    height: 70, // Slightly taller for better touch targets
    borderRadius: 35,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
    // Premium Shadow
    shadowColor: '#0C1559',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
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
    backgroundColor: '#EF4444', // Alert Red
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