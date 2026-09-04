import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Dimensions, ActivityIndicator, ScrollView, RefreshControl,
} from 'react-native';
import AppImage from '@/components/AppImage';
import { Ionicons, Feather } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import BusinessBottomNav from '../../components/BusinessBottomNav';
import { useSellerGuard } from '@/hooks/useSellerGuard';
import { getSellerTransactions, storage } from '@/services/api';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';
const { width: SW } = Dimensions.get('window');
const SCALE = Math.min(Math.max(SW / 390, 0.85), 1.15);
const rs = (n: number) => Math.round(n * SCALE);
const rf = (n: number) => Math.round(n * Math.min(SCALE, 1.1));

// Converts a themed hex color into an rgba() string for react-native-chart-kit,
// which requires a (opacity) => string function rather than a plain color.
const hexToRgba = (hex: string, opacity: number) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${opacity})`;
};
type Range = 'Week' | 'Month' | 'Quarter';
const RANGE_DAYS: Record<Range, number> = { Week: 7, Month: 28, Quarter: 90 };

// Bucket sale amounts from balance_logs into a chart series for the range
function buildSeries(logs: any[], range: Range): { labels: string[]; data: number[] } {
  const now = new Date();
  const days = RANGE_DAYS[range];
  const cutoff = new Date(now.getTime() - days * 86400000);
  const sales = logs.filter(
    (l) => l.transaction_type === 'sale' && new Date(l.created_at) >= cutoff
  );

  if (range === 'Week') {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const labels: string[] = [];
    const data = new Array(7).fill(0);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      labels.push(dayNames[d.getDay()]);
    }
    sales.forEach((l) => {
      const idx = 6 - Math.floor((now.getTime() - new Date(l.created_at).getTime()) / 86400000);
      if (idx >= 0 && idx < 7) data[idx] += Number.parseFloat(l.amount);
    });
    return { labels, data };
  }

  const buckets = range === 'Month' ? 4 : 3;
  const bucketDays = days / buckets;
  const labels = range === 'Month'
    ? ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4']
    : ['Mo 1', 'Mo 2', 'Mo 3'];
  const data = new Array(buckets).fill(0);
  sales.forEach((l) => {
    const age = (now.getTime() - new Date(l.created_at).getTime()) / 86400000;
    const idx = buckets - 1 - Math.floor(age / bucketDays);
    if (idx >= 0 && idx < buckets) data[idx] += Number.parseFloat(l.amount);
  });
  return { labels, data };
}

// Aggregate breakdown totals within the range, with trend vs the previous equal period
function buildBreakdown(logs: any[], range: Range) {
  const now = Date.now();
  const days = RANGE_DAYS[range];
  const cutoff = now - days * 86400000;
  const prevCutoff = now - 2 * days * 86400000;

  const agg = (type: string, from: number, to: number) => {
    const rows = logs.filter((l) => {
      const t = new Date(l.created_at).getTime();
      return l.transaction_type === type && t >= from && t < to;
    });
    return {
      count: rows.length,
      total: rows.reduce((s, l) => s + Number.parseFloat(l.amount), 0),
    };
  };

  const trend = (cur: number, prev: number) => {
    if (!prev) return { label: cur ? '+100%' : '0%', up: cur >= 0 };
    const pct = Math.round(((Math.abs(cur) - Math.abs(prev)) / Math.abs(prev)) * 100);
    return { label: `${pct >= 0 ? '+' : ''}${pct}%`, up: pct >= 0 };
  };

  // Category badge tints — fixed brand/status accents per transaction type,
  // intentionally not tokenized (decorative categorical distinction).
  return [
    { key: 'sale',       label: 'Orders',  icon: 'cart-outline',     iconBg: '#DBEAFE', iconColor: '#1E40AF' },
    { key: 'withdrawal', label: 'Payouts', icon: 'wallet-outline',   iconBg: '#E0E7FF', iconColor: '#0C1559' },
    { key: 'refund',     label: 'Refunds', icon: 'return-down-back', iconBg: '#FEE2E2', iconColor: '#B91C1C' },
  ].map((cfg) => {
    const cur = agg(cfg.key, cutoff, now);
    const prev = agg(cfg.key, prevCutoff, cutoff);
    const t = trend(cur.total, prev.total);
    return { id: cfg.key, ...cfg, amount: cur.count, value: cur.total, trend: t.label, up: t.up };
  });
}
const EarningsScreen = () => {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const S = useMemo(() => getStyles(colors), [colors]);
  // ── ALL HOOKS FIRST ───────────────────────────────────────────────────────
  const { isChecking, isVerified } = useSellerGuard();
  const [range, setRange] = useState<Range>('Week');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [logs, setLogs] = useState<any[]>([]);

  const loadData = useCallback(async () => {
    setLoadError(null);
    try {
      const storeId = await storage.getItem('currentBusinessId');
      if (!storeId) { setLoadError('No active store selected.'); return; }
      // Pull recent ledger entries; 90 days of history is enough for all ranges
      const res = await getSellerTransactions(storeId, { limit: 100 });
      setLogs(res?.transactions || []);
    } catch (e: any) {
      setLoadError(e.message || 'Failed to load earnings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadData();
    } finally {
      setRefreshing(false);
    }
  }, [loadData]);

  const series = useMemo(() => buildSeries(logs, range), [logs, range]);
  const breakdown = useMemo(() => buildBreakdown(logs, range), [logs, range]);
  // ── END OF HOOKS ──────────────────────────────────────────────────────────
  if (isChecking || !isVerified || loading) {
    return <View style={S.centred}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }
  if (loadError) {
    return (
      <View style={S.centred}>
        <Text style={{ fontFamily: 'Montserrat-Bold', fontSize: rf(16), color: colors.text, marginBottom: rs(8) }}>
          Couldn&apos;t load earnings
        </Text>
        <Text style={{ fontFamily: 'Montserrat-Medium', fontSize: rf(13), color: colors.textSecondary, marginBottom: rs(16), textAlign: 'center', paddingHorizontal: rs(40) }}>
          {loadError}
        </Text>
        <TouchableOpacity
          style={{ backgroundColor: colors.primary, paddingVertical: rs(10), paddingHorizontal: rs(24), borderRadius: rs(12) }}
          onPress={() => { setLoading(true); loadData(); }}
        >
          <Text style={{ color: '#fff', fontFamily: 'Montserrat-Bold', fontSize: rf(13) }}>{/* white text on the fixed-brand retry button */}Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }
  const totalEarnings = breakdown.reduce((s, i) => s + i.value, 0);
  const chartData     = series.data.some((v) => v > 0) ? series.data : [0];
  const chartConfig = {
    backgroundGradientFrom: colors.surface,
    backgroundGradientTo:   colors.surface,
    decimalPlaces: 0,
    color: (o = 1) => hexToRgba(colors.primary, o),
    labelColor: (o = 1) => hexToRgba(colors.textSecondary, o),
    propsForDots: { r: '4', strokeWidth: '2', stroke: colors.accent },
    propsForBackgroundLines: { strokeDasharray: '4', stroke: colors.border },
    propsForLabels: { fontFamily: 'Montserrat-Medium', fontSize: 10 },
  };
  return (
    <View style={S.root}>
      <StatusBar style="light" />
      <View style={S.watermark}>
        <AppImage source={require('../../assets/images/splash-icon.png')} style={S.watermarkImg} />
      </View>
      <SafeAreaView style={{ flex: 1 }} edges={['left', 'right']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[S.scroll, { paddingBottom: rs(100) + insets.bottom }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
          }
        >
          {/* ── Header ─────────────────────────────────────────────────── */}
          <LinearGradient
            colors={colors.headerGradient}
            style={[S.header, { paddingTop: insets.top + rs(16) }]}
          >
            <View style={S.hdrGlow} pointerEvents="none" />
            <View style={S.hdrRow}>
              <AppImage source={require('../../assets/images/iconwhite.png')} style={S.logo} contentFit="contain" />
            </View>
            <Text style={S.hdrTitle}>Earnings</Text>
            <Text style={S.hdrSub}>Your income at a glance</Text>
            {/* Total earnings pill inside header */}
            <View style={S.totalPill}>
              <Text style={S.totalPillLbl}>Net Earnings</Text>
              <Text style={S.totalPillVal}>₵{totalEarnings.toFixed(2)}</Text>
            </View>
            <View style={S.hdrArc} />
          </LinearGradient>
          {/* ── Body ───────────────────────────────────────────────────── */}
          <View style={S.body}>
            {/* Range toggle */}
            <View style={S.toggleRow}>
              {(['Week', 'Month', 'Quarter'] as Range[]).map((r) => {
                const on = range === r;
                return (
                  <TouchableOpacity
                    key={r}
                    style={[S.toggleBtn, on && S.toggleBtnOn]}
                    onPress={() => setRange(r)}
                  >
                    <Text style={[S.toggleTxt, on && S.toggleTxtOn]}>{r}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {/* Line chart */}
            <View style={S.card}>
              <LineChart
                data={{ labels: series.labels, datasets: [{ data: chartData }] }}
                width={SW - rs(48)}
                height={200}
                chartConfig={chartConfig}
                bezier
                style={{ borderRadius: rs(16) }}
                withInnerLines withOuterLines={false} withVerticalLines={false}
                yAxisLabel="₵" yAxisInterval={1}
              />
            </View>
            {/* Earning breakdown */}
            <Text style={S.secTitle}>Breakdown</Text>
            {breakdown.map((item) => (
              <View key={item.id} style={S.earnCard}>
                <View style={[S.earnIcon, { backgroundColor: item.iconBg }]}>
                  <Ionicons name={item.icon as any} size={rs(20)} color={item.iconColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={S.earnLbl}>{item.label}</Text>
                  <Text style={S.earnCount}>{item.amount} transactions</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[S.earnAmt, { color: item.value < 0 ? colors.error : colors.text }]}>
                    {item.value < 0 ? '-' : ''}₵{Math.abs(item.value).toFixed(2)}
                  </Text>
                  <View style={S.trendRow}>
                    <Feather
                      name={item.up ? 'trending-up' : 'trending-down'}
                      size={rs(11)}
                      color={item.up ? colors.success : colors.error}
                    />
                    <Text style={[S.trendTxt, { color: item.up ? colors.success : colors.error }]}>
                      {item.trend}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
        <BusinessBottomNav />
      </SafeAreaView>
    </View>
  );
};
const getStyles = (c: ThemeColors) => StyleSheet.create({
  root:   { flex: 1, backgroundColor: c.border },
  centred:{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.border },
  watermark:    { position: 'absolute', bottom: 20, left: -20 },
  watermarkImg: { width: 130, height: 130, resizeMode: 'contain', opacity: 0.03 },
  scroll: { flexGrow: 1 },
  header: {
    paddingHorizontal: rs(20), paddingBottom: rs(28), position: 'relative',
    elevation: 10, shadowColor: c.primary,
    shadowOffset: { width: 0, height: rs(8) }, shadowOpacity: 0.2, shadowRadius: rs(16),
  },
  hdrGlow: {
    position: 'absolute', top: -rs(30), right: -rs(30),
    width: rs(150), height: rs(150), borderRadius: rs(75),
    backgroundColor: 'rgba(132,204,22,0.12)', // decorative low-opacity glow, fixed regardless of theme
  },
  hdrRow:   { marginBottom: rs(12) },
  logo:     { width: 110, height: 34 },
  hdrTitle: { fontSize: rf(26), fontFamily: 'Montserrat-Bold',   color: '#fff' }, // white text on the fixed dark-navy headerGradient
  hdrSub:   { fontSize: rf(13), fontFamily: 'Montserrat-Medium', color: 'rgba(255,255,255,0.6)', marginTop: rs(3), marginBottom: rs(16) }, // translucent white on the fixed headerGradient
  totalPill: {
    backgroundColor: 'rgba(255,255,255,0.1)', // glass overlay on the fixed headerGradient
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.18)', // glass overlay border on the fixed headerGradient
    borderRadius: rs(16), padding: rs(14),
  },
  totalPillLbl: { fontSize: rf(12), fontFamily: 'Montserrat-Medium', color: 'rgba(255,255,255,0.6)', marginBottom: rs(4) }, // translucent white on the fixed headerGradient
  totalPillVal: { fontSize: rf(28), fontFamily: 'Montserrat-Bold',   color: '#fff' }, // white text on the fixed headerGradient
  hdrArc: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: rs(24),
    backgroundColor: c.border, borderTopLeftRadius: rs(24), borderTopRightRadius: rs(24),
  },
  body: { paddingHorizontal: rs(16), paddingTop: rs(8) },
  toggleRow: { flexDirection: 'row', gap: rs(10), marginBottom: rs(16), marginTop: rs(4) },
  toggleBtn: {
    paddingVertical: rs(8), paddingHorizontal: rs(20), borderRadius: rs(20),
    borderWidth: 0.5, borderColor: c.border, backgroundColor: c.surface,
    elevation: 1, shadowColor: c.primary,
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: rs(2),
  },
  toggleBtnOn: { backgroundColor: c.primary, borderColor: c.primary },
  toggleTxt:   { fontSize: rf(13), fontFamily: 'Montserrat-SemiBold', color: c.textSecondary },
  toggleTxtOn: { color: '#fff' }, // white text on the fixed-brand active toggle
  card: {
    backgroundColor: c.surface, borderRadius: rs(18), padding: rs(14), marginBottom: rs(16),
    elevation: 3, shadowColor: c.primary,
    shadowOffset: { width: 0, height: rs(2) }, shadowOpacity: 0.06, shadowRadius: rs(10),
    alignItems: 'center',
  },
  secTitle: { fontSize: rf(16), fontFamily: 'Montserrat-Bold', color: c.primary, marginBottom: rs(12) },
  earnCard: {
    flexDirection: 'row', alignItems: 'center', gap: rs(12),
    backgroundColor: c.surface, borderRadius: rs(18), padding: rs(14), marginBottom: rs(10),
    elevation: 3, shadowColor: c.primary,
    shadowOffset: { width: 0, height: rs(2) }, shadowOpacity: 0.06, shadowRadius: rs(10),
  },
  earnIcon:  { width: rs(44), height: rs(44), borderRadius: rs(14), justifyContent: 'center', alignItems: 'center' },
  earnLbl:   { fontSize: rf(14), fontFamily: 'Montserrat-Bold',   color: c.text, marginBottom: rs(3) },
  earnCount: { fontSize: rf(11), fontFamily: 'Montserrat-Medium', color: c.textMuted },
  earnAmt:   { fontSize: rf(15), fontFamily: 'Montserrat-Bold',   color: c.text },
  trendRow:  { flexDirection: 'row', alignItems: 'center', gap: rs(3), marginTop: rs(3) },
  trendTxt:  { fontSize: rf(11), fontFamily: 'Montserrat-SemiBold' },
});
export default EarningsScreen;