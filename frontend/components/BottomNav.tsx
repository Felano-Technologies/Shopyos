import React, { useMemo } from 'react';
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
import { usePathname } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { safeReplace } from '@/lib/navigation';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';
import { GlassSurface } from '@/components/ui/GlassSurface';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width } = Dimensions.get('window');

const BottomNav = () => {
  const pathname = usePathname();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

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
    safeReplace(route);
  };

  return (
    <View style={styles.wrapper}>
      <GlassSurface style={styles.container} isInteractive={false}>
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
                  colors={colors.headerGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
              )}

              {/* Only ONE icon component used per item */}
              <View style={styles.contentRow}>
                <Ionicons
                  name={(isActive ? item.activeIcon : item.icon) as any}
                  size={isActive ? 20 : 22}
                  color={isActive ? "#FFF" : colors.textSecondary}
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
      </GlassSurface>
    </View>
  );
};

const getStyles = (c: ThemeColors) => StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 18 : 10,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 100,
  },
  container: {
    flexDirection: 'row',
    backgroundColor: c.surfaceElevated,
    width: width * 0.88,
    height: 60,
    borderRadius: 30,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: c.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 12,
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