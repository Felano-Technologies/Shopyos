import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
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
const PAGE_SIZE = 10;

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

  // --- Pagination & Filter State ---
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const filters = ['All', 'Pending', 'Paid', 'Confirmed', 'In Transit', 'Delivered', 'Cancelled'];

  // Pass the active status filter to the hook → backend does the filtering
  const statusParam = activeFilter === 'All'
    ? undefined
    : activeFilter.toLowerCase().replace(/ /g, '_');

  const { data, isLoading, refetch, isRefetching, isFetching } = useOrders(statusParam, page, PAGE_SIZE);

  const rawOrders: any[] = Array.isArray(data) ? data : data?.orders || [];
  const pagination = (data as any)?.pagination || null;

  const totalPages: number = pagination?.totalPages ?? 1;
  const totalItems: number = pagination?.totalItems ?? rawOrders.length;

  const orders: Order[] = rawOrders.map((o: any) => ({
    id: o.id,
    orderNumber: o.order_number,
    totalAmount: o.payments?.[0]?.amount ? parseFloat(o.payments[0].amount) : 0,
    date: o.created_at,
    status: o.status ? o.status.charAt(0).toUpperCase() + o.status.slice(1) : 'Unknown',
    itemsCount: o.order_items?.length || 0,
    storeName: o.store?.store_name || 'Shopyos Store'
  }));

  // Client-side search filter (applied on top of the current page)
  const filteredOrders = orders.filter((order: Order) => {
    if (!searchQuery) return true;
    return (
      order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.storeName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const handleRefresh = async () => { await refetch(); };

  // Switching filter tabs resets to page 1
  const handleFilterChange = (filter: string) => {
    setActiveFilter(filter);
    setPage(1);
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase().replace(/_/g, ' ')) {
      case 'pending':        return { color: '#B45309', bg: '#FEF3C7', icon: 'time-outline' };
      case 'paid':           return { color: '#15803D', bg: '#DCFCE7', icon: 'card-outline' };
      case 'confirmed':      return { color: '#1D4ED8', bg: '#DBEAFE', icon: 'checkmark-done-outline' };
      case 'processing':     return { color: '#1D4ED8', bg: '#DBEAFE', icon: 'sync-outline' };
      case 'ready for pickup': return { color: '#7C3AED', bg: '#F3E8FF', icon: 'storefront-outline' };
      case 'in transit':     return { color: '#7C3AED', bg: '#F3E8FF', icon: 'bicycle-outline' };
      case 'delivered':      return { color: '#15803D', bg: '#DCFCE7', icon: 'checkmark-circle-outline' };
      case 'cancelled':      return { color: '#B91C1C', bg: '#FEE2E2', icon: 'close-circle-outline' };
      default:               return { color: '#6B7280', bg: '#F3F4F6', icon: 'help-circle-outline' };
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
            <Text style={[styles.statusText, { color }]}>{item.status.replace(/_/g, ' ')}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.orderInfo}>
            <Text style={styles.orderNumberText}>Order #{item.orderNumber}</Text>
            <Text style={styles.dateText}>{format(new Date(item.date), 'MMM dd, yyyy')}</Text>
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

  // ── Pagination footer ──────────────────────────────────────────────────────
  const renderFooter = () => {
    if (totalPages <= 1) return null;

    // Build windowed page numbers with ellipsis
    const allPages = Array.from({ length: totalPages }, (_, i) => i + 1);
    const visible = allPages.filter(
      n => n === 1 || n === totalPages || Math.abs(n - page) <= 1
    );
    const withEllipsis = visible.reduce<(number | string)[]>((acc, n, idx, arr) => {
      if (idx > 0 && (n as number) - (arr[idx - 1] as number) > 1) acc.push('…');
      acc.push(n);
      return acc;
    }, []);

    return (
      <View style={styles.paginationContainer}>
        <Text style={styles.paginationInfo}>
          {totalItems} order{totalItems !== 1 ? 's' : ''} • Page {page} of {totalPages}
        </Text>

        <View style={styles.paginationControls}>
          {/* Prev */}
          <TouchableOpacity
            style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}
            onPress={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1 || isFetching}
          >
            <Ionicons name="chevron-back" size={18} color={page <= 1 ? '#CBD5E1' : '#0C1559'} />
            <Text style={[styles.pageBtnText, page <= 1 && styles.pageBtnTextDisabled]}>Prev</Text>
          </TouchableOpacity>

          {/* Page pills */}
          <View style={styles.pageNumbers}>
            {withEllipsis.map((n, idx) =>
              n === '…' ? (
                <Text key={`el-${idx}`} style={styles.ellipsis}>…</Text>
              ) : (
                <TouchableOpacity
                  key={n}
                  style={[styles.pageNum, page === n && styles.pageNumActive]}
                  onPress={() => setPage(n as number)}
                  disabled={isFetching}
                >
                  <Text style={[styles.pageNumText, page === n && styles.pageNumTextActive]}>{n}</Text>
                </TouchableOpacity>
              )
            )}
          </View>

          {/* Next */}
          <TouchableOpacity
            style={[styles.pageBtn, page >= totalPages && styles.pageBtnDisabled]}
            onPress={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || isFetching}
          >
            <Text style={[styles.pageBtnText, page >= totalPages && styles.pageBtnTextDisabled]}>Next</Text>
            <Ionicons name="chevron-forward" size={18} color={page >= totalPages ? '#CBD5E1' : '#0C1559'} />
          </TouchableOpacity>
        </View>

        {/* Inline loading indicator while changing pages */}
        {isFetching && !isLoading && (
          <View style={styles.fetchingRow}>
            <ActivityIndicator size="small" color="#0C1559" />
            <Text style={styles.fetchingText}>Loading page {page}…</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.mainContainer}>
      <StatusBar style="light" backgroundColor="#0C1559" />

      {/* Header */}
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

      {/* Search + Filter */}
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

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {filters.map(filter => (
            <TouchableOpacity
              key={filter}
              style={[styles.filterChip, activeFilter === filter && styles.filterChipActive]}
              onPress={() => handleFilterChange(filter)}
            >
              <Text style={[styles.filterText, activeFilter === filter && styles.filterTextActive]}>
                {filter}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Content */}
      {isLoading ? (
        <OrdersSkeleton />
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={(item) => item.id}
          renderItem={renderOrder}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} tintColor="#0C1559" />}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={
            rawOrders.length > 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="search-outline" size={60} color="#CBD5E1" />
                <Text style={[styles.emptyText, { color: '#0F172A', fontFamily: 'Montserrat-Bold' }]}>No matches found</Text>
                <Text style={styles.emptyText}>Try a different order ID, store name, or filter.</Text>
              </View>
            ) : (
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

  // Search & Filter
  searchSection: { backgroundColor: '#F8FAFC', paddingHorizontal: 20, paddingTop: 15, paddingBottom: 5 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 14, paddingHorizontal: 12, height: 48, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#0C1559', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  searchInput: { flex: 1, marginLeft: 10, fontFamily: 'Montserrat-Medium', fontSize: 14, color: '#0F172A' },
  filterScroll: { flexDirection: 'row', marginTop: 15, gap: 8, paddingRight: 20, paddingBottom: 6 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0' },
  filterChipActive: { backgroundColor: '#0C1559', borderColor: '#0C1559' },
  filterText: { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: '#64748B' },
  filterTextActive: { color: '#FFF' },

  // List
  listContent: { padding: 20, paddingBottom: 20 },

  // Card
  orderCard: { backgroundColor: '#FFF', borderRadius: 20, marginBottom: 14, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2, borderWidth: 1, borderColor: '#F1F5F9' },
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

  // Pagination
  paginationContainer: { marginTop: 4, marginBottom: 100, alignItems: 'center', gap: 12 },
  paginationInfo: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: '#94A3B8' },
  paginationControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pageBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0' },
  pageBtnDisabled: { borderColor: '#F1F5F9', backgroundColor: '#FAFAFA' },
  pageBtnText: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
  pageBtnTextDisabled: { color: '#CBD5E1' },
  pageNumbers: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pageNum: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0' },
  pageNumActive: { backgroundColor: '#0C1559', borderColor: '#0C1559' },
  pageNumText: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: '#64748B' },
  pageNumTextActive: { color: '#FFF' },
  ellipsis: { fontSize: 14, color: '#94A3B8', paddingHorizontal: 2 },
  fetchingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fetchingText: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: '#94A3B8' },

  // Empty State
  emptyState: { alignItems: 'center', marginTop: 60, paddingHorizontal: 30 },
  emptyText: { marginTop: 16, fontSize: 14, fontFamily: 'Montserrat-Medium', color: '#64748B', marginBottom: 24, textAlign: 'center', lineHeight: 22 },
  shopBtn: { paddingVertical: 14, paddingHorizontal: 28, backgroundColor: '#0C1559', borderRadius: 20 },
  shopBtnText: { color: '#FFF', fontFamily: 'Montserrat-Bold', fontSize: 14 },
});

export default OrdersScreen;