import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Image, Dimensions, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import {
  getAdminDashboard, getAdminPayouts,
  getAdminAuditLogs,
} from '@/services/api';

const { width: SW } = Dimensions.get('window');
const SCALE = Math.min(Math.max(SW / 390, 0.85), 1.15);
const rs = (n: number) => Math.round(n * SCALE);
const rf = (n: number) => Math.round(n * Math.min(SCALE, 1.1));

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
};

// ─── Static chart data ─────────────────────────────────────────────────────────
const CHART = [
  { month: 'Jan', value: 80  },
  { month: 'Feb', value: 100 },
  { month: 'Mar', value: 90  },
  { month: 'Apr', value: 120 },
  { month: 'May', value: 110 },
  { month: 'Jun', value: 140 },
];
const CHART_MAX = Math.max(...CHART.map((c) => c.value));
const CHART_H   = rs(80); // pixel height of chart area

// ─── Activity icon map ─────────────────────────────────────────────────────────
const ACTION_MAP: Record<string, { icon: any; bg: string }> = {
  store_verified:        { icon: 'shield-checkmark', bg: '#DBEAFE' },
  store_rejected:        { icon: 'close-circle',     bg: '#FEE2E2' },
  user_updated:          { icon: 'person',            bg: '#FEF3C7' },
  payout_approved:       { icon: 'cash',              bg: '#DCFCE7' },
  payout_rejected:       { icon: 'close',             bg: '#FEE2E2' },
  order_status_changed:  { icon: 'cart',              bg: '#F3E8FF' },
  report_resolved:       { icon: 'flag',              bg: '#E0F2FE' },
};
const getAction = (action: string) =>
  ACTION_MAP[action] ?? { icon: 'notifications', bg: '#F1F5F9' };

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function AdminDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats,      setStats]      = useState({
    totalUsers: 0, totalStores: 0, totalOrders: 0, totalRevenue: 0,
    ordersGrowth: 0, storesGrowth: 0, usersGrowth: 0,
  });
  const [activityFeed, setActivityFeed] = useState<any[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [dashRes, actRes] = await Promise.all([
        getAdminDashboard(),
        getAdminAuditLogs({ limit: 8 }).catch(() => ({ logs: [], data: [] })),
      ]);

      if (dashRes.success) setStats(dashRes.stats);

      const logs =
        Array.isArray(actRes?.logs)  ? actRes.logs  :
        Array.isArray(actRes?.data)  ? actRes.data  :
        Array.isArray(actRes)        ? actRes        : [];
      setActivityFeed(logs);
    } catch (e) {
      console.error('Admin dashboard load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  if (loading && !refreshing) {
    return (
      <View style={S.centred}>
        <ActivityIndicator size="large" color={C.navy} />
      </View>
    );
  }

  // ── Stat cards config ──────────────────────────────────────────────────────
  const STAT_CARDS = [
    {
      label: 'Orders', value: stats.totalOrders,
      icon: 'shopping-bag', bg: '#DBEAFE', color: '#1E40AF',
      delta: stats.ordersGrowth, route: '/admin/orders',
    },
    {
      label: 'Stores', value: stats.totalStores,
      icon: 'home', bg: '#F3E8FF', color: '#7C3AED',
      delta: stats.storesGrowth, route: '/admin/stores',
    },
    {
      label: 'Users', value: stats.totalUsers,
      icon: 'users', bg: '#DCFCE7', color: '#15803D',
      delta: stats.usersGrowth, route: '/admin/users',
    },
  ];

  // --- NEW: Added Driver Verification and optimized for a 2x2 grid ---
  const CONTROL_CARDS = [
    { label: 'Store Verification',  icon: 'storefront',       route: '/admin/stores'      },
    { label: 'Driver Verification', icon: 'bicycle',          route: '/admin/driver-verifications/deriverVerifications'},
    { label: 'Ad Approvals',        icon: 'megaphone',        route: '/admin/ads'         }, 
    { label: 'Audit Logs',          icon: 'list',             route: '/admin/audit-logs'  },
    { label: 'Settings',            icon: 'settings-sharp',   route: '/admin/settings'    },
  ];

  return (
    <View style={S.root}>
      <StatusBar style="light" />

      {/* Watermark */}
      <View style={S.watermark} pointerEvents="none">
        <Image source={require('../../assets/images/splash-icon.png')} style={S.watermarkImg} />
      </View>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <LinearGradient
        colors={[C.navy, C.navyMid]}
        style={[S.header, { paddingTop: insets.top + rs(12) }]}
      >
        <View style={S.hdrGlow1} pointerEvents="none" />
        <View style={S.hdrGlow2} pointerEvents="none" />

        <SafeAreaView edges={['left', 'right']}>
          <View style={S.hdrInner}>
            {/* Title row */}
            <View style={S.hdrTop}>
              <View>
                <Text style={S.hdrEye}>Administrator</Text>
                <Text style={S.hdrTitle}>
                  System <Text style={{ color: C.lime }}>Hub</Text>
                </Text>
              </View>
              {/* Admin avatar */}
              <View style={S.avatarWrap}>
                <Text style={S.avatarLetter}>A</Text>
              </View>
            </View>

            {/* Revenue hero card */}
            <TouchableOpacity
              style={S.revenueHero}
              activeOpacity={0.85}
              onPress={() => router.push('/admin/revenue' as any)}
            >
              <View>
                <Text style={S.heroLbl}>Platform Revenue</Text>
                <Text style={S.heroVal}>
                  ₵{(stats.totalRevenue ?? 0).toLocaleString()}
                </Text>
              </View>
              <View style={S.heroRight}>
                <View style={S.heroBadge}>
                  <Feather name="trending-up" size={rs(11)} color={C.limeText} />
                  <Text style={S.heroBadgeTxt}>+24%</Text>
                </View>
                <Text style={S.heroSub}>vs last month</Text>
              </View>
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        <View style={S.hdrArc} />
      </LinearGradient>

      {/* ── Scroll ──────────────────────────────────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[S.scroll, { paddingBottom: rs(110) + insets.bottom }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.navy} colors={[C.navy]} />
        }
      >
        {/* ── Stat cards ─────────────────────────────────────────────────── */}
        <View style={S.statGrid}>
          {STAT_CARDS.map((s) => (
            <TouchableOpacity
              key={s.label}
              style={S.statCard}
              activeOpacity={0.82}
              onPress={() => router.push(s.route as any)}
            >
              <View style={[S.statIconWrap, { backgroundColor: s.bg }]}>
                <Feather name={s.icon as any} size={rs(18)} color={s.color} />
              </View>
              <Text style={S.statNum}>
                {s.value >= 1000
                  ? `${(s.value / 1000).toFixed(1)}k`
                  : s.value}
              </Text>
              <Text style={S.statLbl}>{s.label}</Text>
              {s.delta ? (
                <View style={S.deltaRow}>
                  <Ionicons
                    name={s.delta >= 0 ? 'caret-up' : 'caret-down'}
                    size={rs(9)}
                    color={s.delta >= 0 ? '#16a34a' : '#EF4444'}
                  />
                  <Text style={[S.deltaTxt, { color: s.delta >= 0 ? '#16a34a' : '#EF4444' }]}>
                    {Math.abs(s.delta)}%
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Revenue chart ───────────────────────────────────────────────── */}
        <Text style={S.secTitle}>Revenue Growth</Text>
        <View style={S.card}>
          {/* Bars */}
          <View style={[S.chartBars, { height: CHART_H + rs(20) }]}>
            {CHART.map((d, i) => {
              const barH   = Math.round((d.value / CHART_MAX) * CHART_H);
              const isLast = i === CHART.length - 1;
              const isPeak = d.value === Math.max(...CHART.filter((_, j) => j !== CHART.length - 1).map((c) => c.value));
              const barColor = isLast ? C.navy : isPeak ? C.lime : '#EEF2FF';
              return (
                <View key={d.month} style={S.barWrap}>
                  <View style={[S.bar, { height: barH, backgroundColor: barColor }]} />
                  <Text style={S.barLbl}>{d.month}</Text>
                </View>
              );
            })}
          </View>
          {/* Footer */}
          <View style={S.chartFoot}>
            <Text style={S.chartGrowth}>+24% from last month</Text>
            <Ionicons name="caret-up" size={rs(12)} color={C.lime} />
          </View>
        </View>

        {/* ── Live activity ───────────────────────────────────────────────── */}
        <Text style={S.secTitle}>Live Activity</Text>
        <View style={S.card}>
          {activityFeed.length === 0 ? (
            <View style={S.emptyActivity}>
              <MaterialCommunityIcons name="history" size={rs(30)} color={C.subtle} />
              <Text style={S.emptyActivityTxt}>No recent activity</Text>
            </View>
          ) : (
            activityFeed.slice(0, 8).map((item, i) => {
              const cfg       = getAction(item.action);
              const actorName = item.user?.full_name || item.user?.email || 'System';
              const isLast    = i === Math.min(activityFeed.length, 8) - 1;
              const actionLabel = (item.action ?? '')
                .replace(/_/g, ' ')
                .replace(/\b\w/g, (c: string) => c.toUpperCase());

              return (
                <View key={item.id ?? i} style={[S.actRow, isLast && { borderBottomWidth: 0 }]}>
                  <View style={[S.actIcon, { backgroundColor: cfg.bg }]}>
                    <Ionicons name={cfg.icon} size={rs(16)} color={C.navy} />
                  </View>
                  <View style={S.actInfo}>
                    <Text style={S.actTitle} numberOfLines={1}>{actionLabel}</Text>
                    <Text style={S.actSub} numberOfLines={1}>
                      {actorName} · {item.entity_type ?? ''}
                    </Text>
                  </View>
                  <Text style={S.actTime}>{timeAgo(item.timestamp)}</Text>
                </View>
              );
            })
          )}
        </View>

        {/* ── Platform controls ───────────────────────────────────────────── */}
        <Text style={S.secTitle}>Platform Management</Text>
        <View style={S.ctrlGrid}>
          {CONTROL_CARDS.map((c) => (
            <TouchableOpacity
              key={c.label}
              style={S.ctrlCard}
              activeOpacity={0.82}
              onPress={() => router.push(c.route as any)}
            >
              <View style={S.ctrlIcon}>
                <Ionicons name={c.icon as any} size={rs(22)} color={C.navy} />
              </View>
              <Text style={S.ctrlLbl}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

      </ScrollView>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  centred:{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },

  watermark:    { position: 'absolute', bottom: -50, right: -50, opacity: 0.05 },
  watermarkImg: { width: 300, height: 300, resizeMode: 'contain' },

  // Header
  header: {
    paddingBottom: rs(28), position: 'relative',
    elevation: 12, shadowColor: C.navy,
    shadowOffset: { width: 0, height: rs(8) }, shadowOpacity: 0.2, shadowRadius: rs(16),
  },
  hdrGlow1: {
    position: 'absolute', top: -rs(30), right: -rs(30),
    width: rs(160), height: rs(160), borderRadius: rs(80),
    backgroundColor: 'rgba(132,204,22,0.14)',
  },
  hdrGlow2: {
    position: 'absolute', bottom: -rs(30), left: -rs(20),
    width: rs(100), height: rs(100), borderRadius: rs(50),
    backgroundColor: 'rgba(30,58,138,0.6)',
  },
  hdrInner:  { paddingHorizontal: rs(22) },
  hdrTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: rs(16),
  },
  hdrEye: {
    fontSize: rf(10), fontFamily: 'Montserrat-Bold',
    color: 'rgba(255,255,255,0.4)', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: rs(3),
  },
  hdrTitle: { fontSize: rf(22), fontFamily: 'Montserrat-Bold', color: '#fff', letterSpacing: -0.4 },
  avatarWrap: {
    width: rs(42), height: rs(42), borderRadius: rs(14),
    backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center',
  },
  avatarLetter: { fontSize: rf(18), fontFamily: 'Montserrat-Bold', color: C.lime },

  // Revenue hero
  revenueHero: {
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: rs(20), padding: rs(16),
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.15)',
  },
  heroLbl: { fontSize: rf(11), fontFamily: 'Montserrat-Medium', color: 'rgba(255,255,255,0.55)', marginBottom: rs(4) },
  heroVal: { fontSize: rf(28), fontFamily: 'Montserrat-Bold',   color: '#fff', letterSpacing: -0.5 },
  heroRight: { alignItems: 'flex-end', gap: rs(4) },
  heroBadge: {
    flexDirection: 'row', alignItems: 'center', gap: rs(4),
    backgroundColor: 'rgba(132,204,22,0.2)', borderRadius: rs(20),
    paddingHorizontal: rs(10), paddingVertical: rs(4),
  },
  heroBadgeTxt: { fontSize: rf(11), fontFamily: 'Montserrat-Bold', color: C.lime },
  heroSub:      { fontSize: rf(9),  fontFamily: 'Montserrat-Medium', color: 'rgba(255,255,255,0.4)' },

  hdrArc: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: rs(26),
    backgroundColor: C.bg, borderTopLeftRadius: rs(28), borderTopRightRadius: rs(28),
  },

  scroll: { paddingHorizontal: rs(18), paddingTop: rs(10) },

  // Stat cards
  statGrid: { flexDirection: 'row', gap: rs(10), marginBottom: rs(22) },
  statCard: {
    flex: 1, backgroundColor: C.card, borderRadius: rs(20), padding: rs(13), alignItems: 'center',
    elevation: 3, shadowColor: C.navy,
    shadowOffset: { width: 0, height: rs(2) }, shadowOpacity: 0.06, shadowRadius: rs(8),
  },
  statIconWrap: {
    width: rs(36), height: rs(36), borderRadius: rs(11),
    justifyContent: 'center', alignItems: 'center', marginBottom: rs(8),
  },
  statNum:  { fontSize: rf(17), fontFamily: 'Montserrat-Bold',    color: C.body },
  statLbl:  { fontSize: rf(9),  fontFamily: 'Montserrat-SemiBold', color: C.subtle, textTransform: 'uppercase', marginTop: rs(2) },
  deltaRow: { flexDirection: 'row', alignItems: 'center', gap: rs(2), marginTop: rs(4) },
  deltaTxt: { fontSize: rf(9), fontFamily: 'Montserrat-Bold' },

  // Shared card
  card: {
    backgroundColor: C.card, borderRadius: rs(20), padding: rs(14), marginBottom: rs(20),
    elevation: 3, shadowColor: C.navy,
    shadowOffset: { width: 0, height: rs(2) }, shadowOpacity: 0.06, shadowRadius: rs(10),
  },

  // Section title
  secTitle: {
    fontSize: rf(14), fontFamily: 'Montserrat-Bold', color: C.body, marginBottom: rs(10),
  },

  // Chart
  chartBars: { flexDirection: 'row', alignItems: 'flex-end', gap: rs(7), marginBottom: rs(10) },
  barWrap:   { flex: 1, alignItems: 'center', gap: rs(5) },
  bar:       { width: '100%', borderRadius: rs(6) },
  barLbl:    { fontSize: rf(8), fontFamily: 'Montserrat-SemiBold', color: C.subtle },
  chartFoot: { flexDirection: 'row', alignItems: 'center', gap: rs(4) },
  chartGrowth:{ fontSize: rf(11), fontFamily: 'Montserrat-Bold', color: C.lime },

  // Activity
  emptyActivity:   { alignItems: 'center', paddingVertical: rs(24), gap: rs(8) },
  emptyActivityTxt:{ fontSize: rf(13), fontFamily: 'Montserrat-Medium', color: C.subtle },
  actRow: {
    flexDirection: 'row', alignItems: 'center', gap: rs(12),
    paddingVertical: rs(10),
    borderBottomWidth: 0.5, borderBottomColor: '#F8FAFC',
  },
  actIcon: { width: rs(36), height: rs(36), borderRadius: rs(11), justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  actInfo: { flex: 1 },
  actTitle:{ fontSize: rf(12), fontFamily: 'Montserrat-Bold',   color: C.body },
  actSub:  { fontSize: rf(10), fontFamily: 'Montserrat-Medium', color: C.subtle, marginTop: rs(2) },
  actTime: { fontSize: rf(9),  fontFamily: 'Montserrat-Medium', color: C.subtle, flexShrink: 0 },

  // Controls
  ctrlGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', // Allows items to wrap to next line
    justifyContent: 'space-between', // Spaces them evenly
    rowGap: rs(12), // Adds vertical space between rows
    marginBottom: rs(20) 
  },
  ctrlCard: {
    width: '48%', // Fits 2 items per row nicely
    backgroundColor: C.card, borderRadius: rs(20),
    paddingVertical: rs(16), alignItems: 'center',
    elevation: 3, shadowColor: C.navy,
    shadowOffset: { width: 0, height: rs(2) }, shadowOpacity: 0.06, shadowRadius: rs(8),
  },
  ctrlIcon: {
    width: rs(44), height: rs(44), borderRadius: rs(14),
    backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center', marginBottom: rs(8),
  },
  ctrlLbl: { 
    fontSize: rf(10), 
    fontFamily: 'Montserrat-Bold', 
    color: C.navy, 
    textAlign: 'center',
    paddingHorizontal: rs(5)
  },
});