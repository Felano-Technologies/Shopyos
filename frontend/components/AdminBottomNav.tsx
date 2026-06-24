import React from 'react';
import {
  Dimensions,
  LayoutAnimation,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { adminColors } from '@/components/admin/adminTheme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width } = Dimensions.get('window');

const NAV_ITEMS = [
  { label: 'Home',     icon: 'grid',         route: '/admin/dashboard' },
  { label: 'Commerce', icon: 'shopping-bag',  route: '/admin/orders'    },
  { label: 'People',   icon: 'users',         route: '/admin/users'     },
  { label: 'Control',  icon: 'sliders',       route: '/admin/settings'  },
] as const;

export default function AdminBottomNav() {
  const pathname = usePathname();

  const handlePress = (route: string) => {
    if (pathname === route || pathname.startsWith(route + '/')) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    router.navigate(route as any);
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.route || pathname.startsWith(item.route + '/');

          return (
            <TouchableOpacity
              key={item.route}
              activeOpacity={0.8}
              onPress={() => handlePress(item.route)}
              style={[styles.navItem, isActive ? styles.navItemActive : styles.navItemInactive]}
            >
              {isActive ? (
                <LinearGradient
                  colors={[adminColors.navy, adminColors.navyMid]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.activePill}
                >
                  <Feather name={item.icon as any} size={18} color="#FFFFFF" />
                  <Text style={styles.activeText} numberOfLines={1}>{item.label}</Text>
                </LinearGradient>
              ) : (
                <View style={styles.iconWrapper}>
                  <Feather name={item.icon as any} size={22} color="#94A3B8" />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 25,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 100,
  },
  container: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    width: width - 40,
    height: 70,
    borderRadius: 35,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#0C1559',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  navItem: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 30,
  },
  navItemActive: {
    flex: 1,
    marginLeft: 5,
    marginRight: 5,
  },
  navItemInactive: {
    width: 60,
  },
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
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Montserrat-Bold',
    marginLeft: 8,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
