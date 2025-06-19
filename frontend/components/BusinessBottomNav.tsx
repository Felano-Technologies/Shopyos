import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';

const BusinessBottomNav = () => {
  const router = useRouter();
  const pathname = usePathname();

  const navItems = [
    { label: 'Dashboard', icon: 'home-outline', route: '/business/dashboard' },
    { label: 'Products', icon: 'cube-outline', route: '/business/products' },
    { label: 'Orders', icon: 'receipt-outline', route: '/business/orders' },
    { label: 'Earnings', icon: 'cash-outline', route: '/business/earnings' },
    { label: 'Reviews', icon: 'star-outline', route: '/business/reviews' },
  ];

  return (
    <View style={styles.container}>
      {navItems.map(({ label, icon, route }) => {
        const isActive = pathname === route;
        return (
          <TouchableOpacity
            key={route}
            onPress={() => router.push(route)}
            style={styles.navItem}
          >
            <Ionicons name={icon} size={22} color={isActive ? '#2563EB' : '#94A3B8'} />
            <Text style={[styles.label, isActive && styles.activeLabel]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    justifyContent: 'space-around',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderColor: '#E5E7EB',
  },
  navItem: {
    alignItems: 'center',
  },
  label: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  activeLabel: {
    color: '#2563EB',
    fontWeight: '600',
  },
});

export default BusinessBottomNav;
