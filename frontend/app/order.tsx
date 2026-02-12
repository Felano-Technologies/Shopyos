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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { getMyOrders } from '@/services/api';

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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);

  const fetchOrders = async () => {
    try {
      const data = await getMyOrders();
      if (data.success) {
        const mappedOrders = data.orders.map((o: any) => ({
          id: o.id,
          orderNumber: o.order_number,
          totalAmount: o.payments?.[0]?.amount ? parseFloat(o.payments[0].amount) : 0,
          date: o.created_at,
          status: o.status.charAt(0).toUpperCase() + o.status.slice(1),
          itemsCount: o.order_items?.length || 0,
          storeName: o.store?.store_name || 'Shopyos Store'
        }));
        setOrders(mappedOrders);
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "pending": return { color: "#B45309", bg: "#FEF3C7", icon: "time-outline" };
      case "delivered": return { color: "#15803D", bg: "#DCFCE7", icon: "checkmark-circle-outline" };
      case "processing": return { color: "#1D4ED8", bg: "#DBEAFE", icon: "sync-outline" };
      case "in_transit": return { color: "#7C3AED", bg: "#F3E8FF", icon: "bicycle-outline" };
      case "cancelled": return { color: "#B91C1C", bg: "#FEE2E2", icon: "close-circle-outline" };
      default: return { color: "#6B7280", bg: "#F3F4F6", icon: "help-circle-outline" };
    }
  };

  const renderOrder = ({ item }: { item: Order }) => {
    const { color, bg, icon } = getStatusBadge(item.status);

    return (
      <TouchableOpacity
        style={styles.orderCard}
        onPress={() => router.push(`/order/${item.id}` as any)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.storeNameRow}>
            <MaterialCommunityIcons name="store-outline" size={16} color="#0C1559" />
            <Text style={styles.storeName}>{item.storeName}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: bg }]}>
            <Ionicons name={icon as any} size={12} color={color} style={{ marginRight: 4 }} />
            <Text style={[styles.statusText, { color: color }]}>{item.status}</Text>
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

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#0C1559" />
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          renderItem={renderOrder}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="package-variant-closed" size={80} color="#CBD5E1" />
              <Text style={styles.emptyText}>You haven't placed any orders yet.</Text>
              <TouchableOpacity style={styles.shopBtn} onPress={() => router.push('/home')}>
                <Text style={styles.shopBtnText}>Start Shopping</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { paddingBottom: 20, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10 },
  backBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12 },
  headerTitle: { fontSize: 20, fontFamily: 'Montserrat-Bold', color: '#FFF' },
  listContent: { padding: 20, paddingBottom: 40 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  orderCard: { backgroundColor: '#FFF', borderRadius: 20, marginBottom: 16, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 4 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  storeNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  storeName: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: '#64748B' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12 },
  statusText: { fontSize: 11, fontFamily: 'Montserrat-Bold', textTransform: 'uppercase' },
  cardBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#F1F5F9' },
  orderInfo: { gap: 4 },
  orderNumberText: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
  dateText: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: '#94A3B8' },
  amountInfo: { alignItems: 'flex-end', gap: 2 },
  totalLabel: { fontSize: 11, fontFamily: 'Montserrat-Medium', color: '#94A3B8' },
  amountText: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#84cc16' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  itemsCount: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: '#64748B' },
  viewDetailsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewDetailsText: { fontSize: 13, fontFamily: 'Montserrat-SemiBold', color: '#0C1559' },
  emptyState: { alignItems: 'center', marginTop: 100 },
  emptyText: { marginTop: 16, fontSize: 16, fontFamily: 'Montserrat-Medium', color: '#64748B', marginBottom: 24, textAlign: 'center' },
  shopBtn: { paddingVertical: 12, paddingHorizontal: 24, backgroundColor: '#0C1559', borderRadius: 20 },
  shopBtnText: { color: '#FFF', fontFamily: 'Montserrat-Bold' },
});

export default OrdersScreen;