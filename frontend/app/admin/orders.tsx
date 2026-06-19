import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
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
import { adminColors, useAdminBreakpoint } from '@/components/admin/adminTheme';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { getAdminOrders } from '@/services/api';
import { updateOrderStatus } from '@/services/orders';

const DARK_GRADIENT = ['#01217B', '#0C2E8A', '#0E5E1A'] as [string, string, string];
const STATUS_FILTERS = ['All', 'pending', 'processing', 'delivered', 'cancelled'];
type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: IoniconName }> = {
  delivered: { color: '#15803D', bg: '#DCFCE7', icon: 'checkmark-circle' },
  processing: { color: '#1E40AF', bg: '#DBEAFE', icon: 'sync' },
  pending: { color: '#B45309', bg: '#FEF3C7', icon: 'time' },
  cancelled: { color: '#B91C1C', bg: '#FEE2E2', icon: 'close-circle' },
};

const STATUS_PILL: Record<string, { bg: string; text: string }> = {
  delivered:  { bg: '#DCFCE7', text: '#16A34A' },
  processing: { bg: '#DBEAFE', text: '#2563EB' },
  pending:    { bg: '#FEF3C7', text: '#D97706' },
  cancelled:  { bg: '#FEE2E2', text: '#DC2626' },
};

const STAT_COLORS = [
  { iconBg: '#DBEAFE', iconColor: '#2563EB' },  // Total
  { iconBg: '#FEF3C7', iconColor: '#D97706' },  // Pending
  { iconBg: '#EDE9FE', iconColor: '#7C3AED' },  // Processing
  { iconBg: '#DCFCE7', iconColor: '#16A34A' },  // Delivered
  { iconBg: '#FFE4E6', iconColor: '#E11D48' },  // Cancelled
];

type OrderItem = {
  id: string;
  order_number?: string;
  status?: string;
  created_at?: string;
  total_amount?: string | number;
  store?: { store_name?: string };
  items_count?: number;
  order_items?: { count?: number }[];
};

type StoreSummary = {
  name: string;
  orders: number;
  revenue: number;
};

const ORDER_STATUSES = ['pending', 'processing', 'ready_for_pickup', 'in_transit', 'delivered', 'cancelled'];

