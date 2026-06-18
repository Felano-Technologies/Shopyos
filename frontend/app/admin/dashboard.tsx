import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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

function getStatusStyle(statusStyle: string) {
  if (statusStyle === 'paid') return styles.statusPaid;
  if (statusStyle === 'shipped') return styles.statusShipped;
  return styles.statusPending;
}


type DashboardStats = {
  totalUsers: number;
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
  const loadData = useCallback(async () => {
    try {
      const dashRes = await getAdminDashboard();

      if (dashRes?.success && dashRes.stats) {
        setStats(dashRes.stats);
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

  // ── Metric cards (2-column grid) ───────────────────────────────────────────
  const metricCards = useMemo(
    () => [
      {
        label: 'Revenue',
        value: formatCurrency(stats.totalRevenue),
        subValue: '+4.04%',
        subPositive: true,
        route: '/admin/revenue',
        icon: 'wallet-outline',
      },
      {
        label: 'Orders',
        value: stats.totalOrders.toLocaleString(),
        subValue: '+3.76%',
        subPositive: true,
        route: '/admin/orders',
        icon: 'cart-outline',
      },
      {
        label: 'Customers',
        value: stats.totalUsers.toLocaleString(),
        subValue: '+4.04%',
        subPositive: true,
        route: '/admin/users',
        icon: 'people-outline',
      },
      {
        label: 'Conversion',
        value: '3.2%',
        subValue: '-2.00%',
        subPositive: false,
        route: '/admin/orders',
        icon: 'eye-outline',
      },
      {
        label: 'Driver Verification',
        value: `${stats.pendingDriverVerifications ?? 0} pending reviews`,
        subValue: '',
        subPositive: true,
        route: '/admin/driverVerifications',
        icon: 'car-outline',
      },
      {
        label: 'Ads Approval',
        value: 'Review active campaigns',
        subValue: '',
        subPositive: true,
        route: '/admin/ads',
        icon: 'image-outline',
      },
    ],
    [stats],
  );

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
          >
          {/* ── HERO PANEL ───────────────────────────────────────────────── */}
          <LinearGradient
            colors={['#01217B', '#85CC16']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.heroPanel}
          >
            <View style={styles.heroTopRow}>
              <View style={styles.heroBrand}>
                <AppImage source={require('@/assets/images/iconwhite.png')} style={styles.brandLogo} />
              </View>

              <View style={styles.heroIcons}>
                <TouchableOpacity style={styles.topActionBubble}>
                  <Ionicons name="headset-outline" size={18} color="#FFFFFF" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.topActionBubble}>
                  <Ionicons name="notifications-outline" size={18} color="#FFFFFF" />
                </TouchableOpacity>

                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarLetter}>A</Text>
                </View>
              </View>
            </View>

            {/* Greeting */}
            <Text style={styles.greeting}>WELCOME BACK ADMIN</Text>
          </LinearGradient>

          {/* ── PAGE HEADING ─────────────────────────────────────────────── */}
          <View style={styles.pageHead}>
            <Text style={styles.pageTitle}>Dashboard</Text>
            <Text style={styles.pageDate}>{new Date().toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}</Text>
          </View>

          {/* ── METRIC CARDS GRID — 2 per row ────────────────────────────── */}
          {[0, 2, 4].map((rowStart) => (
            <View key={rowStart} style={styles.metricRow}>
              {metricCards.slice(rowStart, rowStart + 2).map((item) => (
                <TouchableOpacity
                  key={item.label}
                  style={styles.metricCardWrap}
                  onPress={() => router.push(item.route as any)}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={['#081059', '#1498EF']}
                    style={styles.metricCard}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    {/* Icon + Label row */}
                    <View style={styles.metricHeaderRow}>
                      <Ionicons
                        name={item.icon as React.ComponentProps<typeof Ionicons>['name']}
                        size={14}
                        color="#FFFFFF"
                      />
                      <Text style={styles.metricLabel} numberOfLines={1}>
                        {item.label}
                      </Text>
                    </View>

                    {/* Main value */}
                    <Text style={styles.metricValue} numberOfLines={2}>
                      {item.value}
                    </Text>

                    {/* Growth badge */}
                    {item.subValue ? (
                      <View style={styles.metricGrowthRow}>
                        <View
                          style={{
                            width: 18,
                            height: 18,
                            alignItems: 'center',
                            justifyContent: 'center',
                            transform: [{ rotate: item.subPositive ? '15deg' : '-15deg' }],
                          }}
                        >
                          {/* stacked icons: larger one behind to give a bolder look */}
                          <Ionicons
                            name={item.subPositive ? 'arrow-up' : 'arrow-down'}
                            size={14}
                            color={item.subPositive ? '#85CC16' : '#e85050'}
                            style={{ position: 'absolute', opacity: 0.95 }}
                          />
                          <Ionicons
                            name={item.subPositive ? 'arrow-up' : 'arrow-down'}
                            size={12}
                            color={item.subPositive ? '#85CC16' : '#e85050'}
                          />
                        </View>
                        <Text
                          style={[
                            styles.metricGrowth,
                            { color: item.subPositive ? '#A8E063' : '#e85050' },
                          ]}
                        >
                          {item.subValue}
                        </Text>
                      </View>
                    ) : null}
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </View>
          ))}

          {/* ── RECENT ORDERS ─────────────────────────────────────────────── */}
          <View style={styles.cardSection}>
            <View style={styles.sectionHeaderRow}>
              {/* Orders icon + title */}
              <View style={styles.sectionTitleRow}>
                <Ionicons name="receipt-sharp" size={20} color="#081059" />
                <Text style={styles.sectionTitle}>Recent orders</Text>
              </View>
              <TouchableOpacity onPress={() => router.push('/admin/orders' as any)}>
                <Text style={styles.sectionLink}>View all</Text>
              </TouchableOpacity>
            </View>

            {recentOrders.length === 0 ? (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <Text style={styles.orderMeta}>No recent orders</Text>
              </View>
            ) : (
              recentOrders.map((item: any, index: number) => (
                <View
                  key={item.id || index}
                  style={[
                    styles.orderRow,
                    index === recentOrders.length - 1 && { borderBottomWidth: 0 },
                  ]}
                >
                  <View>
                    <Text style={styles.orderId}>#{item.order_number || item.id?.slice(0, 8)?.toUpperCase()}</Text>
                    <Text style={styles.orderMeta}>
                      {item.buyer?.full_name || item.user?.full_name || 'Customer'} · {item.order_items?.length ?? 1} item{(item.order_items?.length ?? 1) > 1 ? 's' : ''}
                    </Text>
                  </View>
                  <View style={[styles.statusPill, getStatusStyle(item.status || 'pending')]}>
                    <Text style={styles.statusLabel}>{item.status || 'Pending'}</Text>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* ── TOP STORES ────────────────────────────────────────────────── */}
          <View style={styles.cardSection}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleRow}>
                {/*
                  INSERT TOP STORES ICON IMAGE HERE if needed, e.g.:
                  <Image source={require('@/assets/icons/store-icon.png')} style={styles.sectionIcon} />
                */}
                <Ionicons name="storefront-outline" size={20} color="#081059" />
                <Text style={styles.sectionTitle}>Top Stores</Text>
              </View>
              <TouchableOpacity onPress={() => router.push('/admin/stores' as any)}>
                <Text style={styles.sectionLink}>View all</Text>
              </TouchableOpacity>
            </View>

            {topStores.length === 0 ? (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <Text style={styles.orderMeta}>No store data yet</Text>
              </View>
            ) : (
              topStores.map((store: any, index: number, arr: any[]) => (
                <View
                  key={store.id || index}
                  style={[
                    styles.storeRow,
                    index < arr.length - 1 && styles.storeRowBorder,
                  ]}
                >
                  <View>
                    <Text style={styles.storeName}>{store.store_name || store.name || 'Store'}</Text>
                    <Text style={styles.storeMeta}>
                      {store.total_orders ?? store.orders ?? 0} orders · ₵{Number(store.total_revenue ?? store.revenue ?? 0).toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.storeScore}>
                    <Text style={styles.storeScoreText}>{store.rating ? store.rating + ' ★' : 'N/A'}</Text>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* ── ALERTS ────────────────────────────────────────────────────── */}
          <View style={styles.cardSection}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="information-circle-outline" size={20} color="#081059" />
              <Text style={styles.sectionTitle}>Alerts</Text>
            </View>

            <View style={styles.alertRow}>
              {/*
                INSERT RIDER ICON IMAGE HERE if you have one, e.g.:
                <Image source={require('@/assets/icons/rider.png')} style={styles.alertIcon} />
              */}
              <Ionicons name="bicycle-outline" size={20} color="#000" style={{ marginRight: 8 }} />
              <View>
                <Text style={styles.alertTitle}>{stats.pendingDriverVerifications} driver{stats.pendingDriverVerifications !== 1 ? 's' : ''} awaiting approval</Text>
                <Text style={styles.alertSub}>Documents submitted today</Text>
              </View>
            </View>
          </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatCurrency(value: number) {
  return `₵${Number(value || 0).toLocaleString()}`;
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  canvas: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
  },
  scrollView: {
    flex: 1,
  },
  screen: {
    flexGrow: 1,
    paddingBottom: 220,
    paddingTop: 0,
  },

  // ── Hero ──────────────────────────────────────────────────────────────────
  heroPanel: {
    borderRadius: 36,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 24,
    marginBottom: 0,
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
  // If you use an Image logo:
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
  greeting: {
    fontSize: 22,
    fontFamily: 'Montserrat-Bold',
    color: '#FFFFFF',
    letterSpacing: 0.6,
    textAlign: 'center',
    marginTop: 18,
  },

  // ── Page heading ─────────────────────────────────────────────────────────
  pageHead: {
    paddingHorizontal: 8,
    paddingTop: 18,
    paddingBottom: 10,
  },
  pageTitle: {
    color: '#081059',
    fontSize: 24,
    fontFamily: 'Montserrat-Bold',
  },
  pageDate: {
    color: '#081059',
    fontSize: 14,
    fontFamily: 'Montserrat-Regular',
    marginTop: 2,
  },

  // ── Metric grid ──────────────────────────────────────────────────────────
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 4,
    justifyContent: 'center',
  },
  metricRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  metricCardWrap: {
    width: '48.5%',
  },
  metricCard: {
    width: '100%',
    minHeight: 82,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  metricHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  metricLabel: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'Montserrat-SemiBold',
    flexShrink: 1,
  },
  metricValue: {
    color: '#FFFFFF',
    fontSize: 17,
    fontFamily: 'Montserrat-Bold',
    lineHeight: 22,
  },
  metricGrowthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 4,
  },
  metricGrowth: {
    fontSize: 10,
    fontFamily: 'Montserrat-SemiBold',
  },

  // ── Card sections (orders, stores, alerts) ───────────────────────────────
  cardSection: {
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 14,
    width: '100%',
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
    marginBottom: 10,
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
  // If you use an image icon next to section title:
  sectionIcon: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
  },

  // ── Order rows ───────────────────────────────────────────────────────────
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#D9D9D9',
  },
  orderId: {
    color: '#111827',
    fontSize: 14,
    fontFamily: 'Montserrat-SemiBold',
    marginBottom: 2,
  },
  orderMeta: {
    color: '#9CA3AF',
    fontSize: 12,
    fontFamily: 'Montserrat-Regular',
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPaid: {
    backgroundColor: '#B2BF9E',
  },
  statusShipped: {
    backgroundColor: '#87CFFF',
  },
  statusPending: {
    backgroundColor: '#D9B889',
  },
  statusLabel: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'Montserrat-SemiBold',
  },

  // ── Store rows ───────────────────────────────────────────────────────────
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  storeRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#D9D9D9',
  },
  storeName: {
    color: '#000000',
    fontSize: 15,
    fontFamily: 'Montserrat-Bold',
  },
  storeMeta: {
    color: '#00000',
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
    minWidth: 50,
  },
  storeScoreText: {
    color: '#2B4501',
    fontSize: 11,
    fontFamily: 'Montserrat-medium',
  },

  // ── Alert row ────────────────────────────────────────────────────────────
  alertRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  // If you use an image icon in alerts:
  alertIcon: {
    width: 22,
    height: 22,
    resizeMode: 'contain',
    marginRight: 10,
  },
  alertTitle: {
    color: '#111827',
    fontSize: 14,
    fontFamily: 'Montserrat-SemiBold',
  },
  alertSub: {
    color: '#9CA3AF',
    fontSize: 12,
    fontFamily: 'Montserrat-Regular',
    marginTop: 2,
  },

  // ── Bottom tab bar ────────────────────────────────────────────────────────
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 72,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    paddingBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 10,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: 4,
  },
  tabActiveBubble: {
    backgroundColor: '#081059',
    borderRadius: 20,
    padding: 10,
  },
  tabLabel: {
    fontSize: 10,
    fontFamily: 'Montserrat-Regular',
    color: '#9CA3AF',
  },
  tabLabelActive: {
    color: '#081059',
    fontFamily: 'Montserrat-SemiBold',
  }
});


