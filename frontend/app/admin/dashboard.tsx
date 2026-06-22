import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AppImage from '@/components/AppImage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAdminDashboard } from '@/services/api';
import { getAdminOrders, getAdminStores } from '@/services/admin';
import AdminBottomNav from '@/components/AdminBottomNav';
import AdminScreenSkeleton from '@/components/admin/AdminSkeleton';

const STATUS_PILL: Record<string, { bg: string; text: string }> = {
  delivered:  { bg: '#DCFCE7', text: '#16A34A' },
  processing: { bg: '#DBEAFE', text: '#2563EB' },
  pending:    { bg: '#FEF3C7', text: '#D97706' },
  cancelled:  { bg: '#FEE2E2', text: '#DC2626' },
};

type DashboardStats = {
  totalUsers: number;
  totalBuyers: number;
  totalStores: number;
  totalOrders: number;
  totalRevenue: number;
  ordersGrowth: number;
  storesGrowth: number;
  usersGrowth: number;
  pendingDriverVerifications: number;
};

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalBuyers: 0,
    totalStores: 0,
    totalOrders: 0,
    totalRevenue: 0,
    ordersGrowth: 0,
    storesGrowth: 0,
    usersGrowth: 0,
    pendingDriverVerifications: 0,
  });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [topStores, setTopStores] = useState<any[]>([]);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const dashRes = await getAdminDashboard();

      if (dashRes?.success && dashRes.stats) {
        setStats(prev => ({ ...prev, ...dashRes.stats }));
      }
      try {
        const [ordersRes, storesRes] = await Promise.all([
          getAdminOrders({ limit: '5', sortBy: 'created_at', sortDir: 'desc' }),
          getAdminStores({ limit: '3', sortBy: 'total_revenue', sortDir: 'desc' }),
        ]);
        const ordersArr = Array.isArray(ordersRes?.orders) ? ordersRes.orders : Array.isArray(ordersRes) ? ordersRes : [];
        const storesArr = Array.isArray(storesRes?.stores) ? storesRes.stores : Array.isArray(storesRes) ? storesRes : [];
        setRecentOrders(ordersArr.slice(0, 5));
        setTopStores(storesArr.slice(0, 3));
      } catch { /* non-critical */ }
    } catch (error) {
      console.error('Failed to load admin dashboard', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Metric cards ────────────────────────────────────────────────────────────
  const metricCards = useMemo(
    () => [
      {
        label: 'Revenue',
        value: formatCurrency(stats.totalRevenue),
        route: '/admin/revenue',
        icon: 'wallet-outline',
        iconBg: '#DCFCE7',
        iconColor: '#16A34A',
        accentColor: '#16A34A',
      },
      {
        label: 'Orders',
        value: (stats.totalOrders ?? 0).toLocaleString(),
        route: '/admin/orders',
        icon: 'cart-outline',
        iconBg: '#DBEAFE',
        iconColor: '#2563EB',
        accentColor: '#2563EB',
      },
      {
        label: 'Buyers',
        value: (stats.totalBuyers ?? 0).toLocaleString(),
        route: '/admin/users',
        icon: 'people-outline',
        iconBg: '#EDE9FE',
        iconColor: '#7C3AED',
        accentColor: '#7C3AED',
      },
      {
        label: 'Stores',
        value: (stats.totalStores ?? 0).toLocaleString(),
        route: '/admin/stores',
        icon: 'storefront-outline',
        iconBg: '#FEF3C7',
        iconColor: '#D97706',
        accentColor: '#D97706',
      },
      {
        label: 'Driver Verif.',
        value: String(stats.pendingDriverVerifications ?? 0),
        route: '/admin/driverVerifications',
        icon: 'car-outline',
        iconBg: '#F1F5F9',
        iconColor: '#475569',
        accentColor: '#475569',
      },
      {
        label: 'Ads',
        value: 'Review',
        route: '/admin/ads',
        icon: 'image-outline',
        iconBg: '#CFFAFE',
        iconColor: '#0891B2',
        accentColor: '#0891B2',
      },
    ],
    [stats],
  );

  if (loading && !refreshing) {
    return (
      <>
        <StatusBar style="light" />
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <AdminScreenSkeleton metrics={6} rows={3} cards={2} />
          <AdminBottomNav />
        </SafeAreaView>
      </>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.screen}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor="#1E88E5" />}
        >


          {/* HERO */}
          <LinearGradient
            colors={['#01217B', '#0C2E8A', '#0E5E1A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.heroTopRow}>
              <AppImage source={require('@/assets/images/iconwhite.png')} style={styles.brandLogo} />
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
            <Text style={styles.heroGreeting}>Welcome back, Admin</Text>
            <Text style={styles.heroDate}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
          </LinearGradient>

          {/* BODY */}
          <View style={styles.body}>

            {/* MAIN COLUMN */}
            <View style={styles.mainCol}>

              {/* METRIC CARDS */}
              <View style={styles.metricGrid}>
                {metricCards.map((item) => (
                  <TouchableOpacity
                    key={item.label}
                    style={[styles.metricCard, { flexBasis: '47%', flexGrow: 1 }]}
                    onPress={() => router.push(item.route as any)}
                    activeOpacity={0.9}
                  >
                    <View style={styles.metricTop}>
                      <View style={[styles.metricIcon, { backgroundColor: item.iconBg }]}>
                        <Ionicons
                          name={item.icon as React.ComponentProps<typeof Ionicons>['name']}
                          size={16}
                          color={item.iconColor}
                        />
                      </View>
                    </View>
                    <Text style={styles.metricValue} numberOfLines={1}>{item.value}</Text>
                    <Text style={styles.metricLabel} numberOfLines={1}>{item.label}</Text>
                    <View style={[styles.metricBar, { backgroundColor: item.accentColor }]} />
                  </TouchableOpacity>
                ))}
              </View>

              {/* RECENT ORDERS */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleRow}>
                    <Ionicons name="receipt-sharp" size={16} color="#0C1559" />
                    <Text style={styles.cardTitle}>Recent Orders</Text>
                  </View>
                  <TouchableOpacity onPress={() => router.push('/admin/orders' as any)}>
                    <Text style={styles.cardLink}>View all</Text>
                  </TouchableOpacity>
                </View>
                {recentOrders.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>No recent orders</Text>
                  </View>
                ) : (
                  recentOrders.map((item: any, index: number) => {
                    const pill = STATUS_PILL[item.status] ?? STATUS_PILL.pending;
                    return (
                      <View
                        key={item.id || index}
                        style={[styles.rowItem, index === recentOrders.length - 1 && { borderBottomWidth: 0 }]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.rowTitle}>
                            #{item.order_number || item.id?.slice(0, 8)?.toUpperCase()}
                          </Text>
                          <Text style={styles.rowSub}>
                            {item.buyer?.full_name || item.user?.full_name || 'Customer'} · {item.order_items?.length ?? 1} item{(item.order_items?.length ?? 1) > 1 ? 's' : ''}
                          </Text>
                        </View>
                        <View style={[styles.pill, { backgroundColor: pill.bg }]}>
                          <Text style={[styles.pillText, { color: pill.text }]}>
                            {item.status || 'pending'}
                          </Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            </View>

            {/* SIDE COLUMN */}
            <View style={styles.sideCol}>

              {/* TOP STORES */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleRow}>
                    <Ionicons name="storefront-outline" size={16} color="#0C1559" />
                    <Text style={styles.cardTitle}>Top Stores</Text>
                  </View>
                  <TouchableOpacity onPress={() => router.push('/admin/stores' as any)}>
                    <Text style={styles.cardLink}>View all</Text>
                  </TouchableOpacity>
                </View>
                {topStores.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>No store data yet</Text>
                  </View>
                ) : (
                  topStores.map((store: any, index: number) => (
                    <View
                      key={store.id || index}
                      style={[styles.rowItem, index === topStores.length - 1 && { borderBottomWidth: 0 }]}
                    >
                      <View style={styles.storeAvatar}>
                        <Text style={styles.storeAvatarLetter}>
                          {(store.store_name || store.name || 'S').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowTitle}>{store.store_name || store.name || 'Store'}</Text>
                        <Text style={styles.rowSub}>
                          {store.total_orders ?? 0} orders · ₵{Number(store.total_revenue ?? 0).toLocaleString()}
                        </Text>
                      </View>
                      {store.rating ? <Text style={styles.storeRating}>{store.rating}★</Text> : null}
                    </View>
                  ))
                )}
              </View>

              {/* ALERTS */}
              <View style={styles.card}>
                <View style={styles.cardTitleRow}>
                  <Ionicons name="alert-circle-outline" size={16} color="#0C1559" />
                  <Text style={styles.cardTitle}>Alerts</Text>
                </View>
                <View style={styles.alertItem}>
                  <View style={styles.alertIcon}>
                    <Ionicons name="bicycle-outline" size={16} color="#D97706" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>
                      {stats.pendingDriverVerifications} driver{stats.pendingDriverVerifications !== 1 ? 's' : ''} awaiting approval
                    </Text>
                    <Text style={styles.rowSub}>Documents submitted</Text>
                  </View>
                  <TouchableOpacity onPress={() => router.push('/admin/driverVerifications' as any)}>
                    <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                  </TouchableOpacity>
                </View>
              </View>

            </View>
          </View>
        </ScrollView>
        <AdminBottomNav />
      </SafeAreaView>
    </>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatCurrency(value: number) {
  return `₵${Number(value || 0).toLocaleString()}`;
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F7FA' },
  safeArea: { flex: 1, backgroundColor: '#F5F7FA' },
  screen: { paddingBottom: 40 },

  // Hero
  hero: { marginHorizontal: 12, marginTop: 8, borderRadius: 20, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 20, gap: 12 },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroBrand: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  brandLogo: { width: 110, height: 28, resizeMode: 'contain' },
  heroIcons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  topActionBubble: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  avatarCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#E5EEFF', alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: '#0B2060', fontSize: 18, fontFamily: 'Montserrat-Bold' },
  heroGreeting: { color: '#FFFFFF', fontSize: 18, fontFamily: 'Montserrat-Bold', letterSpacing: 0.2 },
  heroDate: { color: 'rgba(255,255,255,0.65)', fontSize: 12, fontFamily: 'Montserrat-Regular' },

  // Body layout
  body: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 120, gap: 12 },
  mainCol: { gap: 12 },
  sideCol: { gap: 12 },

  // Metric cards
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, minWidth: 120, borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#0C1559', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2, overflow: 'hidden' },
  metricTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  metricIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  metricGrowth: { fontSize: 11, fontFamily: 'Montserrat-SemiBold' },
  metricValue: { color: '#0F172A', fontSize: 20, fontFamily: 'Montserrat-Bold', marginBottom: 3 },
  metricLabel: { color: '#64748B', fontSize: 11, fontFamily: 'Montserrat-SemiBold', marginBottom: 10 },
  metricBar: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3 },

  // Cards
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#0C1559', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  cardTitle: { color: '#0C1559', fontSize: 15, fontFamily: 'Montserrat-Bold' },
  cardLink: { color: '#2563EB', fontSize: 13, fontFamily: 'Montserrat-SemiBold' },

  // Row items
  rowItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  rowTitle: { color: '#0F172A', fontSize: 13, fontFamily: 'Montserrat-SemiBold', marginBottom: 2 },
  rowSub: { color: '#94A3B8', fontSize: 11, fontFamily: 'Montserrat-Regular' },

  // Status pill
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  pillText: { fontSize: 11, fontFamily: 'Montserrat-SemiBold', textTransform: 'capitalize' },

  // Store
  storeAvatar: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#EDE9FE', alignItems: 'center', justifyContent: 'center' },
  storeAvatarLetter: { color: '#7C3AED', fontSize: 14, fontFamily: 'Montserrat-Bold' },
  storeRating: { color: '#D97706', fontSize: 12, fontFamily: 'Montserrat-SemiBold' },

  // Alert
  alertItem: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  alertIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' },

  // Empty state
  emptyState: { paddingVertical: 20, alignItems: 'center' },
  emptyText: { color: '#94A3B8', fontSize: 13, fontFamily: 'Montserrat-Regular' },
});
