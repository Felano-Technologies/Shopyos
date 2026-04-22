import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  Dimensions, RefreshControl, Image, ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import BusinessBottomNav from '@/components/BusinessBottomNav';
import { router } from 'expo-router';
import { getStoreOrders, storage } from '@/services/api';
import { useOnboarding } from '@/context/OnboardingContext';
import { SpotlightTour } from '@/components/ui/SpotlightTour';
import { BusinessOrdersSkeleton } from '@/components/skeletons/BusinessOrdersSkeleton';
import { useSellerGuard } from '@/hooks/useSellerGuard';

const { width: SW } = Dimensions.get('window');
const SCALE = Math.min(Math.max(SW / 390, 0.85), 1.15);
const rs = (n: number) => Math.round(n * SCALE);
const rf = (n: number) => Math.round(n * Math.min(SCALE, 1.1));

const C = {
  bg:      '#F1F5F9',
  navy:    '#0C1559',
  navyMid: '#1e3a8a',
  lime:    '#84cc16',
  limeText:'#1a2e00',
  card:    '#FFFFFF',
  body:    '#0F172A',
  muted:   '#64748B',
  subtle:  '#94A3B8',
};

type FilterType = 'All' | 'Pending' | 'Processing' | 'Delivered' | 'Cancelled';

interface Order {
  id: string;
  customerName: string;
  itemsCount: number;
  totalAmount: number;
  date: string;
  status: 'Pending' | 'Processing' | 'Delivered' | 'Cancelled';
  orderNumber: string;
}

const STATUS_CFG: Record<string, { color: string; bg: string; bar: string; icon: any }> = {
  Pending:    { color: '#B45309', bg: '#FEF3C7', bar: '#F59E0B', icon: 'time-outline'            },
  Processing: { color: '#1D4ED8', bg: '#DBEAFE', bar: '#3B82F6', icon: 'sync-outline'            },
  Delivered:  { color: '#15803D', bg: '#DCFCE7', bar: '#84cc16', icon: 'checkmark-circle-outline'},
  Cancelled:  { color: '#B91C1C', bg: '#FEE2E2', bar: '#EF4444', icon: 'close-circle-outline'    },
};
const getStatus = (s: string) =>
  STATUS_CFG[s] ?? { color: '#6B7280', bg: '#F3F4F6', bar: '#9CA3AF', icon: 'help-circle-outline' };

const FILTERS: FilterType[] = ['All', 'Pending', 'Processing', 'Delivered', 'Cancelled'];

