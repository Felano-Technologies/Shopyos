// components/BusinessBottomNav.tsx
import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';

const BusinessBottomNav = () => {
  const pathname = usePathname();

  const navItems = [
    {
      name: 'Dashboard',
      icon: 'grid',
      route: '/business/dashboard',
    },
    {
      name: 'Products',
      icon: 'cube',
      route: '/business/products',
    },
    {
      name: 'Orders',
      icon: 'cart',
      route: '/business/orders',
    },
    {
      name: 'Analytics',
      icon: 'bar-chart',
      route: '/business/analytics',
    },
    {
      name: 'Profile',
      icon: 'person',
      route: '/business/profile',
    },
  ];

  return (
    <View style={styles.container}>
      {navItems.map((item) => {
        const isActive = pathname === item.route;
        
        return (
          <TouchableOpacity
            key={item.name}
            style={styles.navItem}
            onPress={() => router.push(item.route as any)}
          >
            <Ionicons
              name={item.icon as any}
              size={22}
              color={isActive ? '#4F46E5' : '#6B7280'}
            />
            <Text
              style={[
                styles.navText,
                { color: isActive ? '#4F46E5' : '#6B7280' },
              ]}
            >
              {item.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navText: {
    fontSize: 10,
    marginTop: 4,
    fontWeight: '500',
  },
});

export default BusinessBottomNav;