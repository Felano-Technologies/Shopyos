import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  Dimensions, Image, ActivityIndicator, Modal,
} from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { LineChart, PieChart } from 'react-native-chart-kit';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import BusinessBottomNav from '@/components/BusinessBottomNav';
import { useOnboarding } from '@/context/OnboardingContext';
import { SpotlightTour } from '@/components/ui/SpotlightTour';
import { BusinessAnalyticsSkeleton } from '@/components/skeletons/BusinessAnalyticsSkeleton';
import { useBusinessAnalytics, useActiveBusiness } from '@/hooks/useBusiness';
import { useUnreadNotificationCount } from '@/hooks/useNotifications';
import { useSellerGuard } from '../../hooks/useSellerGuard';

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

// ─── Safe default — every field pre-filled so no access can ever be undefined ─
const EMPTY_ANALYTICS = {
  chart: {
    labels:   [] as string[],
    datasets: [{ data: [0] }] as { data: number[] }[],
  },
  stats:                { revenue: 0, pending: 0, orders: 0, growth: 0 },
  topProducts:          [] as any[],
  categoryDistribution: [] as any[],
};

const Analytics = () => {
  const insets = useSafeAreaInsets();

  // ── ALL HOOKS FIRST ───────────────────────────────────────────────────────
  const { isChecking, isVerified } = useSellerGuard();
  const [timeframe,  setTimeframe]  = useState<'week' | 'month' | 'year'>('week');
  const scrollY = useRef(new Animated.Value(0)).current;

  const { activeBusiness, businesses, selectBusiness } = useActiveBusiness();
  const [showSwitcher, setShowSwitcher] = useState(false);
  const businessId = activeBusiness?._id;

  const { data, isLoading, refetch, isRefetching } =
    useBusinessAnalytics(businessId || '', timeframe);
  const { data: unreadData } = useUnreadNotificationCount(false);
  const unreadCount = unreadData?.unreadCount || 0;

  // --- Onboarding ---
  const { startTour, markCompleted, isTourActive, activeScreen } = useOnboarding();
  const [layouts, setLayouts] = useState<any>({});
  const refToggle = useRef<View>(null);
  const refTrend = useRef<View>(null);
  const refStats = useRef<View>(null);
  const refTopProducts = useRef<View>(null);

  const measureElement = (ref: any, key: string) => {
    if (ref.current) {
      ref.current.measureInWindow((x: number, y: number, width: number, height: number) => {
        setLayouts((prev: any) => ({ ...prev, [key]: { x, y, width, height } }));
      });
    }
  };

  // ── Safe data merge ────────────────────────────────────────────────────────
  const analytics = {
    chart: {
      labels:   data?.chart?.labels   ?? EMPTY_ANALYTICS.chart.labels,
      datasets: data?.chart?.datasets ?? EMPTY_ANALYTICS.chart.datasets,
    },
    stats: {
      revenue: data?.stats?.revenue   ?? 0,
      pending: data?.stats?.pending   ?? 0,
      orders:  data?.stats?.orders    ?? 0,
      growth:  data?.stats?.growth    ?? 0,
    },
    topProducts:          Array.isArray(data?.topProducts)          ? data.topProducts          : [],
    categoryDistribution: Array.isArray(data?.categoryDistribution) ? data.categoryDistribution : [],
  };

  useEffect(() => {
    if (!isLoading && isVerified) {
      const timer = setTimeout(() => {
        measureElement(refToggle, 'toggle');
        measureElement(refTrend, 'trend');
        measureElement(refStats, 'stats');
        if (analytics.topProducts.length > 0) measureElement(refTopProducts, 'products');
        startTour('business_analytics');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isLoading, isVerified, analytics.topProducts.length, startTour]);

  // ── END OF HOOKS ──────────────────────────────────────────────────────────

  if (isChecking || !isVerified) {
    return <View style={S.centred}><ActivityIndicator size="large" color={C.navy} /></View>;
  }

  const onboardingSteps = [
    {
      targetLayout: layouts.toggle,
      title: 'Timeframe Filters',
      description: 'Analyze your performance across different periods: Weekly, Monthly, or Yearly.',
    },
    {
      targetLayout: layouts.trend,
      title: 'Revenue Trends',
      description: 'Visualize your store’s financial growth with this interactive chart.',
    },
    {
      targetLayout: layouts.stats,
      title: 'Key Metrics',
      description: 'Track your total revenue and order volume in real-time.',
    },
    ...(layouts.products ? [{
      targetLayout: layouts.products,
      title: 'Best Sellers',
      description: 'See which products are driving the most value for your business.',
    }] : []),
  ].filter(s => !!s.targetLayout);

  const handleOnboardingComplete = () => {
    markCompleted('business_analytics');
  };

  // Guard: chart can only be used when labels AND at least one non-zero value exist
  const hasChart =
    analytics.chart.labels.length > 0 &&
    Array.isArray(analytics.chart.datasets[0]?.data) &&
    analytics.chart.datasets[0].data.some((x: number) => x > 0);

  const hasPie = analytics.categoryDistribution.length > 0;

  const chartConfig = {
    backgroundGradientFrom: '#fff',
    backgroundGradientTo:   '#fff',
    decimalPlaces: 0,
    color: (o = 1) => `rgba(12,21,89,${o})`,
    labelColor: (o = 1) => `rgba(100,116,139,${o})`,
    style: { borderRadius: rs(16) },
    propsForDots: { r: '4', strokeWidth: '2', stroke: C.lime },
    propsForBackgroundLines: { strokeDasharray: '5', stroke: 'rgba(0,0,0,0.05)' },
    propsForLabels: { fontFamily: 'Montserrat-Medium', fontSize: 10 },
  };

  // Show skeleton while loading (but not when just refetching — we keep showing stale data)
  if (isLoading && !isRefetching) {
    return (
      <View style={S.root}>
        <BusinessAnalyticsSkeleton />
      </View>
    );
  }

  return (
    <View style={S.root}>
      <StatusBar style="light" />

      <View style={S.watermark}>
        <Image source={require('../../assets/images/splash-icon.png')} style={S.watermarkImg} />
      </View>

      <SafeAreaView style={{ flex: 1 }} edges={['left', 'right']}>
        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[S.scroll, { paddingBottom: rs(100) + insets.bottom }]}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
        >
          {/* ── Header ─────────────────────────────────────────────────── */}
          <LinearGradient
            colors={[C.navy, C.navyMid]}
            style={[S.header, { paddingTop: insets.top + rs(16) }]}
          >
            <View style={S.hdrGlow} pointerEvents="none" />
            <View style={S.hdrRow}>
              <TouchableOpacity
                style={S.storeSelectorPill}
                onPress={() => setShowSwitcher(true)}
                activeOpacity={0.85}
              >
                {(activeBusiness?.logo_url || activeBusiness?.logo) ? (
                  <Image source={{ uri: activeBusiness.logo_url || activeBusiness.logo }} style={S.storePillLogo} />
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
                <TouchableOpacity style={S.hdrBtn} onPress={() => refetch()}>
                  <Feather name="refresh-cw" size={rs(16)} color="#fff" />
                </TouchableOpacity>
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
            <Text style={S.hdrTitle}>Analytics</Text>
            <Text style={S.hdrSub}>Overview & Performance</Text>
            <View style={S.hdrArc} />
          </LinearGradient>

          {/* ── Body ───────────────────────────────────────────────────── */}
          <View style={S.body}>

            {/* Timeframe toggle */}
            <View style={S.toggleRow} ref={refToggle} onLayout={() => measureElement(refToggle, 'toggle')}>
              {(['week', 'month', 'year'] as const).map((p) => {
                const on = timeframe === p;
                return (
                  <TouchableOpacity
                    key={p}
                    style={[S.toggleBtn, on && S.toggleBtnOn]}
                    onPress={() => setTimeframe(p)}
                  >
                    <Text style={[S.toggleTxt, on && S.toggleTxtOn]}>
                      {p === 'week' ? 'Weekly' : p === 'month' ? 'Monthly' : 'Yearly'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Revenue chart */}
            <Text style={S.secTitle}>Revenue Trend</Text>
            <View style={S.card} ref={refTrend} onLayout={() => measureElement(refTrend, 'trend')}>
              {hasChart ? (
                <LineChart
                  data={{
                    labels:   analytics.chart.labels,
                    datasets: analytics.chart.datasets,
                  }}
                  width={SW - rs(48)}
                  height={220}
                  chartConfig={chartConfig}
                  bezier
                  style={{ borderRadius: rs(16) }}
                  withInnerLines
                  withOuterLines={false}
                  withVerticalLines={false}
                  yAxisLabel="₵"
                  yAxisSuffix="k"
                  yAxisInterval={1}
                />
              ) : (
                <View style={S.emptyChart}>
                  <MaterialCommunityIcons name="chart-line-variant" size={rs(40)} color="#CBD5E1" />
                  <Text style={S.emptyTxt}>No revenue data for this period</Text>
                </View>
              )}
            </View>

            {/* Stats grid */}
            <View style={S.statsGrid} ref={refStats} onLayout={() => measureElement(refStats, 'stats')}>
              <View style={S.statCard}>
                <View style={[S.iconBox, { backgroundColor: '#DCFCE7' }]}>
                  <Ionicons name="cash" size={rs(20)} color="#15803D" />
                </View>
                <Text style={S.statLbl}>Revenue</Text>
                <Text style={S.statVal}>₵{analytics.stats.revenue.toLocaleString()}</Text>
                <View style={S.growthRow}>
                  <Feather
                    name={analytics.stats.growth >= 0 ? 'trending-up' : 'trending-down'}
                    size={rs(13)}
                    color={analytics.stats.growth >= 0 ? '#15803D' : '#EF4444'}
                  />
                  <Text style={[S.growthTxt, { color: analytics.stats.growth >= 0 ? '#15803D' : '#EF4444' }]}>
                    {Math.abs(analytics.stats.growth)}%
                  </Text>
                </View>
              </View>

              <View style={S.statCard}>
                <View style={[S.iconBox, { backgroundColor: '#FEF3C7' }]}>
                  <MaterialCommunityIcons name="timer-sand" size={rs(20)} color="#B45309" />
                </View>
                <Text style={S.statLbl}>In Escrow</Text>
                <Text style={S.statVal}>₵{analytics.stats.pending.toLocaleString()}</Text>
                <Text style={S.statSubTxt}>Awaiting release</Text>
              </View>

              <View style={S.statCard}>
                <View style={[S.iconBox, { backgroundColor: '#DBEAFE' }]}>
                  <Ionicons name="cart" size={rs(20)} color="#1E40AF" />
                </View>
                <Text style={S.statLbl}>Orders</Text>
                <Text style={S.statVal}>{analytics.stats.orders}</Text>
                <Text style={S.statSubTxt}>Total orders</Text>
              </View>
            </View>

            {/* Category breakdown */}
            {hasPie && (
              <>
                <Text style={S.secTitle}>Category Breakdown</Text>
                <View style={S.card}>
                  <PieChart
                    data={analytics.categoryDistribution}
                    width={SW - rs(48)}
                    height={200}
                    chartConfig={chartConfig}
                    accessor="sales"
                    backgroundColor="transparent"
                    paddingLeft="15"
                    absolute
                  />
                </View>
              </>
            )}

            {/* Top products */}
            <Text style={S.secTitle}>Top Products</Text>
            {analytics.topProducts.length > 0 ? (
              analytics.topProducts.map((p: any, i: number) => (
                <View 
                  key={i} 
                  style={S.productCard}
                  ref={i === 0 ? refTopProducts : undefined}
                  onLayout={i === 0 ? () => measureElement(refTopProducts, 'products') : undefined}
                >
                  <View style={[S.rankBadge, {
                    backgroundColor:
                      i === 0 ? '#EAB308' :
                      i === 1 ? '#94A3B8' :
                      i === 2 ? '#B45309' : C.navy,
                  }]}>
                    <Text style={S.rankTxt}>{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: rs(12) }}>
                    <Text style={S.productName} numberOfLines={1}>{p.name}</Text>
                    <Text style={S.productSales}>{p.sales} items sold</Text>
                  </View>
                  <Text style={S.productRev}>₵{p.revenue.toLocaleString()}</Text>
                </View>
              ))
            ) : (
              <View style={S.emptyList}>
                <MaterialCommunityIcons name="chart-bar" size={rs(32)} color="#CBD5E1" />
                <Text style={S.emptyTxt}>No top products yet</Text>
              </View>
            )}

            {/* Performance banner */}
            <LinearGradient colors={[C.navy, C.navyMid]} style={S.scoreBanner}>
              <View style={{ flex: 1, marginRight: rs(12) }}>
                <Text style={S.scoreTitle}>Performance Score</Text>
                <Text style={S.scoreDesc}>
                  {analytics.stats.growth > 0
                    ? "You're growing fast! Keep it up."
                    : 'Steady progress. Try adding new items.'}
                </Text>
              </View>
              <View style={S.scoreCircle}>
                <Text style={S.scoreNum}>
                  {analytics.stats.orders > 0 ? '9.2' : '—'}
                </Text>
              </View>
            </LinearGradient>

          </View>
        </Animated.ScrollView>

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
                          <Image source={{ uri: biz.logo_url || biz.logo }} style={S.switcherLogo} />
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
          visible={isTourActive && activeScreen === 'business_analytics'} 
          steps={onboardingSteps}
          onComplete={handleOnboardingComplete}
        />
      </SafeAreaView>

      {isRefetching && (
        <View style={S.refreshOverlay}>
          <View style={S.refreshCircle}>
            <ActivityIndicator size="small" color={C.navy} />
          </View>
        </View>
      )}
    </View>
  );
};

// ─── Styles ────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  centred: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },

  watermark:    { position: 'absolute', bottom: 20, left: -20 },
  watermarkImg: { width: 130, height: 130, resizeMode: 'contain', opacity: 0.07 },
  scroll: { flexGrow: 1 },

  // Header
  header: {
    paddingHorizontal: rs(20), paddingBottom: rs(28),
    position: 'relative', elevation: 10, shadowColor: C.navy,
    shadowOffset: { width: 0, height: rs(8) }, shadowOpacity: 0.2, shadowRadius: rs(16),
  },
  hdrGlow: {
    position: 'absolute', top: -rs(30), right: -rs(30),
    width: rs(150), height: rs(150), borderRadius: rs(75),
    backgroundColor: 'rgba(132,204,22,0.12)',
  },
  hdrRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: rs(14) },
  logo:     { width: 110, height: 34 },
  hdrBtn: {
    width: rs(38), height: rs(38), borderRadius: rs(12),
    backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center', alignItems: 'center',
  },
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
  hdrTitle: { fontSize: rf(26), fontFamily: 'Montserrat-Bold',   color: '#fff' },
  hdrSub:   { fontSize: rf(13), fontFamily: 'Montserrat-Medium', color: 'rgba(255,255,255,0.65)', marginTop: rs(3) },
  hdrArc: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: rs(24),
    backgroundColor: C.bg, borderTopLeftRadius: rs(24), borderTopRightRadius: rs(24),
  },

  body: { paddingHorizontal: rs(16), paddingTop: rs(8) },

  // Toggle
  toggleRow: { flexDirection: 'row', gap: rs(10), marginTop: rs(4), marginBottom: rs(16) },
  toggleBtn: {
    paddingVertical: rs(8), paddingHorizontal: rs(20), borderRadius: rs(20),
    borderWidth: 0.5, borderColor: 'rgba(12,21,89,0.14)', backgroundColor: C.card,
    elevation: 1, shadowColor: C.navy,
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: rs(2),
  },
  toggleBtnOn: { backgroundColor: C.navy, borderColor: C.navy },
  toggleTxt:   { fontSize: rf(13), fontFamily: 'Montserrat-SemiBold', color: C.muted },
  toggleTxtOn: { color: '#fff' },

  secTitle: {
    fontSize: rf(16), fontFamily: 'Montserrat-Bold', color: C.navy,
    marginTop: rs(16), marginBottom: rs(10),
  },

  card: {
    backgroundColor: C.card, borderRadius: rs(18), padding: rs(14), marginBottom: rs(4),
    elevation: 3, shadowColor: C.navy,
    shadowOffset: { width: 0, height: rs(2) }, shadowOpacity: 0.06, shadowRadius: rs(10),
    alignItems: 'center', justifyContent: 'center',
  },

  emptyChart: { height: 180, justifyContent: 'center', alignItems: 'center' },
  emptyList:  { alignItems: 'center', paddingVertical: rs(24) },
  emptyTxt:   { fontSize: rf(13), fontFamily: 'Montserrat-Medium', color: C.subtle, marginTop: rs(8) },

  // Stats
  statsGrid: { flexDirection: 'row', gap: rs(12), marginBottom: rs(4) },
  statCard: {
    flex: 1, backgroundColor: C.card, borderRadius: rs(16), padding: rs(14),
    elevation: 3, shadowColor: C.navy,
    shadowOffset: { width: 0, height: rs(2) }, shadowOpacity: 0.06, shadowRadius: rs(10),
  },
  iconBox: {
    width: rs(38), height: rs(38), borderRadius: rs(12),
    justifyContent: 'center', alignItems: 'center', marginBottom: rs(10),
  },
  statLbl:    { fontSize: rf(12), fontFamily: 'Montserrat-Medium', color: C.muted },
  statVal:    { fontSize: rf(16), fontFamily: 'Montserrat-Bold',   color: C.body, marginTop: rs(3) },
  statSubTxt: { fontSize: rf(10), fontFamily: 'Montserrat-Regular', color: C.subtle, marginTop: rs(3) },
  growthRow:  { flexDirection: 'row', alignItems: 'center', marginTop: rs(4), gap: rs(3) },
  growthTxt:  { fontSize: rf(12), fontFamily: 'Montserrat-SemiBold' },

  // Top products
  productCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.card,
    padding: rs(14), borderRadius: rs(16), marginBottom: rs(10),
    elevation: 2, shadowColor: C.navy,
    shadowOffset: { width: 0, height: rs(1) }, shadowOpacity: 0.04, shadowRadius: rs(4),
  },
  rankBadge:    { width: rs(32), height: rs(32), borderRadius: rs(16), justifyContent: 'center', alignItems: 'center' },
  rankTxt:      { fontSize: rf(14), fontFamily: 'Montserrat-Bold', color: '#fff' },
  productName:  { fontSize: rf(14), fontFamily: 'Montserrat-SemiBold', color: C.body },
  productSales: { fontSize: rf(12), fontFamily: 'Montserrat-Regular',  color: C.muted },
  productRev:   { fontSize: rf(14), fontFamily: 'Montserrat-Bold',     color: C.navy },

  // Score banner
  scoreBanner: {
    flexDirection: 'row', alignItems: 'center', borderRadius: rs(18),
    padding: rs(20), marginTop: rs(10), marginBottom: rs(20), elevation: 4,
  },
  scoreTitle: { fontSize: rf(17), fontFamily: 'Montserrat-Bold',   color: '#fff' },
  scoreDesc:  { fontSize: rf(12), fontFamily: 'Montserrat-Regular', color: '#cbd5e1', marginTop: rs(4) },
  scoreCircle: {
    width: rs(52), height: rs(52), borderRadius: rs(26),
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: C.lime,
  },
  scoreNum: { fontSize: rf(16), fontFamily: 'Montserrat-Bold', color: '#fff' },

  // Refresh overlay
  refreshOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(241,245,249,0.4)',
    justifyContent: 'center', alignItems: 'center', zIndex: 999,
  },
  refreshCircle: {
    width: rs(50), height: rs(50), borderRadius: rs(25),
    backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center',
    elevation: 5, shadowColor: '#000',
    shadowOffset: { width: 0, height: rs(4) }, shadowOpacity: 0.1, shadowRadius: rs(10),
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

export default Analytics;