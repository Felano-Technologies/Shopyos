import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import AdminShell, { AdminPanel } from '@/components/admin/AdminShell';
import { adminColors, useAdminBreakpoint } from '@/components/admin/adminTheme';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { getAdminOrders } from '@/services/api';

const STATUS_FILTERS = ['All', 'pending', 'processing', 'delivered', 'cancelled'];

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
  delivered: { color: '#15803D', bg: '#DCFCE7', icon: 'checkmark-circle' },
  processing: { color: '#1E40AF', bg: '#DBEAFE', icon: 'sync' },
  pending: { color: '#B45309', bg: '#FEF3C7', icon: 'time' },
  cancelled: { color: '#B91C1C', bg: '#FEE2E2', icon: 'close-circle' },
};

export default function AdminOrders() {
  const router = useRouter();
  const { isDesktop } = useAdminBreakpoint();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeStatus, setActiveStatus] = useState('All');
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadOrders = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const params: Record<string, string> = {};
      if (activeStatus !== 'All') params.status = activeStatus;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await getAdminOrders(params);
      const data = Array.isArray(res?.orders) ? res.orders : Array.isArray(res) ? res : [];
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
  }, [activeStatus, searchQuery]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const summary = useMemo(() => {
    const delivered = orders.filter((order) => order.status === 'delivered').length;
    const pending = orders.filter((order) => order.status === 'pending').length;
    const processing = orders.filter((order) => order.status === 'processing').length;
    return [
      { label: 'Total Orders', value: orders.length, color: adminColors.blue, icon: 'bag-handle-outline' },
      { label: 'Pending', value: pending, color: adminColors.amber, icon: 'time-outline' },
      { label: 'Processing', value: processing, color: adminColors.violet, icon: 'sync-outline' },
      { label: 'Delivered', value: delivered, color: adminColors.green, icon: 'checkmark-done-outline' },
    ];
  }, [orders]);

  return (
    <>
      <StatusBar style="dark" />
      <AdminShell
        title="Orders"
        subtitle="Review order health, filter statuses, and jump into specific order details."
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={() => loadOrders()}
        searchPlaceholder="Search by order number..."
        onRefresh={() => loadOrders(true)}
      >
        <View style={styles.page}>
          <View style={styles.summaryRow}>
            {summary.map((item) => (
              <AdminPanel key={item.label} style={styles.summaryCard}>
                <View style={[styles.summaryIcon, { backgroundColor: `${item.color}18` }]}>
                  <Ionicons name={item.icon as any} size={18} color={item.color} />
                </View>
                <Text style={styles.summaryLabel}>{item.label}</Text>
                <Text style={styles.summaryValue}>{item.value.toLocaleString()}</Text>
              </AdminPanel>
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

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={adminColors.blue} />
            </View>
          ) : (
            <FlatList
              data={orders}
              keyExtractor={(item) => item.id}
              numColumns={isDesktop ? 2 : 1}
              key={isDesktop ? 'desktop' : 'mobile'}
              columnWrapperStyle={isDesktop ? styles.columnWrap : undefined}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={() => loadOrders(true)} tintColor={adminColors.blue} />
              }
              renderItem={({ item }) => {
                const status = (item.status || 'pending').toLowerCase();
                const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
                const storeName = item.store?.store_name || 'Unknown Store';
                const itemsCount = item.items_count ?? item.order_items?.[0]?.count ?? 0;

                return (
                  <TouchableOpacity
                    style={styles.cardOuter}
                    onPress={() => router.push(`/order/${item.id}` as any)}
                  >
                    <AdminPanel style={styles.orderCard}>
                      <View style={styles.cardHeader}>
                        <View>
                          <Text style={styles.orderIdText}>
                            {item.order_number
                              ? `#${item.order_number}`
                              : `#${item.id.slice(0, 8).toUpperCase()}`}
                          </Text>
                          <Text style={styles.timeText}>{formatTime(item.created_at)}</Text>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
                          <Ionicons name={cfg.icon as any} size={12} color={cfg.color} />
                          <Text style={[styles.statusText, { color: cfg.color }]}>
                            {status.toUpperCase()}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.cardBody}>
                        <View style={styles.storeRow}>
                          <View style={styles.storeIconBg}>
                            <MaterialCommunityIcons
                              name="storefront-outline"
                              size={18}
                              color={adminColors.navy}
                            />
                          </View>
                          <View style={styles.storeInfo}>
                            <Text style={styles.storeName}>{storeName}</Text>
                            <Text style={styles.itemCount}>
                              {itemsCount} {itemsCount === 1 ? 'item' : 'items'} in package
                            </Text>
                          </View>
                        </View>
                        <View style={styles.amountBlock}>
                          <Text style={styles.amountLabel}>Total Amount</Text>
                          <Text style={styles.amountValue}>₵{parseFloat(item.total_amount || 0).toFixed(2)}</Text>
                        </View>
                      </View>

                      <View style={styles.cardFooter}>
                        <Text style={styles.viewDetailsText}>View full details</Text>
                        <Feather name="chevron-right" size={16} color={adminColors.navy} />
                      </View>
                    </AdminPanel>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <AdminPanel style={styles.emptyState}>
                  <MaterialCommunityIcons name="cart-off" size={54} color="#CBD5E1" />
                  <Text style={styles.emptyTitle}>No orders found</Text>
                  <Text style={styles.emptySubtitle}>Try a different search or status filter.</Text>
                </AdminPanel>
              }
            />
          )}
        </View>
      </AdminShell>
    </>
  );
}

