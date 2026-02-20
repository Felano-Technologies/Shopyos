import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
  Animated,
  Image,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import BusinessBottomNav from '@/components/BusinessBottomNav';
import { router } from 'expo-router';
import { getStoreOrders, storage } from '@/services/api';

const { width } = Dimensions.get('window');

interface Order {
  id: string;
  customerName: string;
  itemsCount: number;
  totalAmount: number;
  date: string;
  status: 'Pending' | 'Processing' | 'Delivered' | 'Cancelled';
  orderNumber: string;
}

const OrdersScreen = () => {
  const [filter, setFilter] = useState<'All' | 'Pending' | 'Processing' | 'Delivered' | 'Cancelled'>('All');
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);

  const fetchOrders = async () => {
    try {
      const businessId = await storage.getItem('currentBusinessId');
      if (businessId) {
        const data = await getStoreOrders(businessId);
        if (data.success) {
          const mappedOrders = data.orders.map((o: any) => ({
            id: o.id,
            orderNumber: o.order_number,
            customerName: o.buyer?.user_profiles?.full_name || 'Guest',
            itemsCount: o.order_items?.length || 0,
            totalAmount: parseFloat(o.total_amount || 0),
            date: o.created_at,
            status: (o.status.charAt(0).toUpperCase() + o.status.slice(1)) as any
          }));
          setOrders(mappedOrders);
        }
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    }
  };

  React.useEffect(() => {
    fetchOrders();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
  };

  const ordersToUse = orders;
  const filteredOrders = filter === 'All' ? ordersToUse : ordersToUse.filter(order => order.status === filter);

  // Stats
  const totalOrders = ordersToUse.length;
  const pendingOrders = ordersToUse.filter(o => o.status === 'Pending').length;
  const deliveredOrders = ordersToUse.filter(o => o.status === 'Delivered').length;
  const totalRevenue = ordersToUse.reduce((sum, order) => sum + order.totalAmount, 0);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Pending": return { color: "#B45309", bg: "#FEF3C7", icon: "time-outline" };
      case "Delivered": return { color: "#15803D", bg: "#DCFCE7", icon: "checkmark-circle-outline" };
      case "Processing": return { color: "#1D4ED8", bg: "#DBEAFE", icon: "sync-outline" };
      case "Cancelled": return { color: "#B91C1C", bg: "#FEE2E2", icon: "close-circle-outline" };
      default: return { color: "#6B7280", bg: "#F3F4F6", icon: "help-circle-outline" };
    }
  };

  const renderOrder = ({ item }: { item: Order }) => {
    const { color, bg, icon } = getStatusBadge(item.status);

    return (
      <View style={styles.orderCard}>
        {/* Top Row: ID and Status */}
        <View style={styles.cardHeader}>
          <View style={styles.orderIdContainer}>
            <View style={styles.iconCircle}>
              <Feather name="package" size={16} color="#0C1559" />
            </View>
            <Text style={styles.orderNumber}>{item.orderNumber}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: bg }]}>
            <Ionicons name={icon as any} size={12} color={color} style={{ marginRight: 4 }} />
            <Text style={[styles.statusText, { color: color }]}>{item.status}</Text>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.dashedDivider}>
          {Array.from({ length: 20 }).map((_, i) => (
            <View key={i} style={styles.dash} />
          ))}
        </View>

        {/* Middle Row: Details */}
        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Customer</Text>
            <Text style={styles.value}>{item.customerName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Date</Text>
            <Text style={styles.value}>{format(new Date(item.date), "MMM dd, hh:mm a")}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Items</Text>
            <Text style={styles.value}>{item.itemsCount} Items</Text>
          </View>
        </View>

        {/* Bottom Row: Price and Action */}
        <View style={styles.cardFooter}>
          <View>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.amount}>GH₵ {item.totalAmount.toFixed(2)}</Text>
          </View>
          <TouchableOpacity
            style={styles.detailsBtn}
            onPress={() => router.push({
              pathname: '/business/orderDetails',
              params: { id: item.id }
            })}
          >
            <Text style={styles.detailsBtnText}>Details</Text>
            <Feather name="chevron-right" size={16} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.mainContainer}>
      {/* Light Status Bar for Dark Header */}
      <StatusBar style="light" />

      {/* --- Background Watermark --- */}
      <View style={StyleSheet.absoluteFillObject}>
        <View style={styles.bottomLogos}>
          <Image
            source={require('../../assets/images/splash-icon.png')}
            style={styles.fadedLogo}
          />
        </View>
      </View>

      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={'#FFF'} />}
        >
          {/* --- HEADER SECTION (Matched to Products Screen) --- */}
          <LinearGradient
            colors={['#0C1559', '#1e3a8a']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.headerContainer}
          >
            <View style={styles.headerTop}>
              <View style={styles.logoContainer}>
                <Image
                  source={require('../../assets/images/iconwhite.png')}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
            </View>

            {/* Featured Revenue Card inside Header */}
            <View style={styles.revenueCard}>
              <View>
                <Text style={styles.revenueLabel}>Total Revenue</Text>
                <Text style={styles.revenueAmount}>GH₵ {totalRevenue.toFixed(2)}</Text>
              </View>
              <View style={styles.revenueIconContainer}>
                <MaterialCommunityIcons name="finance" size={28} color="#84cc16" />
              </View>
            </View>
          </LinearGradient>

          {/* --- QUICK STATS GRID --- */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Total</Text>
              <Text style={styles.statNumber}>{totalOrders}</Text>
              <View style={[styles.statBar, { backgroundColor: '#0C1559' }]} />
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Pending</Text>
              <Text style={styles.statNumber}>{pendingOrders}</Text>
              <View style={[styles.statBar, { backgroundColor: '#F59E0B' }]} />
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Delivered</Text>
              <Text style={styles.statNumber}>{deliveredOrders}</Text>
              <View style={[styles.statBar, { backgroundColor: '#10B981' }]} />
            </View>
          </View>

          {/* --- FILTER PILLS --- */}
          <View style={styles.filterWrapper}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContainer}>
              {["All", "Pending", "Processing", "Delivered", "Cancelled"].map((tab) => {
                const isActive = filter === tab;
                return (
                  <TouchableOpacity
                    key={tab}
                    onPress={() => setFilter(tab as any)}
                    style={[
                      styles.filterPill,
                      isActive ? styles.filterPillActive : styles.filterPillInactive,
                    ]}
                  >
                    <Text style={[
                      styles.filterText,
                      isActive ? styles.filterTextActive : styles.filterTextInactive
                    ]}>
                      {tab}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* --- ORDERS LIST --- */}
          <View style={styles.listContainer}>
            <FlatList
              data={filteredOrders}
              keyExtractor={(item) => item.id}
              renderItem={renderOrder}
              scrollEnabled={false}
              ListEmptyComponent={() => (
                <View style={styles.emptyState}>
                  <Feather name="inbox" size={40} color="#CBD5E1" />
                  <Text style={styles.emptyStateText}>No {filter} orders found.</Text>
                </View>
              )}
            />
          </View>

        </ScrollView>

        <BusinessBottomNav />
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },

  // Background
  bottomLogos: {
    position: 'absolute',
    bottom: 20,
    left: -20,
  },
  fadedLogo: {
    width: 130,
    height: 130,
    resizeMode: 'contain',
    opacity: 0.08, // Subtle opacity like Products screen
  },

  // Header (Matched to Products Screen)
  headerContainer: {
    paddingTop: 60, // Manual padding to clear status bar
    paddingBottom: 30, // Increased bottom padding to fit revenue card nicely
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    marginBottom: 10,
    shadowColor: "#0C1559",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  logoContainer: {
    height: 40,
    justifyContent: 'center',
  },
  logo: {
    width: 110,
    height: 35,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },

  // Revenue Card (Inside Header)
  revenueCard: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  revenueLabel: {
    fontFamily: 'Montserrat-Medium',
    color: '#D1D5DB', // Light grey text on dark background
    fontSize: 13,
    marginBottom: 4,
  },
  revenueAmount: {
    fontFamily: 'Montserrat-Bold',
    color: '#FFF',
    fontSize: 26, // Slightly smaller than before to fit better
  },
  revenueIconContainer: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    padding: 10,
    borderRadius: 12,
  },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 10, // Adjusted margin since header is self-contained
    marginBottom: 20,
  },
  statItem: {
    backgroundColor: '#FFF',
    width: '31%',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 4,
  },
  statLabel: {
    fontFamily: 'Montserrat-Medium',
    fontSize: 11,
    color: '#64748B',
    marginBottom: 4,
  },
  statNumber: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 18,
    color: '#0F172A',
    marginBottom: 8,
  },
  statBar: {
    width: 20,
    height: 4,
    borderRadius: 2,
  },

  // Filters
  filterWrapper: {
    marginBottom: 16,
  },
  filterContainer: {
    paddingHorizontal: 20,
    gap: 8,
  },
  filterPill: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterPillActive: {
    backgroundColor: '#0C1559',
    borderColor: '#0C1559',
  },
  filterPillInactive: {
    backgroundColor: '#FFF',
    borderColor: '#E2E8F0',
  },
  filterText: {
    fontSize: 13,
    fontFamily: 'Montserrat-SemiBold',
  },
  filterTextActive: {
    color: '#FFF',
  },
  filterTextInactive: {
    color: '#64748B',
  },

  // Order List
  listContainer: {
    paddingHorizontal: 20,
  },

  // Card Design
  orderCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FAFAFA',
  },
  orderIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E0E7FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  orderNumber: {
    fontSize: 15,
    color: '#0F172A',
    fontFamily: 'Montserrat-Bold',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 11,
    fontFamily: 'Montserrat-Bold',
    textTransform: 'uppercase',
  },

  // Dashed Divider
  dashedDivider: {
    flexDirection: 'row',
    overflow: 'hidden',
    paddingHorizontal: 16,
    opacity: 0.3,
    marginVertical: 2,
  },
  dash: {
    width: 6,
    height: 1,
    backgroundColor: '#94A3B8',
    marginRight: 4,
  },

  cardBody: {
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    fontFamily: 'Montserrat-Regular',
    color: '#64748B',
    fontSize: 13,
  },
  value: {
    fontFamily: 'Montserrat-SemiBold',
    color: '#334155',
    fontSize: 13,
  },

  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 4,
  },
  totalLabel: {
    fontSize: 11,
    fontFamily: 'Montserrat-Medium',
    color: '#64748B',
  },
  amount: {
    fontSize: 18,
    fontFamily: 'Montserrat-Bold',
    color: '#0C1559',
  },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0C1559',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  detailsBtnText: {
    color: '#FFF',
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 12,
    marginRight: 2,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#FFF',
    borderRadius: 16,
    marginTop: 10,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#94A3B8',
    fontFamily: 'Montserrat-Medium',
    marginTop: 10,
  },
});

export default OrdersScreen;