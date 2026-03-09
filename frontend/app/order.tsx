import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  StyleSheet, 
  TouchableOpacity, 
  Dimensions, 
  RefreshControl, 
  Image, 
  ActivityIndicator,
  TextInput,
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { OrdersSkeleton } from '@/components/skeletons/OrdersSkeleton';
import { useOrders } from '@/hooks/useOrders';

const { width } = Dimensions.get('window');

interface Order {
  id: string;
  orderNumber: string;
  totalAmount: number;
  date: string;
  status: string;
  itemsCount: number;
  storeName: string;
}

const OrdersScreen = () => {
  const router = useRouter();

  // --- TanStack Query Hook ---
  const { data, isLoading, refetch, isRefetching } = useOrders();

  // --- NEW: Search & Filter States ---
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const filters = ['All', 'Pending', 'Processing', 'In Transit', 'Delivered', 'Cancelled'];

  const rawOrders = Array.isArray(data) ? data : data?.orders || [];

  const orders = rawOrders.map((o: any) => ({
    id: o.id,
    orderNumber: o.order_number,
    totalAmount: o.payments?.[0]?.amount ? parseFloat(o.payments[0].amount) : 0,
    date: o.created_at,
    status: o.status ? o.status.charAt(0).toUpperCase() + o.status.slice(1) : 'Unknown',
    itemsCount: o.order_items?.length || 0,
    storeName: o.store?.store_name || 'Shopyos Store'
  }));

  const loading = isLoading;
  const refreshing = isRefetching;

  const handleRefresh = async () => {
    await refetch();
  };

  // --- NEW: Filtering Logic ---
  const filteredOrders = orders.filter((order: Order) => {
    // Match Search Query (Order Number or Store Name)
    const matchesSearch = 
      order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.storeName.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Match Active Filter Tab
    let matchesFilter = true;
    if (activeFilter !== 'All') {
      // Normalize strings to ensure a match (e.g. "In Transit" matches "In_transit" or "In transit")
      const normalizedOrderState = order.status.replace(/_/g, ' ').toLowerCase();
      const normalizedFilter = activeFilter.toLowerCase();
      matchesFilter = normalizedOrderState === normalizedFilter;
    }

    return matchesSearch && matchesFilter;
  });

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase().replace(/_/g, ' ')) {
      case "pending": return { color: "#B45309", bg: "#FEF3C7", icon: "time-outline" };
      case "delivered": return { color: "#15803D", bg: "#DCFCE7", icon: "checkmark-circle-outline" };
      case "processing": return { color: "#1D4ED8", bg: "#DBEAFE", icon: "sync-outline" };
      case "in transit": return { color: "#7C3AED", bg: "#F3E8FF", icon: "bicycle-outline" };
      case "cancelled": return { color: "#B91C1C", bg: "#FEE2E2", icon: "close-circle-outline" };
      default: return { color: "#6B7280", bg: "#F3F4F6", icon: "help-circle-outline" };
    }
  };

  const renderOrder = ({ item }: { item: Order }) => {
    const { color, bg, icon } = getStatusBadge(item.status);

    return (
      <TouchableOpacity
        style={styles.orderCard}
        activeOpacity={0.8}
        onPress={() => router.push(`/order/${item.id}` as any)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.storeNameRow}>
            <MaterialCommunityIcons name="store-outline" size={16} color="#0C1559" />
            <Text style={styles.storeName}>{item.storeName}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: bg }]}>
            <Ionicons name={icon as any} size={12} color={color} style={{ marginRight: 4 }} />
            <Text style={[styles.statusText, { color: color }]}>{item.status.replace(/_/g, ' ')}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.orderInfo}>
            <Text style={styles.orderNumberText}>Order #{item.orderNumber}</Text>
            <Text style={styles.dateText}>{format(new Date(item.date), "MMM dd, yyyy")}</Text>
          </View>
          <View style={styles.amountInfo}>
            <Text style={styles.totalLabel}>Amount</Text>
            <Text style={styles.amountText}>₵{item.totalAmount.toFixed(2)}</Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.itemsCount}>{item.itemsCount} {item.itemsCount === 1 ? 'item' : 'items'}</Text>
          <View style={styles.viewDetailsRow}>
            <Text style={styles.viewDetailsText}>View Details</Text>
            <Feather name="chevron-right" size={16} color="#0C1559" />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.mainContainer}>
      <StatusBar style="light" backgroundColor="#0C1559" />

      {/* Static Header - Always Visible */}
      <LinearGradient colors={['#0C1559', '#1e3a8a']} style={styles.header}>
        <SafeAreaView edges={['top', 'left', 'right']}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>My Orders</Text>
            <View style={{ width: 40 }} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* --- Search & Filter Section --- */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Feather name="search" size={18} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by order ID or store..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.filterScroll}
        >
          {filters.map(filter => (
            <TouchableOpacity 
              key={filter} 
              style={[styles.filterChip, activeFilter === filter && styles.filterChipActive]}
              onPress={() => setActiveFilter(filter)}
            >
              <Text style={[styles.filterText, activeFilter === filter && styles.filterTextActive]}>
                {filter}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Content Area */}
      {loading ? (
        <OrdersSkeleton />
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={(item) => item.id}
          renderItem={renderOrder}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#0C1559" />}
          ListEmptyComponent={
            rawOrders.length > 0 ? (
              // Empty state when search yields no results
              <View style={styles.emptyState}>
                <Ionicons name="search-outline" size={60} color="#CBD5E1" />
                <Text style={[styles.emptyText, { color: '#0F172A', fontFamily: 'Montserrat-Bold' }]}>No matches found</Text>
                <Text style={[styles.emptyText, { marginTop: 4 }]}>We couldn't find any orders matching your search or filter.</Text>
              </View>
            ) : (
              // Absolute empty state (User has never ordered)
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="package-variant-closed" size={80} color="#CBD5E1" />
                <Text style={styles.emptyText}>You haven't placed any orders yet.</Text>
                <TouchableOpacity style={styles.shopBtn} onPress={() => router.push('/home')}>
                  <Text style={styles.shopBtnText}>Start Shopping</Text>
                </TouchableOpacity>
              </View>
            )
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { paddingBottom: 20, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, zIndex: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10 },
  backBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12 },
  headerTitle: { fontSize: 20, fontFamily: 'Montserrat-Bold', color: '#FFF' },
  
  // --- Search & Filter Styles ---
  searchSection: { 
    backgroundColor: '#F8FAFC', 
    paddingHorizontal: 20, 
    paddingTop: 15,
    paddingBottom: 5,
    zIndex: 5
  },
  searchBar: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#FFF', 
    borderRadius: 14, 
    paddingHorizontal: 12, 
    height: 48,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0C1559', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 5, 
    elevation: 2 
  },
  searchInput: { 
    flex: 1, 
    marginLeft: 10, 
    fontFamily: 'Montserrat-Medium', 
    fontSize: 14, 
    color: '#0F172A' 
  },
  filterScroll: { 
    flexDirection: 'row', 
    marginTop: 15, 
    gap: 10,
    paddingRight: 20 
  },
  filterChip: { 
    paddingHorizontal: 16, 
    paddingVertical: 8, 
    borderRadius: 20, 
    backgroundColor: '#FFF', 
    borderWidth: 1, 
    borderColor: '#E2E8F0',
    marginRight: 8
  },
  filterChipActive: { 
    backgroundColor: '#0C1559', 
    borderColor: '#0C1559' 
  },
  filterText: { 
    fontSize: 12, 
    fontFamily: 'Montserrat-SemiBold', 
    color: '#64748B' 
  },
  filterTextActive: { 
    color: '#FFF' 
  },

  // FIXED: Increased paddingBottom to 120 so cards don't hide behind Bottom Nav
  listContent: { padding: 20, paddingBottom: 120 },

  // Card Styles
  orderCard: { backgroundColor: '#FFF', borderRadius: 20, marginBottom: 14, padding: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2, borderWidth: 1, borderColor: '#F1F5F9' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  storeNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  storeName: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: '#334155' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12 },
  statusText: { fontSize: 10, fontFamily: 'Montserrat-Bold', textTransform: 'capitalize' },
  cardBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#F8FAFC' },
  orderInfo: { gap: 6 },
  orderNumberText: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
  dateText: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: '#94A3B8' },
  amountInfo: { alignItems: 'flex-end', gap: 4 },
  totalLabel: { fontSize: 11, fontFamily: 'Montserrat-Medium', color: '#94A3B8' },
  amountText: { fontSize: 15, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  itemsCount: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: '#64748B' },
  viewDetailsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewDetailsText: { fontSize: 12, fontFamily: 'Montserrat-Bold', color: '#0C1559' },

  // Empty State
  emptyState: { alignItems: 'center', marginTop: 60, paddingHorizontal: 30 },
  emptyText: { marginTop: 16, fontSize: 14, fontFamily: 'Montserrat-Medium', color: '#64748B', marginBottom: 24, textAlign: 'center', lineHeight: 22 },
  shopBtn: { paddingVertical: 14, paddingHorizontal: 28, backgroundColor: '#0C1559', borderRadius: 20 },
  shopBtnText: { color: '#FFF', fontFamily: 'Montserrat-Bold', fontSize: 14 },
});

export default OrdersScreen;