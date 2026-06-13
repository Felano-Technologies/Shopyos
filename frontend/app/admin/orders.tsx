import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AppImage from '@/components/AppImage';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { adminColors } from '@/components/admin/adminTheme';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { getAdminOrders } from '@/services/api';

const DARK_GRADIENT = ['#01217B', '#85CC16'] as [string, string];
const STATUS_FILTERS = ['All', 'pending', 'processing', 'delivered', 'cancelled'];

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
  delivered: { color: '#15803D', bg: '#DCFCE7', icon: 'checkmark-circle' },
  processing: { color: '#1E40AF', bg: '#DBEAFE', icon: 'sync' },
  pending: { color: '#B45309', bg: '#FEF3C7', icon: 'time' },
  cancelled: { color: '#B91C1C', bg: '#FEE2E2', icon: 'close-circle' },
};

type OrderItem = {
  id: string;
  order_number?: string;
  status?: string;
  created_at?: string;
  total_amount?: string | number;
  store?: { store_name?: string };
  items_count?: number;
  order_items?: Array<{ count?: number }>;
};

type StoreSummary = {
  name: string;
  orders: number;
  revenue: number;
};

export default function AdminOrders() {
  const router = useRouter();
  const searchQuery = '';
  const [activeStatus, setActiveStatus] = useState('All');
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadOrders = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        const params: Record<string, string> = {};
        if (activeStatus !== 'All') params.status = activeStatus;
        if (searchQuery.trim()) params.search = searchQuery.trim();

        const res = await getAdminOrders(params);
        const fallbackData = Array.isArray(res) ? res : [];
        const data = Array.isArray(res?.orders) ? res.orders : fallbackData;
        setOrders(data);
      } catch (error: any) {
        CustomInAppToast.show({
          type: 'error',
          title: 'Error',
          message: error.message || 'Failed to load orders',
        });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeStatus, searchQuery],
  );

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const summary = useMemo(() => {
    const delivered = orders.filter((order) => order.status === 'delivered').length;
    const pending = orders.filter((order) => order.status === 'pending').length;
    const processing = orders.filter((order) => order.status === 'processing').length;
    const cancelled = orders.filter((order) => order.status === 'cancelled').length;

    return [
      { label: 'Total Orders', value: orders.length, color: '#0A2EA8', icon: 'bag-handle-outline' },
      { label: 'Pending', value: pending, color: '#0A2EA8', icon: 'time-outline' },
      { label: 'Processing', value: processing, color: '#0A2EA8', icon: 'sync-outline' },
      { label: 'Delivered', value: delivered, color: '#0A2EA8', icon: 'checkmark-done-outline' },
      { label: 'Cancelled', value: cancelled, color: '#0A2EA8', icon: 'close-circle-outline' },
    ];
  }, [orders]);

  const recentOrders = useMemo(() => orders.slice(0, 3), [orders]);

  const topStores = useMemo<StoreSummary[]>(() => {
    const grouped = new Map<string, StoreSummary>();

    orders.forEach((order) => {
      const storeName = order.store?.store_name || 'Unknown Store';
      const revenue = Number(order.total_amount || 0);
      const existing = grouped.get(storeName);

      if (existing) {
        existing.orders += 1;
        existing.revenue += revenue;
      } else {
        grouped.set(storeName, {
          name: storeName,
          orders: 1,
          revenue,
        });
      }
    });

    return [...grouped.values()]
      .sort((left, right) => right.orders - left.orders || right.revenue - left.revenue)
      .slice(0, 3);
  }, [orders]);

  const renderOrderRow = (item: OrderItem, compact = false) => {
    const status = (item.status || 'pending').toLowerCase();
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
    const storeName = item.store?.store_name || 'Unknown Store';
    const itemsCount = item.items_count ?? item.order_items?.[0]?.count ?? 0;
    const amount = Number(item.total_amount || 0);

    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.orderRowCard, compact && styles.orderRowCompact]}
        onPress={() => router.push(`/order/${item.id}` as any)}
        activeOpacity={0.86}
      >
        <View style={styles.orderRowTop}>
          <View>
            <Text style={styles.orderIdText}>
              {item.order_number ? `#${item.order_number}` : `#${item.id.slice(0, 8).toUpperCase()}`}
            </Text>
            <Text style={styles.timeText}>{formatTime(item.created_at || '')}</Text>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
            <Ionicons name={cfg.icon as any} size={12} color={cfg.color} />
            <Text style={[styles.statusText, { color: cfg.color }]}>{status.toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.orderDivider} />

        <View style={styles.orderRowBottom}>
          <View style={styles.storeRowLeft}>
            <View style={styles.storeIconBg}>
              <MaterialCommunityIcons name="storefront-outline" size={18} color="#0A2EA8" />
            </View>
            <View style={styles.storeInfo}>
              <Text style={styles.storeName}>{storeName}</Text>
              <Text style={styles.itemCount}>
                {itemsCount} {itemsCount === 1 ? 'item' : 'items'} in package
              </Text>
            </View>
          </View>

          <View style={styles.amountBlock}>
            <Text style={styles.amountLabel}>Total</Text>
            <Text style={styles.amountValue}>₵{amount.toFixed(2)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color="#1E88E5" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.canvas}>
          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.screen}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => loadOrders(true)} tintColor="#1E88E5" />
            }
          >
            <LinearGradient colors={DARK_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.heroPanel}>
              <View style={styles.heroTopRow}>
                <View style={styles.heroBrand}>
                  <AppImage source={require('../../assets/images/iconwhite.png')} style={styles.brandLogo} />
                </View>

                <View style={styles.heroIcons}>
                  <TouchableOpacity style={styles.topActionBubble}>
                    <Ionicons name="headset-outline" size={18} color="#FFFFFF" />
                    <View style={styles.badgeDot}>
                      <Text style={styles.badgeText}>2</Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.topActionBubble}>
                    <Ionicons name="notifications-outline" size={18} color="#FFFFFF" />
                    <View style={styles.badgeDot}>
                      <Text style={styles.badgeText}>2</Text>
                    </View>
                  </TouchableOpacity>

                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarLetter}>A</Text>
                  </View>
                </View>
              </View>

              <View style={styles.heroPill}>
                <Text style={styles.heroPillText}>ORDERS</Text>
              </View>
            </LinearGradient>

            <View style={styles.pageHead}>
              <Text style={styles.pageTitle}>Orders</Text>
              <Text style={styles.pageDate}>Wed, 3 June 2026</Text>
            </View>

            <View style={styles.listHeaderWrap}>
              <View style={styles.summaryRow}>
                {summary.map((item) => (
                  <View key={item.label} style={styles.summaryCard}>
                    <View style={[styles.summaryIcon, { backgroundColor: `${item.color}18` }]}>
                      <Ionicons name={item.icon} size={16} color={item.color} />
                    </View>
                    <Text style={styles.summaryLabel}>{item.label}</Text>
                    <Text style={styles.summaryValue}>{item.value.toLocaleString()}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.filterRow}>
                {STATUS_FILTERS.map((filter) => {
                  const active = activeStatus === filter;
                  return (
                    <TouchableOpacity
                      key={filter}
                      style={[styles.filterChip, active && styles.filterChipActive]}
                      onPress={() => setActiveStatus(filter)}
                    >
                      <Text style={[styles.filterText, active && styles.filterTextActive]}>
                        {filter.charAt(0).toUpperCase() + filter.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.cardSection}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionTitleRow}>
                  <Ionicons name="receipt-sharp" size={20} color="#081059" />
                  <Text style={styles.sectionTitle}>Recent orders</Text>
                </View>
              </View>

              {recentOrders.length ? (
                recentOrders.map((item, index) => (
                  <View key={item.id} style={index < recentOrders.length - 1 ? styles.orderBlockGap : undefined}>
                    {renderOrderRow(item, true)}
                  </View>
                ))
              ) : (
                <View style={styles.emptyStateInner}>
                  <MaterialCommunityIcons name="cart-off" size={44} color="#CBD5E1" />
                  <Text style={styles.emptyTitle}>No orders found</Text>
                  <Text style={styles.emptySubtitle}>Try a different search or status filter.</Text>
                </View>
              )}
            </View>

            <View style={styles.cardSection}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionTitleRow}>
                  <Ionicons name="storefront-outline" size={20} color="#081059" />
                  <Text style={styles.sectionTitle}>Top Stores</Text>
                </View>
              </View>

              {topStores.length ? (
                topStores.map((store, index) => (
                  <View
                    key={store.name}
                    style={[styles.storeSummaryRow, index < topStores.length - 1 && styles.rowBorder]}
                  >
                    <View>
                      <Text style={styles.storeSummaryName}>{store.name}</Text>
                      <Text style={styles.storeSummaryMeta}>
                        {store.orders} orders · ₵{store.revenue.toFixed(2)}
                      </Text>
                    </View>

                    <View style={styles.storeScore}>
                      <Text style={styles.storeScoreText}>{(4.8 - index * 0.1).toFixed(1)} ★</Text>
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.emptyStateInner}>
                  <Ionicons name="storefront-outline" size={44} color="#CBD5E1" />
                  <Text style={styles.emptyTitle}>No store data yet</Text>
                  <Text style={styles.emptySubtitle}>Store performance will appear once orders arrive.</Text>
                </View>
              )}
            </View>

            <View style={styles.cardSection}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionTitleRow}>
                  <Feather name="list" size={20} color="#081059" />
                  <Text style={styles.sectionTitle}>All Orders</Text>
                </View>
              </View>

              {orders.length ? (
                orders.map((item, index) => (
                  <View key={item.id} style={index < orders.length - 1 ? styles.orderBlockGap : undefined}>
                    {renderOrderRow(item)}
                  </View>
                ))
              ) : (
                <View style={styles.emptyStateInner}>
                  <MaterialCommunityIcons name="cart-off" size={44} color="#CBD5E1" />
                  <Text style={styles.emptyTitle}>No orders found</Text>
                  <Text style={styles.emptySubtitle}>Try a different search or status filter.</Text>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </>
  );
}

function formatTime(ts: string) {
  if (!ts) return 'Just now';
  const diff = Date.now() - new Date(ts).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const styles = StyleSheet.create({
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E9EFFF',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#E9EFFF',
  },
  canvas: {
    flex: 1,
    backgroundColor: '#E9EFFF',
    paddingHorizontal: 12,
  },
  scrollView: {
    flex: 1,
  },
  screen: {
    flexGrow: 1,
    paddingBottom: 220,
  },

  heroPanel: {
    borderRadius: 36,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 24,
    justifyContent: 'space-between',
    gap: 16,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  brandLogo: {
    width: 106,
    height: 30,
    resizeMode: 'contain',
  },
  heroIcons: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginLeft: 'auto',
  },
  topActionBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badgeDot: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FF2323',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontFamily: 'Montserrat-Bold',
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E5EEFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: '#0B2060',
    fontSize: 20,
    fontFamily: 'Montserrat-Bold',
  },
  heroPill: {
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 26,
    paddingVertical: 10,
    minWidth: 290,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0B2060',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  heroPillText: {
    color: '#0B2060',
    fontSize: 18,
    fontFamily: 'Montserrat-Bold',
    letterSpacing: 0.5,
  },
  pageHead: {
    paddingHorizontal: 8,
    paddingTop: 18,
    paddingBottom: 10,
  },
  pageTitle: {
    color: '#1D2B73',
    fontSize: 24,
    fontFamily: 'Montserrat-Bold',
  },
  pageDate: {
    color: '#1D2B73',
    fontSize: 14,
    fontFamily: 'Montserrat-Regular',
    marginTop: 2,
  },
  listHeaderWrap: {
    paddingTop: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  summaryCard: {
    width: '48.3%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 12,
    shadowColor: '#0B2060',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  summaryIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  summaryLabel: {
    color: '#1D2B73',
    fontSize: 13,
    fontFamily: 'Montserrat-SemiBold',
    marginTop: 2,
  },
  summaryValue: {
    color: '#1D2B73',
    fontSize: 20,
    fontFamily: 'Montserrat-Bold',
    lineHeight: 24,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  filterChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: adminColors.borderStrong,
  },
  filterChipActive: {
    backgroundColor: '#0A2EA8',
    borderColor: '#0A2EA8',
  },
  filterText: {
    color: adminColors.textMuted,
    fontSize: 12,
    fontFamily: 'Montserrat-SemiBold',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  cardSection: {
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 14,
    width: '100%',
    shadowColor: '#0B2060',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    color: '#081059',
    fontSize: 18,
    fontFamily: 'Montserrat-Bold',
  },
  sectionLink: {
    color: '#85CC16',
    fontSize: 14,
    fontFamily: 'Montserrat-SemiBold',
  },
  orderRowCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 0,
  },
  orderRowCompact: {
    paddingVertical: 8,
  },
  orderRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  orderIdText: {
    color: '#111827',
    fontSize: 14,
    fontFamily: 'Montserrat-SemiBold',
    marginBottom: 2,
  },
  timeText: {
    color: '#9CA3AF',
    fontSize: 12,
    fontFamily: 'Montserrat-Regular',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 10,
    fontFamily: 'Montserrat-Bold',
  },
  orderDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 12,
  },
  orderRowBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  storeRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  storeIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EAF0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeInfo: {
    flex: 1,
  },
  storeName: {
    color: '#111827',
    fontSize: 15,
    fontFamily: 'Montserrat-Bold',
    marginBottom: 4,
  },
  itemCount: {
    color: '#6B7280',
    fontSize: 12,
    fontFamily: 'Montserrat-Regular',
  },
  amountBlock: {
    backgroundColor: '#EEF4FF',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 92,
    alignItems: 'center',
  },
  amountLabel: {
    color: '#6B7280',
    fontSize: 10,
    fontFamily: 'Montserrat-SemiBold',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  amountValue: {
    color: '#0A2EA8',
    fontSize: 18,
    fontFamily: 'Montserrat-Bold',
  },
  storeSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#D9D9D9',
  },
  storeSummaryName: {
    color: '#000000',
    fontSize: 15,
    fontFamily: 'Montserrat-Bold',
  },
  storeSummaryMeta: {
    color: '#000000',
    fontSize: 12,
    fontFamily: 'Montserrat-Regular',
    marginTop: 2,
  },
  storeScore: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#B2BF9E',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 52,
  },
  storeScoreText: {
    color: '#2B4501',
    fontSize: 11,
    fontFamily: 'Montserrat-SemiBold',
  },
  emptyStateInner: {
    alignItems: 'center',
    paddingVertical: 26,
  },
  emptyTitle: {
    color: adminColors.text,
    fontSize: 18,
    fontFamily: 'Montserrat-Bold',
    marginTop: 14,
    marginBottom: 6,
  },
  emptySubtitle: {
    color: adminColors.textMuted,
    fontSize: 13,
    fontFamily: 'Montserrat-Regular',
    textAlign: 'center',
  },
  orderBlockGap: {
    marginBottom: 10,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
});
