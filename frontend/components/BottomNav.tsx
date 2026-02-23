import React from 'react';
import {
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
  Text,
  Dimensions,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

// Enable LayoutAnimation for Android to ensure smooth pill expansion
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width } = Dimensions.get('window');

const BottomNav = () => {
  const pathname = usePathname();

  // Define the navigation items
  const navItems = [
    { name: 'Home', icon: 'home-outline', activeIcon: 'home', route: '/home' },
    { name: 'Search', icon: 'search-outline', activeIcon: 'search', route: '/search' },
    { name: 'Stores', icon: 'storefront-outline', activeIcon: 'storefront', route: '/stores' },
    // New Tracking/Orders Route
    { name: 'Orders', icon: 'cube-outline', activeIcon: 'cube', route: '/order/tracking' },
    { name: 'Settings', icon: 'settings-outline', activeIcon: 'settings', route: '/settings' },
  ];

  const handlePress = (route: string) => {
    // Trigger smooth layout transition when switching tabs
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    router.push(route as any);
  };

  return (
    <View style={styles.wrapper}>
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
                  <Ionicons name={item.activeIcon as any} size={18} color="#FFF" />
                  <Text style={styles.activeText} numberOfLines={1}>
                    {item.name}
                  </Text>
                </LinearGradient>
              ) : (
                <View style={styles.iconWrapper}>
                  <Ionicons name={item.icon as any} size={24} color="#94A3B8" />
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
    bottom: Platform.OS === 'ios' ? 25 : 15,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 100,
  },
  container: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    width: width - 30, // Much wider to comfortably fit 5 items
    height: 70, 
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
  
  // --- Flex Logic for Animation ---
  navItem: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 30,
  },
  navItemActive: {
    flex: 1, // Expands to fill available space
    marginLeft: 4,
    marginRight: 4,
  },
  navItemInactive: {
    width: 45, // Fixed width for inactive icons
  },

  // --- Active State Styling ---
  activePill: {
    flexDirection: 'row',
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center', 
    borderRadius: 30,
    paddingHorizontal: 12,
  },
  activeText: {
    color: '#FFF',
    fontSize: 12, 
    fontFamily: 'Montserrat-Bold',
    marginLeft: 6, 
  },

  // --- Inactive State Styling ---
  iconWrapper: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default BottomNav;