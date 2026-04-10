import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  Dimensions, RefreshControl, ActivityIndicator,
  TextInput, ScrollView, Platform, Image
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { OrdersSkeleton } from '@/components/skeletons/OrdersSkeleton';
import { useOrders } from '@/hooks/useOrders';
import { useOnboarding } from './context/OnboardingContext';
import { SpotlightTour } from '@/components/ui/SpotlightTour';

// ─── Responsive helpers ───────────────────────────────────────────────────────
const { width: SW } = Dimensions.get('window');
const BASE_W = 390;
const SCALE  = Math.min(Math.max(SW / BASE_W, 0.82), 1.2);
const rs = (n: number) => Math.round(n * SCALE);
const rf = (n: number) => Math.round(n * Math.min(SCALE, 1.1));

const BOTTOM_NAV_H  = rs(60);
const BOTTOM_BUFFER = rs(24);

const PAGE_SIZE = 10;

const C = {
  bg:      '#F8FAFC',
  navy:    '#0C1559',
  navyMid: '#1e3a8a',
  lime:    '#84cc16',
  limeText:'#1a2e00',
  card:    '#FFFFFF',
  body:    '#0F172A',
  muted:   '#64748B',
  subtle:  '#94A3B8',
  border:  'rgba(12,21,89,0.07)',
};

type StatusConfig = {
  color: string; bg: string; bar: string;
  timelineStep: number; label: string;
};

const STATUS_CONFIG: Record<string, StatusConfig> = {
  pending:            { color: '#B45309', bg: '#FEF3C7', bar: '#F59E0B', timelineStep: 0,  label: 'Pending'    },
  paid:               { color: '#15803D', bg: '#DCFCE7', bar: '#22c55e', timelineStep: 1,  label: 'Paid'       },
  confirmed:          { color: '#15803D', bg: '#DCFCE7', bar: '#22c55e', timelineStep: 1,  label: 'Confirmed'  },
  processing:         { color: '#1D4ED8', bg: '#DBEAFE', bar: '#3B82F6', timelineStep: 1,  label: 'Processing' },
  'ready for pickup': { color: '#7C3AED', bg: '#F3E8FF', bar: '#7C3AED', timelineStep: 2,  label: 'Ready'      },
  'in transit':       { color: '#7C3AED', bg: '#F3E8FF', bar: '#7C3AED', timelineStep: 2,  label: 'In Transit' },
  delivered:          { color: '#166534', bg: '#DCFCE7', bar: '#84cc16', timelineStep: 3,  label: 'Delivered'  },
  cancelled:          { color: '#B91C1C', bg: '#FEE2E2', bar: '#EF4444', timelineStep: -1, label: 'Cancelled'  },
};

const getStatusConfig = (status: string): StatusConfig =>
  STATUS_CONFIG[status.toLowerCase().replace(/_/g, ' ')] ?? {
    color: '#6B7280', bg: '#F3F4F6', bar: '#9CA3AF', timelineStep: 0, label: status,
  };

const TIMELINE_STEPS = ['Placed', 'Paid', 'Transit', 'Done'];

interface Order {
  id: string;
  orderNumber: string;
  totalAmount: number;
  date: string;
  status: string;
  itemsCount: number;
  storeName: string;
  storeLogo?: string;
  storeCategory?: string;
}

const OrdersScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const listBottomPadding = BOTTOM_NAV_H + BOTTOM_BUFFER + insets.bottom;

  const [page,         setPage]         = useState(1);
  const [searchQuery,  setSearchQuery]  = useState('');
  const [activeFilter, setActiveFilter] = useState('All');


  const FILTERS = ['All', 'Pending', 'Paid', 'Confirmed', 'In Transit', 'Delivered', 'Cancelled'];

  const statusParam = activeFilter === 'All'
    ? undefined
    : activeFilter.toLowerCase().replace(/ /g, '_');

  const { data, isLoading, refetch, isRefetching, isFetching } =
    useOrders(statusParam, page, PAGE_SIZE);

  const rawOrders: any[]  = Array.isArray(data) ? data : (data as any)?.orders ?? [];
  const pagination         = (data as any)?.pagination ?? null;
  const totalPages: number = pagination?.totalPages ?? 1;
  const totalItems: number = pagination?.totalItems ?? rawOrders.length;

  const orders: Order[] = rawOrders.map((o: any) => {
    const orderObj = {
      id:          o.id,
      orderNumber: o.order_number,
      totalAmount: o.total_amount ? parseFloat(o.total_amount) : 0,
      date:        o.created_at,
      status:      o.status ?? 'unknown',
      itemsCount:  o.order_items?.length ?? 0,
      storeName:   o.store?.store_name ?? 'Shopyos Store',
      storeLogo:   o.store?.logo || o.store?.logo_url,
      storeCategory: o.store?.store_category || o.store?.category || 'General',
    };
    console.log(`DEBUG: Order ${orderObj.orderNumber} data:`, { store: orderObj.storeName, cat: orderObj.storeCategory, hasLogo: !!orderObj.storeLogo });
    return orderObj;
  });

  const filteredOrders = orders.filter((o) => {
    if (!searchQuery) return true;
    return (
      o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.storeName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const handleFilterChange = (f: string) => { setActiveFilter(f); setPage(1); };

  // --- Onboarding ---
  const { startTour, markCompleted, isTourActive, activeScreen } = useOnboarding();
  const [layouts, setLayouts] = useState<any>({});
  const refSearch = useRef<View>(null);
  const refFilters = useRef<ScrollView>(null);
  const refFirstOrder = useRef<View>(null);

  const measureElement = (ref: any, key: string) => {
    if (ref.current) {
      ref.current.measureInWindow((x: number, y: number, width: number, height: number) => {
        setLayouts((prev: any) => ({ ...prev, [key]: { x, y, width, height } }));
      });
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      measureElement(refSearch, 'search');
      measureElement(refFilters, 'filters');
      if (filteredOrders.length > 0) measureElement(refFirstOrder, 'order');
      startTour('orders');
    }, 1500);
    return () => clearTimeout(timer);
  }, [filteredOrders.length]);

  const onboardingSteps = [
    {
      targetLayout: layouts.search,
      title: 'Find Orders',
      description: 'Search for past or current orders by ID or store name.',
    },
    {
      targetLayout: layouts.filters,
      title: 'Status Filters',
      description: 'Quickly narrow down orders by their current status.',
    },
    ...(layouts.order ? [{
      targetLayout: layouts.order,
      title: 'Live Tracking',
      description: 'See the real-time status and timeline of your order right here.',
    }] : []),
  ].filter(s => !!s.targetLayout);

  const handleOnboardingComplete = () => {
    markCompleted('orders');
  };

  // ── Timeline ────────────────────────────────────────────────────────────────
  const renderTimeline = (step: number) => (
    <View style={S.timeline}>
      {TIMELINE_STEPS.map((label, i) => {
        const done   = i < step;
        const active = i === step;
        return (
          <React.Fragment key={label}>
            <View style={S.tlStep}>
              <View style={[S.tlDot, done && S.tlDotDone, active && S.tlDotActive]} />
              <Text style={[S.tlLbl, done && S.tlLblDone, active && S.tlLblActive]}>
                {label}
              </Text>
            </View>
            {i < TIMELINE_STEPS.length - 1 && (
              <View style={[S.tlLine, done && S.tlLineDone]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );

  // ── Order card ──────────────────────────────────────────────────────────────
  const renderOrder = ({ item }: { item: Order }) => {
    const cfg       = getStatusConfig(item.status);
    const showTrack = cfg.timelineStep >= 0 && cfg.timelineStep <= 2;

    let dateStr = '';
    try { dateStr = format(new Date(item.date), 'MMM dd, yyyy'); } catch {}

    return (
      <TouchableOpacity
        style={S.card}
        activeOpacity={0.82}
        onPress={() => router.push(`/order/${item.id}` as any)}
        ref={filteredOrders[0]?.id === item.id ? refFirstOrder : undefined}
        onLayout={filteredOrders[0]?.id === item.id ? () => measureElement(refFirstOrder, 'order') : undefined}
      >
        <View style={[S.cardBar, { backgroundColor: cfg.bar }]} />
        <View style={S.cardBody}>
          <View style={S.cardTop}>
            <View style={S.storeRow}>
              <View style={S.storeIcon}>
                {item.storeLogo ? (
                  <Image source={{ uri: item.storeLogo }} style={S.storeLogoImg} />
                ) : (
                  <MaterialCommunityIcons name="store-outline" size={rs(14)} color={C.navy} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={S.storeName} numberOfLines={1}>{item.storeName}</Text>
                <Text style={S.storeCat}>{item.storeCategory || 'General'}</Text>
              </View>
            </View>
            <View style={[S.statusPill, { backgroundColor: cfg.bg }]}>
              <View style={[S.statusDot, { backgroundColor: cfg.color }]} />
              <Text style={[S.statusTxt, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
          </View>

          {showTrack && renderTimeline(cfg.timelineStep)}

          <View style={S.cardMid}>
            <View>
              <Text style={S.orderNum}>#{item.orderNumber}</Text>
              <Text style={S.orderDate}>{dateStr}</Text>
            </View>
            <View style={S.amountWrap}>
              <Text style={S.amountLbl}>Total</Text>
              <Text style={S.amountVal}>₵{item.totalAmount.toFixed(2)}</Text>
            </View>
          </View>

          <View style={S.cardFoot}>
            <Text style={S.itemsLbl}>
              {item.itemsCount} {item.itemsCount === 1 ? 'item' : 'items'}
            </Text>
            <View style={S.viewBtn}>
              <Text style={S.viewBtnTxt}>View Details</Text>
              <Ionicons name="chevron-forward" size={rs(12)} color={C.navy} />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ── Pagination ──────────────────────────────────────────────────────────────
  const renderFooter = () => {
    if (totalPages <= 1) return null;

    const allPages = Array.from({ length: totalPages }, (_, i) => i + 1);
    const visible  = allPages.filter(
      (n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1
    );
    const withEllipsis = visible.reduce<(number | string)[]>((acc, n, i, arr) => {
      if (i > 0 && (n as number) - (arr[i - 1] as number) > 1) acc.push('…');
      acc.push(n);
      return acc;
    }, []);

    return (
      <View style={S.pagination}>
        <Text style={S.pageInfo}>
          {totalItems} order{totalItems !== 1 ? 's' : ''} · Page {page} of {totalPages}
        </Text>
        <View style={S.pageControls}>
          <TouchableOpacity
            style={[S.pageBtn, page <= 1 && S.pageBtnOff]}
            onPress={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || isFetching}
          >
            <Ionicons name="chevron-back" size={rs(16)} color={page <= 1 ? '#CBD5E1' : C.navy} />
          </TouchableOpacity>

          {withEllipsis.map((n, i) =>
            n === '…' ? (
              <Text key={`el-${i}`} style={S.pageEllipsis}>…</Text>
            ) : (
              <TouchableOpacity
                key={n}
                style={[S.pageNum, page === n && S.pageNumOn]}
                onPress={() => setPage(n as number)}
                disabled={isFetching}
              >
                <Text style={[S.pageNumTxt, page === n && S.pageNumTxtOn]}>{n}</Text>
              </TouchableOpacity>
            )
          )}

          <TouchableOpacity
            style={[S.pageBtn, page >= totalPages && S.pageBtnOff]}
            onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || isFetching}
          >
            <Ionicons
              name="chevron-forward"
              size={rs(16)}
              color={page >= totalPages ? '#CBD5E1' : C.navy}
            />
          </TouchableOpacity>
        </View>

        {isFetching && !isLoading && (
          <View style={S.fetchingRow}>
            <ActivityIndicator size="small" color={C.navy} />
            <Text style={S.fetchingTxt}>Loading…</Text>
          </View>
        )}
      </View>
    );
  };

  // ── Root ────────────────────────────────────────────────────────────────────
  return (
    <View style={S.root}>
      <StatusBar style="light" />

      <LinearGradient colors={[C.navy, C.navyMid]} style={S.hdrGradient}>
        <View style={S.hdrGlow} pointerEvents="none" />

        <SafeAreaView edges={['top', 'left', 'right']}>
          <View style={S.hdrInner}>
            <View style={S.hdrTop}>
              <TouchableOpacity style={S.backBtn} onPress={() => router.back()}>
                <Ionicons name="chevron-back" size={rs(22)} color="rgba(255,255,255,0.85)" />
              </TouchableOpacity>

              <View style={S.hdrCenter}>
                <Text style={S.hdrEye}>Track your</Text>
                <Text style={S.hdrTitle}>
                  My <Text style={{ color: C.lime }}>Orders</Text>
                </Text>
              </View>

              <View style={S.hdrStatPill}>
                <Text style={S.hdrStatN}>{totalItems}</Text>
                <Text style={S.hdrStatLbl}>orders</Text>
              </View>
            </View>

            <View style={[S.searchPill, searchQuery.length > 0 && S.searchPillActive]} ref={refSearch} onLayout={() => measureElement(refSearch, 'search')}>
              <Feather name="search" size={rs(14)} color="rgba(255,255,255,0.5)" />
              <TextInput
                style={S.searchInput}
                placeholder="Search by order ID or store…"
                placeholderTextColor="rgba(255,255,255,0.32)"
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  style={S.searchClear}
                  onPress={() => setSearchQuery('')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={rs(10)} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </SafeAreaView>

        <View style={S.hdrArc} />
      </LinearGradient>

      {/* ── Filter chip strip ───────────────────────────────────────────────
          FIX 1: alignItems:'flex-start' on the ScrollView wrapper so chips
          never float to the centre of the row regardless of how many are
          rendered. Combined with flexGrow:0 on contentContainerStyle so the
          container doesn't stretch to fill the ScrollView width.
      ─────────────────────────────────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        // aligning the scroll view itself to the start prevents centring
        style={S.chipScrollView}
        contentContainerStyle={S.chipStrip}
        ref={refFilters}
        onLayout={() => measureElement(refFilters, 'filters')}
      >
        {FILTERS.map((f) => {
          const on = activeFilter === f;
          return (
            <TouchableOpacity
              key={f}
              style={[S.chip, on && S.chipOn]}
              onPress={() => handleFilterChange(f)}
              activeOpacity={0.75}
            >
              <Text style={[S.chipTxt, on && S.chipTxtOn]} numberOfLines={1}>
                {f}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* FIX 2: explicit spacer between chip strip and first card */}
      <View style={S.chipToCardSpacer} />

      {isLoading ? (
        <OrdersSkeleton />
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={(item) => item.id}
          renderItem={renderOrder}
          contentContainerStyle={[S.listContent, { paddingBottom: listBottomPadding }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={C.navy}
              colors={[C.navy]}
            />
          }
          ListFooterComponent={renderFooter}
          ListEmptyComponent={
            rawOrders.length > 0 ? (
              <View style={S.emptyWrap}>
                <View style={S.emptyCircle}>
                  <Ionicons name="search-outline" size={rs(40)} color={C.navy} />
                </View>
                <Text style={S.emptyTitle}>No matches</Text>
                <Text style={S.emptyBody}>Try a different order ID, store name, or filter.</Text>
              </View>
            ) : (
              <View style={S.emptyWrap}>
                <View style={S.emptyCircle}>
                  <MaterialCommunityIcons name="package-variant-closed" size={rs(44)} color={C.navy} />
                </View>
                <Text style={S.emptyTitle}>No orders yet</Text>
                <Text style={S.emptyBody}>
                  Your order history will appear here once you start shopping.
                </Text>
                <TouchableOpacity style={S.shopBtn} onPress={() => router.push('/home')}>
                  <Text style={S.shopBtnTxt}>Start Shopping</Text>
                </TouchableOpacity>
              </View>
            )
          }
        />
      )}

      <SpotlightTour 
        visible={isTourActive && activeScreen === 'orders'} 
        steps={onboardingSteps}
        onComplete={handleOnboardingComplete}
      />
    </View>
  );
};

// ─── Styles ────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  hdrGradient: {
    position: 'relative', paddingBottom: rs(26), zIndex: 20,
    elevation: 12, shadowColor: C.navy,
    shadowOffset: { width: 0, height: rs(10) }, shadowOpacity: 0.22, shadowRadius: rs(20),
  },
  hdrGlow: {
    position: 'absolute', bottom: -rs(30), right: -rs(30),
    width: rs(150), height: rs(150), borderRadius: rs(75),
    backgroundColor: 'rgba(132,204,22,0.11)',
  },
  hdrInner: { paddingHorizontal: rs(20), paddingTop: rs(8), paddingBottom: rs(6) },
  hdrTop: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: rs(16),
  },
  backBtn: {
    width: rs(38), height: rs(38), borderRadius: rs(12),
    backgroundColor: 'rgba(255,255,255,0.11)', borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.16)', justifyContent: 'center', alignItems: 'center',
  },
  hdrCenter: { alignItems: 'center' },
  hdrEye: {
    fontSize: rf(10), fontFamily: 'Montserrat-SemiBold',
    color: 'rgba(255,255,255,0.45)', letterSpacing: 0.9,
    textTransform: 'uppercase', marginBottom: rs(2),
  },
  hdrTitle: { fontSize: rf(20), fontFamily: 'Montserrat-Bold', color: '#fff', letterSpacing: -0.3 },
  hdrStatPill: {
    alignItems: 'center', minWidth: rs(52),
    backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.16)', borderRadius: rs(20),
    paddingHorizontal: rs(12), paddingVertical: rs(6),
  },
  hdrStatN:   { fontSize: rf(16), fontFamily: 'Montserrat-Bold', color: '#fff' },
  hdrStatLbl: { fontSize: rf(9),  fontFamily: 'Montserrat-Medium', color: 'rgba(255,255,255,0.5)' },
  searchPill: {
    flexDirection: 'row', alignItems: 'center', gap: rs(9),
    backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.16)', borderRadius: rs(14),
    paddingHorizontal: rs(13), height: rs(48),
  },
  searchPillActive: { backgroundColor: 'rgba(255,255,255,0.16)', borderColor: 'rgba(255,255,255,0.3)' },
  searchInput: { flex: 1, fontSize: rf(13), fontFamily: 'Montserrat-Medium', color: '#fff', height: '100%' },
  searchClear: {
    width: rs(20), height: rs(20), borderRadius: rs(10),
    backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center',
  },
  hdrArc: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: rs(26),
    backgroundColor: C.bg, borderTopLeftRadius: rs(28), borderTopRightRadius: rs(28),
  },

  // ── Chip strip — THE FIX ──────────────────────────────────────────────────
  chipScrollView: {
    // Never allow the ScrollView to stretch its content area
    flexGrow: 0,
    flexShrink: 0,
  },
  chipStrip: {
    paddingHorizontal: rs(16),
    paddingTop: rs(14),
    paddingBottom: rs(10),
    gap: rs(8),
    flexDirection: 'row',
    // flexGrow:0 stops the container expanding to fill the scroll view,
    // which is what caused chips to drift to the centre when few were visible.
    flexGrow: 0,
    alignItems: 'center',
  },
  chip: {
    height: 36,
    paddingHorizontal: rs(16),
    borderRadius: 18,
    borderWidth: 0.5,
    borderColor: 'rgba(12,21,89,0.14)',
    backgroundColor: C.card,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 1,
    shadowColor: C.navy,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: rs(2),
  },
  chipOn:    { backgroundColor: C.navy, borderColor: C.navy },
  chipTxt:   { fontSize: rf(12), fontFamily: 'Montserrat-SemiBold', color: C.muted },
  chipTxtOn: { color: '#fff' },

  // ── Spacer between chips and first card ───────────────────────────────────
  chipToCardSpacer: {
    height: rs(12),   // comfortable breathing room
  },

  // List
  listContent: { paddingHorizontal: 0 },

  // Card
  card: {
    backgroundColor: C.card, borderRadius: rs(22),
    marginHorizontal: rs(14), marginBottom: rs(12), overflow: 'hidden',
    elevation: 4, shadowColor: C.navy,
    shadowOffset: { width: 0, height: rs(3) }, shadowOpacity: 0.07, shadowRadius: rs(12),
  },
  cardBar:  { height: rs(3) },
  cardBody: { padding: rs(14) },

  cardTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: rs(10),
  },
  storeRow: { flexDirection: 'row', alignItems: 'center', gap: rs(7), flex: 1, marginRight: rs(8) },
  storeIcon: {
    width: rs(28), height: rs(28), borderRadius: rs(9),
    backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden'
  },
  storeLogoImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  storeName: { fontSize: rf(13), fontFamily: 'Montserrat-Bold', color: '#334155' },
  storeCat: { fontSize: rf(10), fontFamily: 'Montserrat-Medium', color: C.subtle, marginTop: rs(1) },
  statusPill: {
    height: 26, paddingHorizontal: rs(10), borderRadius: 13,
    flexDirection: 'row', alignItems: 'center', gap: rs(5), flexShrink: 0,
  },
  statusDot: { width: rs(6), height: rs(6), borderRadius: rs(3), flexShrink: 0 },
  statusTxt: { fontSize: rf(11), fontFamily: 'Montserrat-Bold', lineHeight: rf(14) },

  // Timeline
  timeline: {
    flexDirection: 'row', alignItems: 'flex-start',
    marginBottom: rs(12), paddingHorizontal: rs(2),
  },
  tlStep:       { alignItems: 'center', minWidth: rs(36) },
  tlDot:        { width: rs(10), height: rs(10), borderRadius: rs(5), backgroundColor: '#E2E8F0' },
  tlDotDone:    { backgroundColor: C.lime },
  tlDotActive:  {
    backgroundColor: C.navy,
    shadowColor: C.navy, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35, shadowRadius: rs(4), elevation: 3,
  },
  tlLbl:        { fontSize: rf(8), fontFamily: 'Montserrat-SemiBold', color: C.subtle, marginTop: rs(3), textAlign: 'center' },
  tlLblDone:    { color: C.lime },
  tlLblActive:  { color: C.navy, fontFamily: 'Montserrat-Bold' },
  tlLine:       { flex: 1, height: rs(2), backgroundColor: '#E2E8F0', marginTop: rs(4), marginBottom: rs(14) },
  tlLineDone:   { backgroundColor: C.lime },

  cardMid: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: rs(11), borderTopWidth: 0.5, borderBottomWidth: 0.5,
    borderColor: '#F1F5F9', marginBottom: rs(11),
  },
  orderNum:   { fontSize: rf(13), fontFamily: 'Montserrat-Bold',   color: C.navy,   marginBottom: rs(3) },
  orderDate:  { fontSize: rf(11), fontFamily: 'Montserrat-Medium', color: C.subtle },
  amountWrap: { alignItems: 'flex-end' },
  amountLbl:  { fontSize: rf(10), fontFamily: 'Montserrat-Medium', color: C.subtle, marginBottom: rs(2) },
  amountVal:  { fontSize: rf(17), fontFamily: 'Montserrat-Bold',   color: C.body },

  cardFoot:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemsLbl:   { fontSize: rf(11), fontFamily: 'Montserrat-Medium', color: C.subtle },
  viewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: rs(3),
    backgroundColor: '#EEF2FF', paddingHorizontal: rs(11), paddingVertical: rs(7), borderRadius: rs(10),
  },
  viewBtnTxt: { fontSize: rf(11), fontFamily: 'Montserrat-Bold', color: C.navy },

  // Pagination
  pagination:   { alignItems: 'center', gap: rs(10), paddingVertical: rs(16) },
  pageInfo:     { fontSize: rf(11), fontFamily: 'Montserrat-Medium', color: C.subtle },
  pageControls: { flexDirection: 'row', alignItems: 'center', gap: rs(6) },
  pageBtn: {
    width: rs(34), height: rs(34), borderRadius: rs(10), backgroundColor: C.card,
    borderWidth: 0.5, borderColor: 'rgba(12,21,89,0.14)',
    justifyContent: 'center', alignItems: 'center',
    elevation: 1, shadowColor: C.navy,
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: rs(2),
  },
  pageBtnOff:   { borderColor: '#F1F5F9', backgroundColor: '#FAFAFA' },
  pageNum: {
    width: rs(34), height: rs(34), borderRadius: rs(10), backgroundColor: C.card,
    borderWidth: 0.5, borderColor: 'rgba(12,21,89,0.14)',
    justifyContent: 'center', alignItems: 'center',
  },
  pageNumOn:    { backgroundColor: C.navy, borderColor: C.navy },
  pageNumTxt:   { fontSize: rf(12), fontFamily: 'Montserrat-Bold', color: C.muted },
  pageNumTxtOn: { color: '#fff' },
  pageEllipsis: { fontSize: rf(13), color: C.subtle, paddingHorizontal: rs(2) },
  fetchingRow:  { flexDirection: 'row', alignItems: 'center', gap: rs(6) },
  fetchingTxt:  { fontSize: rf(11), fontFamily: 'Montserrat-Medium', color: C.subtle },

  // Empty
  emptyWrap: { alignItems: 'center', paddingTop: rs(60), paddingHorizontal: rs(40) },
  emptyCircle: {
    width: rs(90), height: rs(90), borderRadius: rs(45), backgroundColor: '#EEF2FF',
    justifyContent: 'center', alignItems: 'center', marginBottom: rs(16),
    elevation: 2, shadowColor: C.navy,
    shadowOffset: { width: 0, height: rs(3) }, shadowOpacity: 0.06, shadowRadius: rs(8),
  },
  emptyTitle: { fontSize: rf(17), fontFamily: 'Montserrat-Bold',   color: C.body,  marginBottom: rs(8) },
  emptyBody: {
    fontSize: rf(13), fontFamily: 'Montserrat-Medium', color: C.muted,
    textAlign: 'center', lineHeight: rf(20), marginBottom: rs(24),
  },
  shopBtn: {
    backgroundColor: C.navy, paddingVertical: rs(13), paddingHorizontal: rs(28),
    borderRadius: rs(14), elevation: 3, shadowColor: C.navy,
    shadowOffset: { width: 0, height: rs(4) }, shadowOpacity: 0.2, shadowRadius: rs(8),
  },
  shopBtnTxt: { color: '#fff', fontSize: rf(13), fontFamily: 'Montserrat-Bold' },
});

export default OrdersScreen;