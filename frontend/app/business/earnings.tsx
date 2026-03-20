import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Dimensions, ActivityIndicator, Image, ScrollView,
} from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import BusinessBottomNav from '../../components/BusinessBottomNav';
import { router } from 'expo-router';
import { storage } from '@/services/api';
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

type Range = 'Week' | 'Month' | 'Quarter';

const EARNINGS_DATA: Record<Range, number[]> = {
  Week:    [120, 140, 170, 130, 160, 180, 210],
  Month:   [520, 460, 490, 580],
  Quarter: [1200, 980, 1020],
};
const RANGE_LABELS: Record<Range, string[]> = {
  Week:    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  Month:   ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4'],
  Quarter: ['Q1', 'Q2', 'Q3'],
};

const EARNING_ITEMS = [
  { id: 'e1', label: 'Orders', icon: 'cart-outline',      iconBg: '#DBEAFE', iconColor: '#1E40AF', amount: 30, value: 650.0,  trend: '+12%', up: true  },
  { id: 'e2', label: 'Tips',   icon: 'gift-outline',      iconBg: '#DCFCE7', iconColor: '#15803D', amount: 12, value: 180.5,  trend: '+5%',  up: true  },
  { id: 'e3', label: 'Refunds',icon: 'return-down-back',  iconBg: '#FEE2E2', iconColor: '#B91C1C', amount: 3,  value: -60.0,  trend: '-2%',  up: false },
];

