// components/BottomNav.tsx
import React from 'react';
import {
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
  Text,
  useColorScheme,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { usePathname, router } from 'expo-router';

const BottomNav = () => {
  const pathname = usePathname();
  const theme = useColorScheme();
  const isDark = theme === 'dark';

  // Colors for light vs dark mode
  const backgroundColor = isDark ? '#1E1E1E' : '#FFFFFF';
  const iconColor = isDark ? '#FFFFFF' : '#000000';

  return (
    <View style={styles.navigationContainer}>
      <View style={[styles.navigationBar, { backgroundColor }]}>
        {/* Home Button */}
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => router.push('/home')}
        >
          <Ionicons name="home-outline" size={22} color={iconColor} />
          <Text style={[styles.navLabel, { color: iconColor }]}>Home</Text>
        </TouchableOpacity>

        {/* Search Button */}
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => router.push('/search')}
        >
          <Ionicons name="search-outline" size={22} color={iconColor} />
          <Text style={[styles.navLabel, { color: iconColor }]}>Search</Text>
        </TouchableOpacity>

        {/* Stores Button */}
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => router.push('/stores')}
        >
          <Ionicons name="storefront-outline" size={22} color={iconColor} />
          <Text style={[styles.navLabel, { color: iconColor }]}>Stores</Text>
        </TouchableOpacity>

        {/* Settings Button */}
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => router.push('/settings')}
        >
          <Feather name="list" size={22} color={iconColor} />
          <Text style={[styles.navLabel, { color: iconColor }]}>Settings</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default BottomNav;

const styles = StyleSheet.create({
  navigationContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 20 : 10,
  },
  navigationBar: {
    flexDirection: 'row',
    borderRadius: 40,
    paddingHorizontal: 30,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '65%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  navButton: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navLabel: {
    fontSize: 10,
    marginTop: 2,
    fontWeight: '500',
  },
});