function formatTime(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginBottom: 16,
  },
  summaryCard: {
    minWidth: 160,
    flex: 1,
  },
  summaryIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  summaryLabel: {
    color: adminColors.textMuted,
    fontSize: 13,
    fontFamily: 'Montserrat-SemiBold',
    marginBottom: 4,
  },
  summaryValue: {
    color: adminColors.text,
    fontSize: 26,
    fontFamily: 'Montserrat-Bold',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  filterChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: adminColors.surface,
    borderWidth: 1,
    borderColor: adminColors.borderStrong,
  },
  filterChipActive: {
    backgroundColor: adminColors.navyDeep,
    borderColor: adminColors.navyDeep,
  },
  filterText: {
    color: adminColors.textMuted,
    fontSize: 12,
    fontFamily: 'Montserrat-SemiBold',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  listContent: {
    paddingBottom: 120,
  },
  columnWrap: {
    gap: 14,
  },
  cardOuter: {
    flex: 1,
    marginBottom: 14,
  },
  orderCard: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 18,
  },
  orderIdText: {
    color: adminColors.text,
    fontSize: 13,
    fontFamily: 'Montserrat-Bold',
  },
  timeText: {
    color: adminColors.textSoft,
    fontSize: 12,
    fontFamily: 'Montserrat-Regular',
    marginTop: 4,
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
  cardBody: {
    gap: 18,
    paddingVertical: 18,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: adminColors.border,
  },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  storeIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: adminColors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeInfo: {
    flex: 1,
  },
  storeName: {
    color: adminColors.text,
    fontSize: 15,
    fontFamily: 'Montserrat-Bold',
    marginBottom: 4,
  },
  itemCount: {
    color: adminColors.textMuted,
    fontSize: 12,
    fontFamily: 'Montserrat-Regular',
  },
  amountBlock: {
    backgroundColor: adminColors.surfaceSoft,
    borderRadius: 18,
    padding: 14,
  },
  amountLabel: {
    color: adminColors.textSoft,
    fontSize: 11,
    fontFamily: 'Montserrat-SemiBold',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  amountValue: {
    color: adminColors.navy,
    fontSize: 24,
    fontFamily: 'Montserrat-Bold',
  },
  cardFooter: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  viewDetailsText: {
    color: adminColors.navy,
    fontSize: 13,
    fontFamily: 'Montserrat-Bold',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 46,
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
  },
});
