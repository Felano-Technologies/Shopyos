import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { adminColors } from '@/components/admin/adminTheme';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { getAdminOrders } from '@/services/api';
import { updateOrderStatus } from '@/services/orders';
import { exportAdminData } from '@/utils/adminExport';

const HEADER_GRADIENT = ['#0C1559', '#1e3a8a'] as [string, string];

const STATUS_SEQUENCE = [
  'pending',
  'processing',
  'ready_for_pickup',
  'in_transit',
  'delivered',
] as const;

type OrderStatus = (typeof STATUS_SEQUENCE)[number] | 'cancelled';

function getNextStatus(current: string): OrderStatus | null {
  const idx = STATUS_SEQUENCE.indexOf(current as any);
  if (idx === -1 || idx === STATUS_SEQUENCE.length - 1) return null;
  return STATUS_SEQUENCE[idx + 1];
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: '#FEF3C7', text: '#92400E' },
  processing: { bg: '#EFF6FF', text: '#1D4ED8' },
  ready_for_pickup: { bg: '#F0FDF4', text: '#166534' },
  in_transit: { bg: '#EDE9FE', text: '#5B21B6' },
  delivered: { bg: '#D1FAE5', text: '#065F46' },
  cancelled: { bg: '#FEE2E2', text: '#991B1B' },
};

export default function AdminDeliveries() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadOrders = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const res = await getAdminOrders({ limit: '50' } as any);
      const list = Array.isArray(res?.orders) ? res.orders : Array.isArray(res) ? res : [];
      setOrders(list);
    } catch (e: any) {
      CustomInAppToast.show({ type: 'error', title: 'Error', message: e.message });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadOrders(); }, []);

  const handleAdvance = async (orderId: string, nextStatus: OrderStatus) => {
    try {
      setUpdatingId(orderId);
      await updateOrderStatus(orderId, nextStatus);
      setOrders((prev) =>
        prev.map((o) => ((o.id || o._id) === orderId ? { ...o, status: nextStatus } : o))
      );
      CustomInAppToast.show({ type: 'success', title: 'Status Updated', message: `Order moved to ${nextStatus.replace(/_/g, ' ')}.` });
    } catch (e: any) {
      CustomInAppToast.show({ type: 'error', title: 'Error', message: e.message });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCancel = async (orderId: string) => {
    try {
      setUpdatingId(orderId);
      await updateOrderStatus(orderId, 'cancelled');
      setOrders((prev) =>
        prev.map((o) => ((o.id || o._id) === orderId ? { ...o, status: 'cancelled' } : o))
      );
      CustomInAppToast.show({ type: 'success', title: 'Cancelled', message: 'Order has been cancelled.' });
    } catch (e: any) {
      CustomInAppToast.show({ type: 'error', title: 'Error', message: e.message });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleExport = async () => {
    try {
      await exportAdminData('orders', {}, 'xlsx');
      CustomInAppToast.show({ type: 'success', title: 'Export Started', message: 'Orders export initiated.' });
    } catch (e: any) {
      CustomInAppToast.show({ type: 'error', title: 'Export Failed', message: e.message });
    }
  };

  const renderOrder = ({ item }: { item: any }) => {
    const orderId = item.id || item._id || '';
    const orderNumber = item.order_number || orderId.slice(0, 8).toUpperCase();
    const storeName = item.store?.store_name || item.store_name || 'Unknown Store';
    const buyerName = item.buyer?.full_name || item.buyer_name || 'Unknown Buyer';
    const status: string = item.status || 'pending';
    const nextStatus = getNextStatus(status);
    const statusColor = STATUS_COLORS[status] || STATUS_COLORS.pending;
    const isUpdating = updatingId === orderId;

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.orderNumber}>#{orderNumber}</Text>
            <Text style={styles.storeName}>{storeName}</Text>
            <Text style={styles.buyerName}>{buyerName}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
            <Text style={[styles.statusText, { color: statusColor.text }]}>
              {status.replace(/_/g, ' ').toUpperCase()}
            </Text>
          </View>
        </View>

        {status !== 'delivered' && status !== 'cancelled' && (
          <View style={styles.cardActions}>
            {nextStatus && (
              <TouchableOpacity
                style={styles.advanceBtn}
                onPress={() => handleAdvance(orderId, nextStatus)}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="arrow-forward-circle-outline" size={15} color="#fff" />
                    <Text style={styles.advanceBtnText}>
                      Move to {nextStatus.replace(/_/g, ' ')}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.cancelLink}
              onPress={() => handleCancel(orderId)}
              disabled={isUpdating}
            >
              <Text style={styles.cancelLinkText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <LinearGradient
          colors={HEADER_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.header}
        >
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Deliveries</Text>
            <Text style={styles.headerSubtitle}>Manage order statuses</Text>
          </View>
          <TouchableOpacity style={styles.exportBtn} onPress={handleExport}>
            <Ionicons name="download-outline" size={20} color="#fff" />
          </TouchableOpacity>
        </LinearGradient>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#0C1559" />
          </View>
        ) : (
          <FlatList
            data={orders}
            keyExtractor={(item) => item.id || item._id || Math.random().toString()}
            renderItem={renderOrder}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => loadOrders(true)} tintColor="#0C1559" />
            }
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Ionicons name="cube-outline" size={48} color={adminColors.textMuted} />
                <Text style={styles.emptyTitle}>No orders found</Text>
                <Text style={styles.emptyText}>No delivery orders to display.</Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#E9EFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 18,
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  headerTitle: { color: '#fff', fontSize: 20, fontFamily: 'Montserrat-Bold' },
  headerSubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontFamily: 'Montserrat-Regular', marginTop: 2 },
  exportBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#0B2060',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  orderNumber: { color: '#1D2B73', fontSize: 15, fontFamily: 'Montserrat-Bold', marginBottom: 3 },
  storeName: { color: '#1D2B73', fontSize: 13, fontFamily: 'Montserrat-SemiBold', marginBottom: 2 },
  buyerName: { color: adminColors.textMuted, fontSize: 12, fontFamily: 'Montserrat-Regular' },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  statusText: { fontSize: 9, fontFamily: 'Montserrat-Bold', letterSpacing: 0.4 },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  advanceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0C1559',
    borderRadius: 12,
    paddingVertical: 10,
    minHeight: 38,
  },
  advanceBtnText: { color: '#fff', fontFamily: 'Montserrat-SemiBold', fontSize: 12 },
  cancelLink: { paddingHorizontal: 12, paddingVertical: 10 },
  cancelLinkText: { color: '#DC2626', fontFamily: 'Montserrat-SemiBold', fontSize: 13 },
  emptyWrap: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { color: '#1D2B73', fontSize: 18, fontFamily: 'Montserrat-Bold', marginTop: 12, marginBottom: 6 },
  emptyText: { color: adminColors.textMuted, fontSize: 13, fontFamily: 'Montserrat-Regular' },
});