const EarningsScreen = () => {
  const insets = useSafeAreaInsets();

  // ── ALL HOOKS FIRST ───────────────────────────────────────────────────────
  const { isChecking, isVerified } = useSellerGuard();
  const [range, setRange] = useState<Range>('Week');

  useEffect(() => {
    storage.getItem('currentBusinessVerificationStatus').then((status) => {
      if (status && status !== 'verified') router.replace('/business/dashboard');
    });
  }, []);
  // ── END OF HOOKS ──────────────────────────────────────────────────────────

  if (isChecking || !isVerified) {
    return <View style={S.centred}><ActivityIndicator size="large" color={C.navy} /></View>;
  }

  const totalEarnings = EARNING_ITEMS.reduce((s, i) => s + i.value, 0);
  const chartData     = EARNINGS_DATA[range];
  const chartMax      = Math.max(...chartData);

  const chartConfig = {
    backgroundGradientFrom: '#fff',
    backgroundGradientTo:   '#fff',
    decimalPlaces: 0,
    color: (o = 1) => `rgba(12,21,89,${o})`,
    labelColor: (o = 1) => `rgba(100,116,139,${o})`,
    propsForDots: { r: '4', strokeWidth: '2', stroke: C.lime },
    propsForBackgroundLines: { strokeDasharray: '4', stroke: 'rgba(0,0,0,0.05)' },
    propsForLabels: { fontFamily: 'Montserrat-Medium', fontSize: 10 },
  };

  return (
    <View style={S.root}>
      <StatusBar style="light" />

      <View style={S.watermark}>
        <Image source={require('../../assets/images/splash-icon.png')} style={S.watermarkImg} />
      </View>

      <SafeAreaView style={{ flex: 1 }} edges={['left', 'right']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[S.scroll, { paddingBottom: rs(100) + insets.bottom }]}
        >
          {/* ── Header ─────────────────────────────────────────────────── */}
          <LinearGradient
            colors={[C.navy, C.navyMid]}
            style={[S.header, { paddingTop: insets.top + rs(16) }]}
          >
            <View style={S.hdrGlow} pointerEvents="none" />
            <View style={S.hdrRow}>
              <Image source={require('../../assets/images/iconwhite.png')} style={S.logo} resizeMode="contain" />
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
                data={{ labels: RANGE_LABELS[range], datasets: [{ data: chartData }] }}
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

            {EARNING_ITEMS.map((item) => (
              <View key={item.id} style={S.earnCard}>
                <View style={[S.earnIcon, { backgroundColor: item.iconBg }]}>
                  <Ionicons name={item.icon as any} size={rs(20)} color={item.iconColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={S.earnLbl}>{item.label}</Text>
                  <Text style={S.earnCount}>{item.amount} transactions</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[S.earnAmt, { color: item.value < 0 ? '#EF4444' : C.body }]}>
                    {item.value < 0 ? '-' : ''}₵{Math.abs(item.value).toFixed(2)}
                  </Text>
                  <View style={S.trendRow}>
                    <Feather
                      name={item.up ? 'trending-up' : 'trending-down'}
                      size={rs(11)}
                      color={item.up ? '#15803D' : '#EF4444'}
                    />
                    <Text style={[S.trendTxt, { color: item.up ? '#15803D' : '#EF4444' }]}>
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

const S = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  centred:{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },
  watermark:    { position: 'absolute', bottom: 20, left: -20 },
  watermarkImg: { width: 130, height: 130, resizeMode: 'contain', opacity: 0.07 },
  scroll: { flexGrow: 1 },

  header: {
    paddingHorizontal: rs(20), paddingBottom: rs(28), position: 'relative',
    elevation: 10, shadowColor: C.navy,
    shadowOffset: { width: 0, height: rs(8) }, shadowOpacity: 0.2, shadowRadius: rs(16),
  },
  hdrGlow: {
    position: 'absolute', top: -rs(30), right: -rs(30),
    width: rs(150), height: rs(150), borderRadius: rs(75),
    backgroundColor: 'rgba(132,204,22,0.12)',
  },
  hdrRow:   { marginBottom: rs(12) },
  logo:     { width: 110, height: 34 },
  hdrTitle: { fontSize: rf(26), fontFamily: 'Montserrat-Bold',   color: '#fff' },
  hdrSub:   { fontSize: rf(13), fontFamily: 'Montserrat-Medium', color: 'rgba(255,255,255,0.6)', marginTop: rs(3), marginBottom: rs(16) },
  totalPill: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: rs(16), padding: rs(14),
  },
  totalPillLbl: { fontSize: rf(12), fontFamily: 'Montserrat-Medium', color: 'rgba(255,255,255,0.6)', marginBottom: rs(4) },
  totalPillVal: { fontSize: rf(28), fontFamily: 'Montserrat-Bold',   color: '#fff' },
  hdrArc: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: rs(24),
    backgroundColor: C.bg, borderTopLeftRadius: rs(24), borderTopRightRadius: rs(24),
  },

  body: { paddingHorizontal: rs(16), paddingTop: rs(8) },

  toggleRow: { flexDirection: 'row', gap: rs(10), marginBottom: rs(16), marginTop: rs(4) },
  toggleBtn: {
    paddingVertical: rs(8), paddingHorizontal: rs(20), borderRadius: rs(20),
    borderWidth: 0.5, borderColor: 'rgba(12,21,89,0.14)', backgroundColor: C.card,
    elevation: 1, shadowColor: C.navy,
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: rs(2),
  },
  toggleBtnOn: { backgroundColor: C.navy, borderColor: C.navy },
  toggleTxt:   { fontSize: rf(13), fontFamily: 'Montserrat-SemiBold', color: C.muted },
  toggleTxtOn: { color: '#fff' },

  card: {
    backgroundColor: C.card, borderRadius: rs(18), padding: rs(14), marginBottom: rs(16),
    elevation: 3, shadowColor: C.navy,
    shadowOffset: { width: 0, height: rs(2) }, shadowOpacity: 0.06, shadowRadius: rs(10),
    alignItems: 'center',
  },

  secTitle: { fontSize: rf(16), fontFamily: 'Montserrat-Bold', color: C.navy, marginBottom: rs(12) },

  earnCard: {
    flexDirection: 'row', alignItems: 'center', gap: rs(12),
    backgroundColor: C.card, borderRadius: rs(18), padding: rs(14), marginBottom: rs(10),
    elevation: 3, shadowColor: C.navy,
    shadowOffset: { width: 0, height: rs(2) }, shadowOpacity: 0.06, shadowRadius: rs(10),
  },
  earnIcon:  { width: rs(44), height: rs(44), borderRadius: rs(14), justifyContent: 'center', alignItems: 'center' },
  earnLbl:   { fontSize: rf(14), fontFamily: 'Montserrat-Bold',   color: C.body, marginBottom: rs(3) },
  earnCount: { fontSize: rf(11), fontFamily: 'Montserrat-Medium', color: C.subtle },
  earnAmt:   { fontSize: rf(15), fontFamily: 'Montserrat-Bold',   color: C.body },
  trendRow:  { flexDirection: 'row', alignItems: 'center', gap: rs(3), marginTop: rs(3) },
  trendTxt:  { fontSize: rf(11), fontFamily: 'Montserrat-SemiBold' },
});

export default EarningsScreen;