const OrdersScreen = () => {
  // ── ALL HOOKS FIRST — no early returns before this block ─────────────────
  const insets = useSafeAreaInsets();
  const { isChecking, isVerified } = useSellerGuard();

  const [filter,     setFilter]     = useState<FilterType>('All');
  const [refreshing, setRefreshing] = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [orders,     setOrders]     = useState<Order[]>([]);


  const fetchOrders = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const businessId = await storage.getItem('currentBusinessId');
      if (businessId) {
        const data = await getStoreOrders(businessId);
        if (data.success) {
          const mapped: Order[] = data.orders.map((o: any) => ({
            id:           o.id,
            orderNumber:  o.order_number,
            customerName: o.buyer?.user_profiles?.full_name || 'Guest',
            itemsCount:   o.order_items?.length || 0,
            totalAmount:  parseFloat(o.total_amount || 0),
            date:         o.created_at,
            status:       (o.status.charAt(0).toUpperCase() + o.status.slice(1)) as any,
          }));
          setOrders(mapped);
        }
      }
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setLoading(false);
    }
  }, []);


  useEffect(() => {
    fetchOrders(true);
  }, [fetchOrders]);

  // --- Onboarding & Refs ---
  const { startTour, markCompleted, isTourActive, activeScreen } = useOnboarding();
  const [layouts, setLayouts] = useState<any>({});
  const refRevenue = useRef<View>(null);
  const refStats = useRef<View>(null);
  const refFilters = useRef<ScrollView>(null);
  const refFirstItem = useRef<View>(null);

  const measureElement = (ref: any, key: string) => {
    if (ref.current) {
      ref.current.measureInWindow((x: number, y: number, width: number, height: number) => {
        setLayouts((prev: any) => ({ ...prev, [key]: { x, y, width, height } }));
      });
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchOrders(false);
    setRefreshing(false);
  };

  const filtered = filter === 'All' ? orders : orders.filter((o) => o.status === filter);

  useEffect(() => {
    if (!loading && isVerified) {
      const timer = setTimeout(() => {
        measureElement(refRevenue, 'revenue');
        measureElement(refStats, 'stats');
        measureElement(refFilters, 'filters');
        if (filtered.length > 0) measureElement(refFirstItem, 'list');
        startTour('business_orders');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [loading, isVerified, filtered.length, startTour]);
  // ── END OF HOOKS ──────────────────────────────────────────────────────────

  if (isChecking || !isVerified) {
    return (
      <View style={S.centred}>
        <ActivityIndicator size="large" color={C.navy} />
      </View>
    );
  }

  const onboardingSteps = [
    {
      targetLayout: layouts.revenue,
      title: 'Total Revenue',
      description: 'Track your store’s financial success at a glance.',
    },
    {
      targetLayout: layouts.stats,
      title: 'Order Status',
      description: 'Quickly see how many orders are pending, delivered, or cancelled.',
    },
    {
      targetLayout: layouts.filters,
      title: 'Search Filters',
      description: 'Filter your orders by status to focus on what needs your attention.',
    },
    ...(layouts.list ? [{
      targetLayout: layouts.list,
      title: 'Manage Orders',
      description: 'Tap any order to see full details and update its processing status.',
    }] : []),
  ].filter(s => !!s.targetLayout);

  const handleOnboardingComplete = () => {
    markCompleted('business_orders');
  };

  // Stats
  const totalRevenue    = orders.reduce((s, o) => s + o.totalAmount, 0);
  const totalOrders     = orders.length;
  const pendingCount    = orders.filter((o) => o.status === 'Pending').length;
  const deliveredCount  = orders.filter((o) => o.status === 'Delivered').length;
  const cancelledCount  = orders.filter((o) => o.status === 'Cancelled').length;

  // ── Order card ──────────────────────────────────────────────────────────────
  const renderOrder = ({ item }: { item: Order }) => {
    const cfg = getStatus(item.status);
    let dateStr = '';
    try { dateStr = format(new Date(item.date), 'MMM dd, yyyy · hh:mm a'); } catch {}

    return (
      <TouchableOpacity
        style={S.card}
        activeOpacity={0.85}
        onPress={() => router.push({ pathname: '/business/orderDetails', params: { id: item.id } })}
        ref={filtered[0]?.id === item.id ? refFirstItem : undefined}
        onLayout={filtered[0]?.id === item.id ? () => measureElement(refFirstItem, 'list') : undefined}
      >
        {/* Status accent bar */}
        <View style={[S.cardBar, { backgroundColor: cfg.bar }]} />

        <View style={S.cardInner}>
          {/* Top row */}
          <View style={S.cardTop}>
            <View style={S.orderIdRow}>
              <View style={S.orderIcon}>
                <Feather name="package" size={rs(13)} color={C.navy} />
              </View>
              <Text style={S.orderNum} numberOfLines={1}>{item.orderNumber}</Text>
            </View>
            <View style={[S.statusPill, { backgroundColor: cfg.bg }]}>
              <View style={[S.statusDot, { backgroundColor: cfg.color }]} />
              <Text style={[S.statusTxt, { color: cfg.color }]}>{item.status}</Text>
            </View>
          </View>

          {/* Info rows */}
          <View style={S.infoGrid}>
            <View style={S.infoItem}>
              <Text style={S.infoLbl}>Customer</Text>
              <Text style={S.infoVal} numberOfLines={1}>{item.customerName}</Text>
            </View>
            <View style={S.infoItem}>
              <Text style={S.infoLbl}>Items</Text>
              <Text style={S.infoVal}>{item.itemsCount}</Text>
            </View>
            <View style={S.infoItem}>
              <Text style={S.infoLbl}>Date</Text>
              <Text style={S.infoVal}>{dateStr}</Text>
            </View>
          </View>

          {/* Footer */}
          <View style={S.cardFoot}>
            <View>
              <Text style={S.footLbl}>Total</Text>
              <Text style={S.footAmt}>GH₵ {item.totalAmount.toFixed(2)}</Text>
            </View>
            <View style={S.detailsBtn}>
              <Text style={S.detailsBtnTxt}>View Details</Text>
              <Ionicons name="chevron-forward" size={rs(13)} color={C.limeText} />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ── Root ────────────────────────────────────────────────────────────────────
  return (
    <View style={S.root}>
      <StatusBar style="light" />

      {/* Watermark */}
      <View style={S.watermark}>
        <Image source={require('../../assets/images/splash-icon.png')} style={S.watermarkImg} />
      </View>

      <SafeAreaView style={{ flex: 1 }} edges={['left', 'right']}>
        {loading ? (
          <BusinessOrdersSkeleton />
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[S.scrollContent, { paddingBottom: rs(100) + insets.bottom }]}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#fff" />
            }
          >
            {/* ── Header ────────────────────────────────────────────────── */}
            <LinearGradient
              colors={[C.navy, C.navyMid]}
              style={[S.header, { paddingTop: insets.top + rs(16) }]}
            >
              <View style={S.hdrGlow} pointerEvents="none" />

              {/* Logo row */}
              <View style={S.hdrLogoRow}>
                <Image
                  source={require('../../assets/images/iconwhite.png')}
                  style={S.logo}
                  resizeMode="contain"
                />
                <View style={S.hdrBadge}>
                  <Text style={S.hdrBadgeTxt}>{totalOrders} orders</Text>
                </View>
              </View>

              {/* Revenue card */}
              <View style={S.revenueCard} ref={refRevenue} onLayout={() => measureElement(refRevenue, 'revenue')}>
                <View>
                  <Text style={S.revLbl}>Total Revenue</Text>
                  <Text style={S.revAmt}>GH₵ {totalRevenue.toFixed(2)}</Text>
                </View>
                <View style={S.revIcon}>
                  <MaterialCommunityIcons name="finance" size={rs(26)} color={C.lime} />
                </View>
              </View>

              <View style={S.hdrArc} />
            </LinearGradient>

            {/* ── Stat pills ────────────────────────────────────────────── */}
            <View style={S.statRow} ref={refStats} onLayout={() => measureElement(refStats, 'stats')}>
              {[
                { label: 'Total',     value: totalOrders,    color: C.navy    },
                { label: 'Pending',   value: pendingCount,   color: '#F59E0B' },
                { label: 'Delivered', value: deliveredCount, color: '#84cc16' },
                { label: 'Cancelled', value: cancelledCount, color: '#EF4444' },
              ].map((s) => (
                <View key={s.label} style={S.statCard}>
                  <Text style={[S.statNum, { color: s.color }]}>{s.value}</Text>
                  <Text style={S.statLbl}>{s.label}</Text>
                  <View style={[S.statBar, { backgroundColor: s.color }]} />
                </View>
              ))}
            </View>

            {/* ── Filter chips ──────────────────────────────────────────── */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={S.chipScrollView}
              contentContainerStyle={S.chipStrip}
              ref={refFilters}
              onLayout={() => measureElement(refFilters, 'filters')}
            >
              {FILTERS.map((f) => {
                const on = filter === f;
                return (
                  <TouchableOpacity
                    key={f}
                    style={[S.chip, on && S.chipOn]}
                    onPress={() => setFilter(f)}
                    activeOpacity={0.75}
                  >
                    <Text style={[S.chipTxt, on && S.chipTxtOn]}>{f}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Spacer between chips and cards */}
            <View style={{ height: rs(12) }} />

            {/* ── Order list ────────────────────────────────────────────── */}
            <View style={S.listWrap}>
              <FlatList
                data={filtered}
                keyExtractor={(item) => item.id}
                renderItem={renderOrder}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={{ height: rs(12) }} />}
                ListEmptyComponent={() => (
                  <View style={S.emptyWrap}>
                    <View style={S.emptyCircle}>
                      <Feather name="inbox" size={rs(36)} color={C.navy} />
                    </View>
                    <Text style={S.emptyTitle}>No {filter === 'All' ? '' : filter} orders</Text>
                    <Text style={S.emptySub}>
                      {filter === 'All'
                        ? 'Orders from your store will appear here.'
                        : `You have no ${filter.toLowerCase()} orders right now.`}
                    </Text>
                  </View>
                )}
              />
            </View>
          </ScrollView>
        )}

        <BusinessBottomNav />

        <SpotlightTour 
          visible={isTourActive && activeScreen === 'business_orders'} 
          steps={onboardingSteps}
          onComplete={handleOnboardingComplete}
        />
      </SafeAreaView>
    </View>
  );
};

// ─── Styles ────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  centred: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },

  watermark:    { position: 'absolute', bottom: 20, left: -20 },
  watermarkImg: { width: 130, height: 130, resizeMode: 'contain', opacity: 0.07 },

  scrollContent: { flexGrow: 1 },

  // ── Header ─────────────────────────────────────────────────────────────────
  header: {
    paddingHorizontal: rs(20),
    paddingBottom: rs(28),
    position: 'relative',
    elevation: 10,
    shadowColor: C.navy,
    shadowOffset: { width: 0, height: rs(8) },
    shadowOpacity: 0.2, shadowRadius: rs(16),
  },
  hdrGlow: {
    position: 'absolute', top: -rs(30), right: -rs(30),
    width: rs(160), height: rs(160), borderRadius: rs(80),
    backgroundColor: 'rgba(132,204,22,0.12)',
  },
  hdrLogoRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: rs(20),
  },
  logo:      { width: 110, height: 34 },
  hdrBadge: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: rs(20), paddingHorizontal: rs(12), paddingVertical: rs(5),
  },
  hdrBadgeTxt: { fontSize: rf(11), fontFamily: 'Montserrat-SemiBold', color: 'rgba(255,255,255,0.85)' },

  revenueCard: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: rs(16), padding: rs(16),
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  revLbl: { fontSize: rf(12), fontFamily: 'Montserrat-Medium', color: 'rgba(255,255,255,0.6)', marginBottom: rs(4) },
  revAmt: { fontSize: rf(26), fontFamily: 'Montserrat-Bold', color: '#fff' },
  revIcon: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    padding: rs(10), borderRadius: rs(12),
  },
  hdrArc: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: rs(24), backgroundColor: C.bg,
    borderTopLeftRadius: rs(24), borderTopRightRadius: rs(24),
  },

  // ── Stat row ───────────────────────────────────────────────────────────────
  statRow: {
    flexDirection: 'row', gap: rs(8),
    paddingHorizontal: rs(16), marginTop: rs(8), marginBottom: rs(16),
  },
  statCard: {
    flex: 1, backgroundColor: C.card, borderRadius: rs(14),
    padding: rs(12), alignItems: 'center',
    elevation: 3, shadowColor: C.navy,
    shadowOffset: { width: 0, height: rs(2) }, shadowOpacity: 0.06, shadowRadius: rs(8),
  },
  statNum: { fontSize: rf(20), fontFamily: 'Montserrat-Bold', marginBottom: rs(3) },
  statLbl: { fontSize: rf(9),  fontFamily: 'Montserrat-SemiBold', color: C.subtle, marginBottom: rs(6) },
  statBar: { width: rs(20), height: rs(3), borderRadius: rs(2) },

  // ── Filter chips ───────────────────────────────────────────────────────────
  chipScrollView: { flexGrow: 0, flexShrink: 0 },
  chipStrip: {
    paddingHorizontal: rs(16), paddingVertical: rs(4),
    gap: rs(8), flexDirection: 'row', flexGrow: 0, alignItems: 'center',
  },
  chip: {
    height: 36, paddingHorizontal: rs(16), borderRadius: 18,
    borderWidth: 0.5, borderColor: 'rgba(12,21,89,0.14)',
    backgroundColor: C.card, justifyContent: 'center', alignItems: 'center',
    elevation: 1, shadowColor: C.navy,
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: rs(2),
  },
  chipOn:    { backgroundColor: C.navy, borderColor: C.navy },
  chipTxt:   { fontSize: rf(12), fontFamily: 'Montserrat-SemiBold', color: C.muted },
  chipTxtOn: { color: '#fff' },

  // ── Order cards ────────────────────────────────────────────────────────────
  listWrap: { paddingHorizontal: rs(16) },
  card: {
    backgroundColor: C.card, borderRadius: rs(20), overflow: 'hidden',
    elevation: 4, shadowColor: C.navy,
    shadowOffset: { width: 0, height: rs(3) }, shadowOpacity: 0.07, shadowRadius: rs(12),
  },
  cardBar:   { height: rs(3) },
  cardInner: { padding: rs(14) },

  cardTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: rs(14),
  },
  orderIdRow: { flexDirection: 'row', alignItems: 'center', gap: rs(8), flex: 1, marginRight: rs(8) },
  orderIcon: {
    width: rs(30), height: rs(30), borderRadius: rs(10),
    backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center',
  },
  orderNum: { fontSize: rf(13), fontFamily: 'Montserrat-Bold', color: C.body, flex: 1 },

  statusPill: {
    height: 26, paddingHorizontal: rs(10), borderRadius: 13,
    flexDirection: 'row', alignItems: 'center', gap: rs(5), flexShrink: 0,
  },
  statusDot: { width: rs(6), height: rs(6), borderRadius: rs(3) },
  statusTxt: { fontSize: rf(10), fontFamily: 'Montserrat-Bold' },

  infoGrid: {
    backgroundColor: '#F8FAFC', borderRadius: rs(12),
    padding: rs(12), gap: rs(8), marginBottom: rs(14),
  },
  infoItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoLbl:  { fontSize: rf(11), fontFamily: 'Montserrat-Medium', color: C.subtle },
  infoVal:  { fontSize: rf(12), fontFamily: 'Montserrat-SemiBold', color: '#334155', maxWidth: '60%', textAlign: 'right' },

  cardFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footLbl:  { fontSize: rf(10), fontFamily: 'Montserrat-Medium', color: C.subtle, marginBottom: rs(2) },
  footAmt:  { fontSize: rf(18), fontFamily: 'Montserrat-Bold', color: C.navy },
  detailsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: rs(4),
    backgroundColor: C.navy, paddingVertical: rs(9), paddingHorizontal: rs(14), borderRadius: rs(12),
  },
  detailsBtnTxt: { fontSize: rf(12), fontFamily: 'Montserrat-Bold', color: C.lime },

  // ── Empty state ────────────────────────────────────────────────────────────
  emptyWrap: {
    alignItems: 'center', paddingTop: rs(48), paddingHorizontal: rs(40),
  },
  emptyCircle: {
    width: rs(80), height: rs(80), borderRadius: rs(40),
    backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center', marginBottom: rs(16),
    elevation: 2, shadowColor: C.navy,
    shadowOffset: { width: 0, height: rs(3) }, shadowOpacity: 0.06, shadowRadius: rs(8),
  },
  emptyTitle: { fontSize: rf(16), fontFamily: 'Montserrat-Bold', color: C.body, marginBottom: rs(8) },
  emptySub:   {
    fontSize: rf(13), fontFamily: 'Montserrat-Medium', color: C.subtle,
    textAlign: 'center', lineHeight: rf(20),
  },
});

export default OrdersScreen;