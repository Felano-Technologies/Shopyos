import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  Dimensions, RefreshControl, ScrollView,
  ActivityIndicator, Modal, Animated,
  Platform
} from 'react-native';
import AppImage from '@/components/AppImage';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { format } from 'date-fns';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import BusinessBottomNav from '@/components/BusinessBottomNav';
import { router } from 'expo-router';
import { useOnboarding } from '@/context/OnboardingContext';
import { SpotlightTour } from '@/components/ui/SpotlightTour';
import { BusinessOrdersSkeleton } from '@/components/skeletons/BusinessOrdersSkeleton';
import { useSellerGuard } from '@/hooks/useSellerGuard';
import { useActiveBusiness } from '@/hooks/useBusiness';
import { useStoreOrders } from '@/hooks/useOrders';
import { useUnreadNotificationCount } from '@/hooks/useNotifications';

const { width: SW, height: SH } = Dimensions.get('window');
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

type FilterType = 'All' | 'Awaiting Payment' | 'Processing' | 'Delivered' | 'Cancelled';

interface Order {
  id: string;
  customerName: string;
  itemsCount: number;
  totalAmount: number;
  date: string;
  status: string;
  displayStatus: FilterType;
  orderNumber: string;
}

const MAP_STATUS = (s: string): { label: FilterType; color: string; bg: string; bar: string } => {
  const status = (s || '').toLowerCase();
  if (['pending'].includes(status)) 
    return { label: 'Awaiting Payment', color: '#B45309', bg: '#FEF3C7', bar: '#F59E0B' };
  if (['paid', 'confirmed', 'ready_for_pickup', 'assigned', 'picked_up', 'in_transit'].includes(status)) 
    return { label: 'Processing', color: '#1D4ED8', bg: '#DBEAFE', bar: '#3B82F6' };
  if (['delivered', 'completed'].includes(status)) 
    return { label: 'Delivered', color: '#15803D', bg: '#DCFCE7', bar: '#84cc16' };
  if (['cancelled', 'refunded'].includes(status)) 
    return { label: 'Cancelled', color: '#B91C1C', bg: '#FEE2E2', bar: '#EF4444' };
  return { label: 'All', color: '#6B7280', bg: '#F3F4F6', bar: '#9CA3AF' };
};

const FILTERS: FilterType[] = ['All', 'Awaiting Payment', 'Processing', 'Delivered', 'Cancelled'];

const OrderListSeparator = () => <View style={{ height: rs(12) }} />;

const OrderListEmpty = ({ filter }: { filter: FilterType }) => (
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
);

