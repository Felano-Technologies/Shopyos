import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Dimensions, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width } = Dimensions.get('window');

const DriverBottomNav = () => {
  const pathname = usePathname();

  // Driver-specific Navigation Items
  const navItems = [
    { 
        name: 'Home', 
        icon: 'navigation', 
        route: '/driver/dashboard',
        library: 'Feather' 
    },
    { 
        name: 'Earnings', 
        icon: 'dollar-sign', 
        route: '/driver/earnings',
        library: 'Feather'
    },
    { 
        name: 'History', 
        icon: 'clock', 
        route: '/driver/history',
        library: 'Feather'
    },
    { 
        name: 'Profile', 
        icon: 'user', 
        route: '/driver/settings',
        library: 'Feather'
    },
  ];

  const handlePress = (route: string) => {
    // Trigger smooth layout transition
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    router.push(route as any);
  };

  // Helper to render icon based on library (mostly Feather for consistency)
  const RenderIcon = ({ name, color, size }: { name: string, color: string, size: number }) => {
      return <Feather name={name as any} size={size} color={color} />;
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
                // Active expands (flex: 1), Inactive stays fixed
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
                  <RenderIcon name={item.icon} size={18} color="#FFF" />
                  
                  <Text style={styles.activeText} numberOfLines={1} ellipsizeMode="clip">
                    {item.name}
                  </Text>
                </LinearGradient>
              ) : (
                <View style={styles.iconWrapper}>
                  <RenderIcon name={item.icon} size={22} color="#94A3B8" />
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
    width: 60, // Fixed width for icons
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
    marginLeft: 8,
  },

  // --- Inactive State Styling ---
  iconWrapper: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default DriverBottomNav;