export default function AdminOrders() {
  const router = useRouter();
  const { isDesktop } = useAdminBreakpoint();
  const searchQuery = '';
  const [activeStatus, setActiveStatus] = useState('All');
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionOrder, setActionOrder] = useState<OrderItem | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

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
      { label: 'Total Orders', value: orders.length, icon: 'bag-handle-outline' as IoniconName, iconBg: '#DBEAFE', iconColor: '#2563EB' },
      { label: 'Pending',      value: pending,        icon: 'time-outline' as IoniconName,            iconBg: '#FEF3C7', iconColor: '#D97706' },
      { label: 'Processing',   value: processing,     icon: 'sync-outline' as IoniconName,            iconBg: '#EDE9FE', iconColor: '#7C3AED' },
      { label: 'Delivered',    value: delivered,      icon: 'checkmark-done-outline' as IoniconName,  iconBg: '#DCFCE7', iconColor: '#16A34A' },
      { label: 'Cancelled',    value: cancelled,      icon: 'close-circle-outline' as IoniconName,    iconBg: '#FFE4E6', iconColor: '#E11D48' },
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

  const handleStatusUpdate = async (newStatus: string) => {
    if (!actionOrder) return;
    try {
      setUpdatingStatus(true);
      await updateOrderStatus(actionOrder.id, newStatus);
      setOrders(prev => prev.map(o => o.id === actionOrder.id ? { ...o, status: newStatus } : o));
      CustomInAppToast.show({ type: 'success', title: 'Status Updated', message: `Order set to ${newStatus}` });
      setActionOrder(null);
    } catch (err: any) {
      CustomInAppToast.show({ type: 'error', title: 'Update Failed', message: err.message });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const renderOrderRow = (item: OrderItem, compact = false) => {
    const status = (item.status || 'pending').toLowerCase();
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
    const pill = STATUS_PILL[status] ?? STATUS_PILL.pending;
    const storeName = item.store?.store_name || 'Unknown Store';
    const itemsCount = item.items_count ?? item.order_items?.[0]?.count ?? 0;
    const amount = Number(item.total_amount || 0);

    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.orderRowCard, compact && styles.orderRowCompact, { borderLeftWidth: 3, borderLeftColor: pill.text }]}
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

          <View style={[styles.pill, { backgroundColor: pill.bg }]}>
            <Ionicons name={cfg.icon} size={12} color={pill.text} />
            <Text style={[styles.pillText, { color: pill.text }]}>{status.toUpperCase()}</Text>
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

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={styles.amountBlock}>
              <Text style={styles.amountLabel}>Total</Text>
              <Text style={styles.amountValue}>₵{amount.toFixed(2)}</Text>
            </View>
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation(); setActionOrder(item); }}
              style={styles.menuBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="more-vertical" size={18} color="#64748B" />
            </TouchableOpacity>
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
        <View style={[styles.canvas, isDesktop && styles.desktopCanvas]}>
          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.screen}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => loadOrders(true)} tintColor="#1E88E5" />
            }
          >
            <LinearGradient colors={DARK_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroPanel}>
              <View style={styles.heroTopRow}>
                <View style={styles.heroBrand}>
                  <AppImage source={require('../../assets/images/iconwhite.png')} style={styles.brandLogo} />
                </View>

                <View style={styles.heroIcons}>
                  <TouchableOpacity
                    style={styles.topActionBubble}
                    onPress={() => router.push('/admin/audit-logs' as any)}
                  >
                    <Ionicons name="headset-outline" size={18} color="#FFFFFF" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.topActionBubble}
                    onPress={() => router.push('/admin/notifications' as any)}
                  >
                    <Ionicons name="notifications-outline" size={18} color="#FFFFFF" />
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
              <Text style={styles.pageDate}>{new Date().toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}</Text>
            </View>

            <View style={styles.listHeaderWrap}>
              <View style={styles.summaryRow}>
                {summary.map((item) => (
                  <View key={item.label} style={[styles.statCard, { flexBasis: isDesktop ? '17%' : '47%', flexGrow: 1 }]}>
                    <View style={[styles.statIcon, { backgroundColor: item.iconBg }]}>
                      <Ionicons name={item.icon} size={16} color={item.iconColor} />
                    </View>
                    <Text style={styles.statValue}>{item.value.toLocaleString()}</Text>
                    <Text style={styles.statLabel}>{item.label}</Text>
                    <View style={[styles.statBar, { backgroundColor: item.iconColor }]} />
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

            {!isDesktop && (
              <View style={styles.quickLinksRow}>
                {[
                  { label: 'Stores',     icon: 'storefront-outline',  route: '/admin/stores',     color: '#0C1559', bg: '#EEF2FF' },
                  { label: 'Revenue',    icon: 'wallet-outline',      route: '/admin/revenue',    color: '#16A34A', bg: '#DCFCE7' },
                  { label: 'Deliveries', icon: 'bicycle-outline',     route: '/admin/deliveries', color: '#D97706', bg: '#FEF3C7' },
                ].map((link) => (
                  <TouchableOpacity
                    key={link.label}
                    style={styles.quickLink}
                    onPress={() => router.push(link.route as any)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.quickLinkIcon, { backgroundColor: link.bg }]}>
                      <Ionicons name={link.icon as any} size={20} color={link.color} />
                    </View>
                    <Text style={[styles.quickLinkLabel, { color: link.color }]}>{link.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

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
                      <Text style={styles.storeScoreText}>{store.orders ?? 0} orders</Text>
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

      {/* Status update bottom sheet */}
      <Modal
        visible={!!actionOrder}
        transparent
        animationType="slide"
        onRequestClose={() => setActionOrder(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setActionOrder(null)}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>
              Update Order {actionOrder?.order_number ? `#${actionOrder.order_number}` : ''}
            </Text>
            <Text style={styles.modalSubtitle}>Select new status</Text>
            {ORDER_STATUSES.map(s => {
              const cfg = STATUS_CONFIG[s] || STATUS_CONFIG.pending;
              const isCurrent = (actionOrder?.status || '').toLowerCase() === s;
              return (
                <TouchableOpacity
                  key={s}
                  style={[styles.statusOption, isCurrent && styles.statusOptionCurrent]}
                  onPress={() => handleStatusUpdate(s)}
                  disabled={updatingStatus || isCurrent}
                >
                  <Ionicons name={cfg.icon} size={18} color={isCurrent ? '#FFF' : cfg.color} />
                  <Text style={[styles.statusOptionText, isCurrent && { color: '#FFF' }]}>
                    {s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </Text>
                  {isCurrent && <Text style={styles.currentLabel}>Current</Text>}
                </TouchableOpacity>
              );
            })}
            {updatingStatus && <ActivityIndicator style={{ marginTop: 12 }} color="#0A2EA8" />}
          </View>
        </TouchableOpacity>
      </Modal>
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
    backgroundColor: '#F5F7FA',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  canvas: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    paddingHorizontal: 16,
  },
  scrollView: {
    flex: 1,
  },
  screen: {
    flexGrow: 1,
    paddingBottom: 40,
  },

  heroPanel: {
    borderRadius: 36,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 18,
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
    width: 120,
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
  statCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0C1559',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    overflow: 'hidden',
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    color: '#0F172A',
    fontSize: 18,
    fontFamily: 'Montserrat-Bold',
    marginBottom: 2,
    marginTop: 8,
  },
  statLabel: {
    color: '#64748B',
    fontSize: 11,
    fontFamily: 'Montserrat-SemiBold',
  },
  statBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
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
  quickLinksRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  quickLink: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 8,
    shadowColor: '#0C1559',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  quickLinkIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLinkLabel: {
    fontSize: 11,
    fontFamily: 'Montserrat-SemiBold',
  },
  cardSection: {
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    width: '100%',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0C1559',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
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
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0C1559',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  desktopCanvas: {
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
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
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  pillText: {
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
  menuBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingBottom: 40,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: 'Montserrat-Bold',
    color: '#0F172A',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    fontFamily: 'Montserrat-Medium',
    color: '#64748B',
    marginBottom: 16,
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
    backgroundColor: '#F8FAFC',
  },
  statusOptionCurrent: {
    backgroundColor: '#0A2EA8',
  },
  statusOptionText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Montserrat-SemiBold',
    color: '#0F172A',
  },
  currentLabel: {
    fontSize: 10,
    fontFamily: 'Montserrat-Bold',
    color: '#A3E635',
    backgroundColor: 'rgba(163,230,53,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
});