// --- Custom 3-Color Spinner ---
const MultiColorSpinner = () => {
  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      })
    ).start();
  }, [spinValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={{ width: 50, height: 50, justifyContent: 'center', alignItems: 'center' }}>
      <Animated.View style={{ width: '100%', height: '100%', transform: [{ rotate: spin }] }}>
        <LinearGradient
          colors={['#1e3a8a', '#84cc16', '#111827']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1, borderRadius: 25 }}
        />
      </Animated.View>
      <View style={{ position: 'absolute', width: 40, height: 40, borderRadius: 20, backgroundColor: C.bg }} />
    </View>
  );
};

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const { isChecking, isVerified } = useSellerGuard();

  const [filter, setFilter] = useState<FilterType>('All');
  const [showSwitcher, setShowSwitcher] = useState(false);

  const { activeBusiness, businesses, selectBusiness } = useActiveBusiness();
  const businessId = activeBusiness?._id;

  const { data: storeOrdersData, isLoading: loading, isRefetching: refreshing, refetch } =
    useStoreOrders(businessId ?? '');

  const orders: Order[] = useMemo(() => {
    if (!storeOrdersData?.success) return [];
    return storeOrdersData.orders.map((o: any) => ({
      id:           o._id || o.id,
      orderNumber:  o.order_number,
      customerName: o.buyer?.user_profiles?.full_name || 'Guest',
      itemsCount:   o.order_items?.length || 0,
      totalAmount:  Number.parseFloat(o.total_amount || 0),
      date:         o.created_at,
      status:       o.status,
      displayStatus: MAP_STATUS(o.status).label,
    }));
  }, [storeOrdersData]);

  const { data: unreadData } = useUnreadNotificationCount(false);
  const unreadCount = unreadData?.unreadCount || 0;

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

  const handleRefresh = () => refetch();

  const filtered = filter === 'All' ? orders : orders.filter((o) => o.displayStatus === filter);

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

  if (isChecking || !isVerified) {
    return (
      <View style={S.centred}>
        <MultiColorSpinner />
        <Text style={{ marginTop: 16, color: '#64748B', fontFamily: 'Montserrat-Medium' }}>
          Loading Orders...
        </Text>
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
  const paidStatuses    = new Set(['paid', 'confirmed', 'ready_for_pickup', 'assigned', 'picked_up', 'in_transit']);
  const completedStatuses = new Set(['delivered', 'completed']);
  
  const earnedRevenue   = orders.reduce((s, o) => {
    const st = (o.status || '').toLowerCase();
    if (completedStatuses.has(st)) return s + o.totalAmount;
    if (st === 'refunded') return s - o.totalAmount;
    return s;
  }, 0);

  const pendingRevenue  = orders.reduce((s, o) => {
    const st = (o.status || '').toLowerCase();
    if (paidStatuses.has(st)) return s + o.totalAmount;
    return s;
  }, 0);
  const totalOrders     = orders.length;
  const pendingCount    = orders.filter((o) => o.displayStatus === 'Awaiting Payment').length;
  const processingCount = orders.filter((o) => o.displayStatus === 'Processing').length;
  const deliveredCount  = orders.filter((o) => o.displayStatus === 'Delivered').length;
  const cancelledCount  = orders.filter((o) => o.displayStatus === 'Cancelled').length;

  const renderOrder = ({ item }: { item: Order }) => {
    const cfg = MAP_STATUS(item.status);
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
        <View style={[S.cardBar, { backgroundColor: cfg.bar }]} />

        <View style={S.cardInner}>
          <View style={S.cardTop}>
            <View style={S.orderIdRow}>
              <View style={S.orderIcon}>
                <Feather name="package" size={rs(13)} color={C.navy} />
              </View>
              <Text style={S.orderNum} numberOfLines={1}>{item.orderNumber}</Text>
            </View>
            <View style={[S.statusPill, { backgroundColor: cfg.bg }]}>
              <View style={[S.statusDot, { backgroundColor: cfg.color }]} />
              <Text style={[S.statusTxt, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
          </View>

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

  return (
    <View style={S.root}>
      <StatusBar style="light" />

      <SafeAreaView style={{ flex: 1 }} edges={['left', 'right', 'bottom']}>
        {loading ? (
          <BusinessOrdersSkeleton />
        ) : (
          <>
            {/* ── STICKY HEADER OUTSIDE SCROLLVIEW (zIndex 100) ── */}
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100 }}>
              <LinearGradient
                colors={[C.navy, C.navyMid]}
                style={[S.header, { paddingTop: insets.top + rs(16) }]}
              >
                <View style={S.hdrGlow} pointerEvents="none" />

                {/* Logo row */}
                <View style={S.hdrLogoRow}>
                  <TouchableOpacity
                    style={S.storeSelectorPill}
                    onPress={() => setShowSwitcher(true)}
                    activeOpacity={0.85}
                  >
                    {(activeBusiness?.logo_url || activeBusiness?.logo) ? (
                      <AppImage uri={activeBusiness.logo_url || activeBusiness.logo} style={S.storePillLogo} />
                    ) : (
                      <View style={S.storePillPlaceholder}>
                        <Text style={S.storePillInitial}>{activeBusiness?.businessName?.charAt(0) || 'B'}</Text>
                      </View>
                    )}
                    <View style={S.storePillTextWrap}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: rs(3) }}>
                        <Text style={S.storePillName} numberOfLines={1}>{activeBusiness?.businessName || 'Store'}</Text>
                        <Ionicons name="chevron-down" size={rs(12)} color="#FFF" />
                      </View>
                      <Text style={S.storePillRating}>★ {activeBusiness?.rating || 0} Rating</Text>
                    </View>
                  </TouchableOpacity>

                  <View style={S.topIcons}>
                    <View style={S.hdrBadge}>
                      <Text style={S.hdrBadgeTxt}>{totalOrders} orders</Text>
                    </View>
                    <TouchableOpacity style={S.iconBtn} onPress={() => router.push('/business/notifications')}>
                      <Ionicons name="notifications-outline" size={20} color="#FFF" />
                      {unreadCount > 0 && (
                        <View style={S.badgeContainer}>
                          <Text style={S.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity style={S.iconBtn} onPress={() => router.push('/business/settings')}>
                      <Ionicons name="settings-outline" size={20} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Revenue cards */}
                <View style={S.revenueRow} ref={refRevenue} onLayout={() => measureElement(refRevenue, 'revenue')}>
                  <View style={[S.revenueCard, { flex: 1 }]}>
                    <View>
                      <Text style={S.revLbl}>Earned</Text>
                      <Text style={[S.revAmt, { fontSize: rf(18) }]}>₵{earnedRevenue.toFixed(2)}</Text>
                    </View>
                  </View>
                  <View style={[S.revenueCard, { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)' }]}>
                    <View>
                      <Text style={S.revLbl}>In Escrow</Text>
                      <Text style={[S.revAmt, { fontSize: rf(18), color: C.lime }]}>₵{pendingRevenue.toFixed(2)}</Text>
                    </View>
                  </View>
                </View>

                <View style={S.hdrArc} />
              </LinearGradient>
            </View>

{/* ── SCROLLVIEW ON TOP (zIndex 10) ── */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              style={{ zIndex: 10 }}
              // Android uses padding to push content down; iOS uses contentInset
              contentContainerStyle={{ flexGrow: 1, paddingTop: Platform.OS === 'android' ? 240 : 0, paddingBottom: rs(10) }} 
              // iOS pushes the content down AND moves the refresh spinner into this empty space!
              contentInset={{ top: Platform.OS === 'ios' ? 240 : 0 }} 
              contentOffset={{ x: 0, y: Platform.OS === 'ios' ? -10 : 0 }}
              refreshControl={
                <RefreshControl 
                  refreshing={refreshing} 
                  onRefresh={handleRefresh} 
                  tintColor="#84cc16" // iOS single color (Apple strict rule)
                  colors={['#1e3a8a', '#84cc16', '#111827']} // Android 3-color ring
                  progressViewOffset={260} // Android offset
                />
              }
            >
              {/* REMOVE the transparent spacer View! The padding/contentInset handles it now. */}

              {/* Solid body that gracefully covers the background when scrolling */}
              <View style={S.scrollBody}>
                {/* Background Watermark properly inside the scrolling area */}
                <View style={S.watermark} pointerEvents="none">
                  <AppImage source={require('../../assets/images/splash-icon.png')} style={S.watermarkImg} />
                </View>

                {/* ── Stat pills ────────────────────────────────────────────── */}
                <View style={S.statRow} ref={refStats} onLayout={() => measureElement(refStats, 'stats')}>
                  {[
                    { label: 'Awaiting',   value: pendingCount,   color: '#F59E0B' },
                    { label: 'Processing', value: processingCount, color: '#3B82F6' },
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
                    ItemSeparatorComponent={OrderListSeparator}
                    ListEmptyComponent={<OrderListEmpty filter={filter} />}
                  />
                </View>
              </View>
            </ScrollView>
          </>
        )}

        <BusinessBottomNav />

        {/* --- SWITCHER BOTTOM SHEET --- */}
        <Modal visible={showSwitcher} animationType="slide" transparent>
          <View style={S.switcherOverlay}>
            <TouchableOpacity style={S.switcherDismiss} onPress={() => setShowSwitcher(false)} activeOpacity={1} />
            <View style={S.switcherSheet}>
              <View style={S.switcherHeader}>
                <Text style={S.switcherTitle}>Switch Profile</Text>
                <TouchableOpacity onPress={() => setShowSwitcher(false)}>
                  <Ionicons name="close" size={24} color="#64748B" />
                </TouchableOpacity>
              </View>
              
              <View style={S.switcherList}>
                {businesses.map((biz: any) => {
                  const active = biz._id === activeBusiness?._id;
                  return (
                    <TouchableOpacity
                      key={biz._id}
                      style={[S.switcherCard, active && S.switcherCardActive]}
                      onPress={async () => {
                        await selectBusiness(biz._id);
                        setShowSwitcher(false);
                      }}
                    >
                      <View style={S.switcherLogoWrapper}>
                        {(biz.logo_url || biz.logo) ? (
                          <AppImage uri={biz.logo_url || biz.logo} style={S.switcherLogo} />
                        ) : (
                          <View style={[S.switcherLogo, S.switcherLogoPlaceholder]}>
                            <Text style={S.switcherLogoInitial}>{biz.businessName?.charAt(0) || 'B'}</Text>
                          </View>
                        )}
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={S.switcherName} numberOfLines={1}>{biz.businessName}</Text>
                        <Text style={S.switcherCat}>{biz.category}</Text>
                      </View>
                      {active ? (
                        <Ionicons name="checkmark-circle" size={22} color="#84cc16" />
                      ) : (
                        <Ionicons name="ellipse-outline" size={22} color="#CBD5E1" />
                      )}
                    </TouchableOpacity>
                  );
                })}
                
                {businesses.length < 3 && (
                  <TouchableOpacity
                    style={S.switcherAddCard}
                    onPress={() => {
                      setShowSwitcher(false);
                      router.push('/business/register');
                    }}
                  >
                    <View style={S.switcherAddIcon}>
                      <Ionicons name="add" size={22} color="#0C1559" />
                    </View>
                    <Text style={S.switcherAddText}>Register Another Store</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </Modal>

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

  scrollBody: { flex: 1, backgroundColor: C.bg, minHeight: SH },
  watermark:    { position: 'absolute', bottom: 140, left: -20 },
  watermarkImg: { width: 130, height: 130, resizeMode: 'contain', opacity: 0.03 },

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
  topIcons: { flexDirection: 'row', gap: rs(10), alignItems: 'center' },
  iconBtn: {
    width: rs(38), height: rs(38), borderRadius: rs(12),
    backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)',
  },
  badgeContainer: {
    position: 'absolute', top: -3, right: -3,
    backgroundColor: '#EF4444', minWidth: 16, height: 16, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.navy,
  },
  badgeText: { color: '#FFF', fontSize: 8, fontFamily: 'Montserrat-Bold' },

  revenueRow: { flexDirection: 'row', gap: rs(10) },
  revenueCard: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: rs(16), padding: rs(12),
    justifyContent: 'center',
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

  // Store Selector Pill
  storeSelectorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: rs(10),
    paddingVertical: rs(6),
    borderRadius: rs(16),
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    maxWidth: SW * 0.48,
  },
  storePillLogo: {
    width: rs(28),
    height: rs(28),
    borderRadius: rs(14),
    backgroundColor: '#F1F5F9',
  },
  storePillPlaceholder: {
    width: rs(28),
    height: rs(28),
    borderRadius: rs(14),
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  storePillInitial: {
    color: '#FFF',
    fontSize: rf(13),
    fontFamily: 'Montserrat-Bold',
  },
  storePillTextWrap: {
    marginLeft: rs(8),
    justifyContent: 'center',
  },
  storePillName: {
    color: '#FFF',
    fontSize: rf(11),
    fontFamily: 'Montserrat-Bold',
    maxWidth: SW * 0.28,
  },
  storePillRating: {
    color: '#F59E0B',
    fontSize: rf(9),
    fontFamily: 'Montserrat-Bold',
    marginTop: rs(1),
  },

  // Switcher bottom sheet styles
  switcherOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  switcherDismiss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  switcherSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: rs(30),
    borderTopRightRadius: rs(30),
    padding: rs(24),
    paddingBottom: rs(40),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 25,
  },
  switcherHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: rs(20),
  },
  switcherTitle: {
    fontSize: rf(20),
    fontFamily: 'Montserrat-Bold',
    color: '#0F172A',
  },
  switcherList: {
    gap: rs(12),
  },
  switcherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: rs(14),
    borderRadius: rs(18),
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  switcherCardActive: {
    borderColor: '#0C1559',
    backgroundColor: '#F1F5F9',
  },
  switcherLogoWrapper: {
    width: rs(40),
    height: rs(40),
    borderRadius: rs(20),
    overflow: 'hidden',
  },
  switcherLogo: {
    width: '100%',
    height: '100%',
  },
  switcherLogoPlaceholder: {
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  switcherLogoInitial: {
    color: '#FFF',
    fontSize: rf(18),
    fontFamily: 'Montserrat-Bold',
  },
  switcherName: {
    fontSize: rf(15),
    fontFamily: 'Montserrat-Bold',
    color: '#0F172A',
  },
  switcherCat: {
    fontSize: rf(12),
    fontFamily: 'Montserrat-Medium',
    color: '#64748B',
    marginTop: rs(2),
  },
  switcherAddCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: rs(14),
    borderRadius: rs(18),
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    marginTop: rs(6),
  },
  switcherAddIcon: {
    width: rs(40),
    height: rs(40),
    borderRadius: rs(20),
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  switcherAddText: {
    fontSize: rf(14),
    fontFamily: 'Montserrat-Bold',
    color: '#0C1559',
    marginLeft: rs(12),
  },
});

// (already exported as default above)