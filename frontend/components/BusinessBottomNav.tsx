// components/BusinessBottomNav.tsx
import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Dimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient'
import { getMyBusinesses } from '@/services/api'; // Assuming you have this or similar API

const { width } = Dimensions.get('window');

const BusinessBottomNav = () => {
  const pathname = usePathname();
  // State to hold the number of pending/new orders
  const [orderCount, setOrderCount] = useState(0);

  // Function to fetch order count (Simulated or Real)
  useEffect(() => {
    const fetchOrderCount = async () => {
      try {
        // --- REAL API IMPLEMENTATION EXAMPLE ---
        // const response = await getMyBusinesses();
        // if (response.success && response.businesses.length > 0) {
        //    // Assuming the backend returns totalOrders or you calculate pending orders
        //    // setOrderCount(response.businesses[0].pendingOrdersCount);
        // }
        
        // --- MOCK DATA (Matches your previous screens) ---
        setOrderCount(2); 
      } catch (error) {
        console.error("Failed to fetch badge count");
      }
    };

    fetchOrderCount();
    
    // Optional: Set up an interval to poll for new orders every 30 seconds
    // const interval = setInterval(fetchOrderCount, 30000);
    // return () => clearInterval(interval);
  }, []);

  const navItems = [
    {
      name: 'Home',
      icon: 'grid',
      route: '/business/dashboard',
    },
    {
      name: 'Product',
      icon: 'box',
      route: '/business/products',
    },
    {
      name: 'Orders',
      icon: 'shopping-bag',
      route: '/business/orders',
      hasBadge: true, // Mark this item as having a badge
    },
    {
      name: 'Stats',
      icon: 'bar-chart-2',
      route: '/business/analytics',
    },
    {
      name: 'Commmunity',
      icon: 'message-circle',
      route: '/business/community',
    },
  ];

  const Badge = () => {
    if (orderCount === 0) return null;
    return (
      <View style={styles.badgeContainer}>
        <Text style={styles.badgeText}>
          {orderCount > 99 ? '99+' : orderCount}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        {navItems.map((item) => {
          const isActive = pathname === item.route;

          return (
            <TouchableOpacity
              key={item.name}
              style={styles.navItemWrapper}
              activeOpacity={0.8}
              onPress={() => router.push(item.route as any)}
            >
              {isActive ? (
                // --- Active State: Gradient Pill ---
                <LinearGradient
                  colors={['#0C1559', '#1e3a8a']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.activeTab}
                >
                  <View>
                    <Feather name={item.icon as any} size={20} color="#FFF" />
                    {/* Badge inside active pill (Optional: adjustments needed if you want it here) */}
                  </View>
                  <Text style={styles.activeText}>{item.name}</Text>
                  
                  {/* Badge Positioned on top right of the whole pill content if desired, 
                      or just on the icon. Here it's on the icon wrapper */}
                  {item.hasBadge && <Badge />} 
                </LinearGradient>
              ) : (
                // --- Inactive State: Simple Icon ---
                <View style={styles.inactiveTab}>
                  <View>
                    <Feather name={item.icon as any} size={22} color="#94A3B8" />
                    {item.hasBadge && <Badge />}
                  </View>
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
    bottom: 25,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 100,
  },
  container: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    width: width - 40,
    height: 65,
    borderRadius: 35,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#0C1559',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  navItemWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  
  // Active Tab
  activeTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 25,
    gap: 8,
    position: 'relative', // For badge absolute positioning
  },
  activeText: {
    color: '#FFF',
    fontSize: 12,
    fontFamily: 'Montserrat-Bold',
  },

  // Inactive Tab
  inactiveTab: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    position: 'relative', // For badge absolute positioning
  },

  // Badge Styles
  badgeContainer: {
    position: 'absolute',
    top: -5,
    right: -6,
    backgroundColor: '#EF4444', // Red color
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFF', // White border to separate from background
    paddingHorizontal: 2,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default BusinessBottomNav;