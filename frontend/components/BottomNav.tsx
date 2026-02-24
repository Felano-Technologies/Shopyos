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

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width } = Dimensions.get('window');

const BottomNav = () => {
  const pathname = usePathname();

  const navItems = [
    { name: 'Home', icon: 'home-outline', activeIcon: 'home', route: '/home' },
    { name: 'Search', icon: 'search-outline', activeIcon: 'search', route: '/search' },
    { name: 'Stores', icon: 'storefront-outline', activeIcon: 'storefront', route: '/stores' },
    { name: 'Orders', icon: 'cube-outline', activeIcon: 'cube', route: '/order' },
    { name: 'Settings', icon: 'settings-outline', activeIcon: 'settings', route: '/settings' },
  ];

  const handlePress = (route: string) => {
    LayoutAnimation.configureNext({
      duration: 200, // Faster duration reduces ghosting
      update: { type: 'easeInEaseOut' },
    });
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
              activeOpacity={1} // Prevents extra flashing
              onPress={() => handlePress(item.route)}
              style={[
                styles.navItem,
                isActive ? styles.navItemActive : styles.navItemInactive
              ]}
            >
              {/* This is the background layer */}
              {isActive && (
                <LinearGradient
                  colors={['#0C1559', '#1e3a8a']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFillObject}
                />
              )}

              {/* Only ONE icon component used per item */}
              <View style={styles.contentRow}>
                <Ionicons 
                  name={(isActive ? item.activeIcon : item.icon) as any} 
                  size={isActive ? 20 : 22} 
                  color={isActive ? "#FFF" : "#64748B"} 
                />
                
                {isActive && (
                  <Text style={styles.activeText} numberOfLines={1}>
                    {item.name}
                  </Text>
                )}
              </View>
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
    bottom: Platform.OS === 'ios' ? 35 : 20,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 100,
  },
  container: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.9)', 
    width: width * 0.88, 
    height: 60, 
    borderRadius: 30,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden', // Keeps the gradient inside the rounded corners
  },
  navItem: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 24,
    overflow: 'hidden', // Clip the gradient background
  },
  navItemActive: {
    flex: 2.8, 
    marginHorizontal: 4,
  },
  navItemInactive: {
    flex: 1, 
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  activeText: {
    color: '#FFF',
    fontSize: 12, 
    fontFamily: 'Montserrat-Bold',
    marginLeft: 8, 
  },
});

export default BottomNav;