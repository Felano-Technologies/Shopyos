import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  ScrollView, ActivityIndicator, Dimensions
} from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { LineChart } from 'react-native-chart-kit';
import { getBuyerAnalytics } from '@/services/api';
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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatMonthLabel(y: number, m: number) {
  return `${MONTHS[m - 1]} ${y}`;
}

function getCurrentMonth() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function getMonthData(year: number, month: number) {
  return { year, month, label: formatMonthLabel(year, month), param: `${year}-${String(month).padStart(2, '0')}` };
}

function getAdjacentMonth(year: number, month: number, delta: number) {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export default function BuyerAnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useThemeColors();
  const S = useMemo(() => getStyles(colors), [colors]);
  const params = useLocalSearchParams<{ month?: string }>();

  const initial = params.month ? (() => {
    const parts = params.month.split('-');
    return { year: parseInt(parts[0], 10), month: parseInt(parts[1], 10) };
  })() : getCurrentMonth();

  const [currentYear, setCurrentYear] = useState(initial.year);
  const [currentMonth, setCurrentMonth] = useState(initial.month);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnims = useRef([...Array(6)].map(() => new Animated.Value(30))).current;

  const monthData = getMonthData(currentYear, currentMonth);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getBuyerAnalytics(monthData.param);
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [monthData.param]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!loading && data) {
      fadeAnim.setValue(0);
      slideAnims.forEach(a => a.setValue(30));
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        ...slideAnims.map((anim, i) =>
          Animated.timing(anim, {
            toValue: 0, duration: 400, delay: i * 80, useNativeDriver: true,
          })
        ),
      ]).start();
    }
  }, [loading, data]);

  const goPrev = () => {
    const prev = getAdjacentMonth(currentYear, currentMonth, -1);
    setCurrentYear(prev.year);
    setCurrentMonth(prev.month);
  };

  const goNext = () => {
    const next = getAdjacentMonth(currentYear, currentMonth, 1);
    setCurrentYear(next.year);
    setCurrentMonth(next.month);
  };

  const current = getCurrentMonth();
  const isCurrentMonth = currentYear === current.year && currentMonth === current.month;

  const chartConfig = {
    backgroundGradientFrom: colors.surface,
    backgroundGradientTo: colors.surface,
    decimalPlaces: 2,
    color: (o = 1) => hexToRgba(colors.primary, o),
    labelColor: () => colors.textSecondary,
    propsForDots: { r: '4', strokeWidth: '2', stroke: colors.accent },
    propsForBackgroundLines: { strokeDasharray: '5', stroke: colors.border },
  };

  const hasChart = data?.spending_history?.labels?.length > 0 &&
    data?.spending_history?.data?.some((v: number) => v > 0);

  const renderCard = (index: number, content: React.ReactNode) => (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnims[index] }],
      }}
    >
      {content}
    </Animated.View>
  );

  return (
    <View style={S.root}>
      <StatusBar style="light" />
      <Stack.Screen options={{ headerShown: false }} />

      <LinearGradient colors={colors.headerGradient} style={[S.header, { paddingTop: insets.top + rs(10) }]}>
        <View style={S.hdrRow}>
          <TouchableOpacity style={S.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#FFF" />{/* white icon on header gradient, fixed dark navy in both themes */}
          </TouchableOpacity>
          <Text style={S.hdrTitle}>Your Month in Shopping</Text>
          <View style={{ width: rs(36) }} />
        </View>
        <View style={S.monthPicker}>
          <TouchableOpacity onPress={goPrev} style={S.monthArrow}>
            <Feather name="chevron-left" size={22} color="#FFF" />{/* white icon on header gradient, fixed dark navy in both themes */}
          </TouchableOpacity>
          <Text style={S.monthLabel}>{monthData.label}</Text>
          <TouchableOpacity onPress={goNext} style={S.monthArrow} disabled={isCurrentMonth}>
            {/* translucent/white icon on header gradient, fixed dark navy in both themes */}
            <Feather name="chevron-right" size={22} color={isCurrentMonth ? 'rgba(255,255,255,0.3)' : '#FFF'} />
          </TouchableOpacity>
        </View>
        <View style={S.hdrArc} />
      </LinearGradient>

      <ScrollView
        style={S.scroll}
        contentContainerStyle={[S.scrollContent, { paddingBottom: insets.bottom + rs(40) }]}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={S.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : !data ? (
          <View style={S.emptyContainer}>
            <MaterialCommunityIcons name="chart-bar" size={48} color={colors.textMuted} />
            <Text style={S.emptyText}>No data available for this month</Text>
          </View>
        ) : (
          <>
            {renderCard(0, (
              <LinearGradient colors={colors.headerGradient} style={S.heroCard}>
                <Text style={S.heroLabel}>Total Spent</Text>
                <Text style={S.heroValue}>₵{(data.total_spent || 0).toFixed(2)}</Text>
                <View style={S.heroDivider} />
                <View style={S.heroRow}>
                  <View style={S.heroStat}>
                    <Text style={S.heroStatVal}>{data.order_count || 0}</Text>
                    <Text style={S.heroStatLbl}>Orders</Text>
                  </View>
                </View>
              </LinearGradient>
            ))}

            {renderCard(1, (
              <View style={S.card}>
                <Text style={S.cardTitle}>You saved ₵{(data.total_savings || 0).toFixed(2)}</Text>
                <View style={S.savingsRow}>
                  <Feather name="tag" size={16} color={colors.success} />
                  <Text style={S.savingsLabel}>Promo codes:</Text>
                  <Text style={S.savingsValue}>₵{(data.promo_savings || 0).toFixed(2)}</Text>
                </View>
                <View style={S.savingsRow}>
                  <Feather name="percent" size={16} color={colors.success} />
                  <Text style={S.savingsLabel}>Bargain deals:</Text>
                  <Text style={S.savingsValue}>₵{(data.bargain_savings || 0).toFixed(2)}</Text>
                </View>
              </View>
            ))}

            {renderCard(2, (
              <View style={S.card}>
                <Text style={S.cardTitle}>Your Favourites</Text>
                {data.top_store ? (
                  <View style={S.favRow}>
                    <Feather name="home" size={16} color={colors.primary} />
                    <Text style={S.favLabel}>Top Store:</Text>
                    <Text style={S.favValue}>{data.top_store.name}</Text>
                  </View>
                ) : null}
                {data.top_category ? (
                  <View style={S.favRow}>
                    <Feather name="grid" size={16} color={colors.primary} />
                    <Text style={S.favLabel}>Top Category:</Text>
                    <Text style={S.favValue}>{data.top_category}</Text>
                  </View>
                ) : null}
                {!data.top_store && !data.top_category ? (
                  <Text style={S.mutedText}>No favourites data this month</Text>
                ) : null}
              </View>
            ))}

            {renderCard(3, (
              <View style={S.card}>
                <View style={S.loyaltyRow}>
                  <Ionicons name="star" size={20} color={colors.warning} />
                  <Text style={S.loyaltyText}>
                    {data.loyalty_points_earned || 0} points earned this month
                  </Text>
                </View>
              </View>
            ))}

            {renderCard(4, data.milestones?.length > 0 ? (
              <View style={S.card}>
                <Text style={S.cardTitle}>Milestones</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={S.milestoneScroll}>
                  {data.milestones.map((m: any) => (
                    <View
                      key={m.id}
                      style={[S.badgeChip, m.achieved ? S.badgeAchieved : S.badgeUnachieved]}
                    >
                      <Text style={[S.badgeIcon, m.achieved ? S.badgeIconAchieved : S.badgeIconUnachieved]}>
                        {m.achieved ? '✓' : '○'}
                      </Text>
                      <Text style={[S.badgeLabel, m.achieved ? S.badgeLabelAchieved : S.badgeLabelUnachieved]}>
                        {m.label}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            ) : null)}

            {renderCard(5, (
              <View style={S.card}>
                <Text style={S.cardTitle}>Spending History</Text>
                {hasChart ? (
                  <LineChart
                    data={{
                      labels: data.spending_history.labels,
                      datasets: [{ data: data.spending_history.data }],
                    }}
                    width={SW - rs(56)}
                    height={200}
                    chartConfig={chartConfig}
                    bezier
                    style={{ borderRadius: rs(12), marginTop: rs(8) }}
                    withInnerLines
                    withOuterLines={false}
                    withVerticalLines={false}
                    yAxisLabel="₵"
                    yAxisInterval={1}
                  />
                ) : (
                  <View style={S.emptyChart}>
                    <MaterialCommunityIcons name="chart-line-variant" size={32} color={colors.textMuted} />
                    <Text style={S.emptyText}>No spending history yet</Text>
                  </View>
                )}
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const getStyles = (c: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.surfaceElevated },
  header: {
    paddingHorizontal: rs(20), paddingBottom: rs(35),
    borderBottomLeftRadius: rs(24), borderBottomRightRadius: rs(24),
  },
  hdrRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  backBtn: {
    width: rs(36), height: rs(36), borderRadius: rs(18),
    backgroundColor: 'rgba(255,255,255,0.15)', // translucent overlay on header gradient, fixed dark navy in both themes
    alignItems: 'center', justifyContent: 'center',
  },
  hdrTitle: {
    fontSize: rf(16), fontFamily: 'Montserrat-Bold', color: '#FFF', flex: 1, textAlign: 'center', // white text on header gradient, fixed dark navy in both themes
  },
  monthPicker: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: rs(12),
  },
  monthArrow: {
    width: rs(36), height: rs(36), borderRadius: rs(18),
    backgroundColor: 'rgba(255,255,255,0.1)', // translucent overlay on header gradient, fixed dark navy in both themes
    alignItems: 'center', justifyContent: 'center',
  },
  monthLabel: {
    fontSize: rf(18), fontFamily: 'Montserrat-Bold', color: '#FFF', // white text on header gradient, fixed dark navy in both themes
    marginHorizontal: rs(20), minWidth: rs(140), textAlign: 'center',
  },
  hdrArc: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: rs(24),
    backgroundColor: c.surfaceElevated, borderTopLeftRadius: rs(24), borderTopRightRadius: rs(24),
  },
  scroll: { flex: 1 },
  scrollContent: { padding: rs(16), gap: rs(12) },
  loadingContainer: { paddingVertical: rs(60), alignItems: 'center' },
  emptyContainer: { paddingVertical: rs(60), alignItems: 'center' },
  emptyText: { fontSize: rf(13), fontFamily: 'Montserrat-Medium', color: c.textMuted, marginTop: rs(8) },
  emptyChart: { height: 160, justifyContent: 'center', alignItems: 'center' },
  mutedText: { fontSize: rf(13), fontFamily: 'Montserrat-Medium', color: c.textSecondary },

  heroCard: {
    borderRadius: rs(18), padding: rs(20),
    elevation: 4, shadowColor: c.primary,
    shadowOffset: { width: 0, height: rs(4) }, shadowOpacity: 0.15, shadowRadius: rs(8),
  },
  heroLabel: { fontSize: rf(13), fontFamily: 'Montserrat-Medium', color: 'rgba(255,255,255,0.7)' }, // translucent white on headerGradient-colored hero card, fixed dark navy in both themes
  heroValue: {
    fontSize: rf(32), fontFamily: 'Montserrat-Bold', color: '#FFF', marginTop: rs(4), // white text on headerGradient-colored hero card, fixed dark navy in both themes
  },
  heroDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: rs(12) }, // translucent divider on headerGradient-colored hero card, fixed dark navy in both themes
  heroRow: { flexDirection: 'row', gap: rs(24) },
  heroStat: {},
  heroStatVal: { fontSize: rf(20), fontFamily: 'Montserrat-Bold', color: '#FFF' }, // white text on headerGradient-colored hero card, fixed dark navy in both themes
  heroStatLbl: { fontSize: rf(11), fontFamily: 'Montserrat-Medium', color: 'rgba(255,255,255,0.6)' }, // translucent white on headerGradient-colored hero card, fixed dark navy in both themes

  card: {
    backgroundColor: c.surface, borderRadius: rs(16), padding: rs(16),
    elevation: 2, shadowColor: '#000',
    shadowOffset: { width: 0, height: rs(1) }, shadowOpacity: 0.05, shadowRadius: rs(4),
  },
  cardTitle: {
    fontSize: rf(16), fontFamily: 'Montserrat-Bold', color: c.text, marginBottom: rs(10),
  },

  savingsRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: rs(6), gap: rs(6),
  },
  savingsLabel: { fontSize: rf(13), fontFamily: 'Montserrat-Medium', color: c.textSecondary, flex: 1 },
  savingsValue: { fontSize: rf(14), fontFamily: 'Montserrat-Bold', color: c.success },

  favRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: rs(6), gap: rs(6),
  },
  favLabel: { fontSize: rf(13), fontFamily: 'Montserrat-Medium', color: c.textSecondary },
  favValue: { fontSize: rf(14), fontFamily: 'Montserrat-Bold', color: c.text, flex: 1 },

  loyaltyRow: { flexDirection: 'row', alignItems: 'center', gap: rs(8) },
  loyaltyText: { fontSize: rf(15), fontFamily: 'Montserrat-SemiBold', color: c.text },

  milestoneScroll: { marginTop: rs(4) },
  badgeChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: rs(6), paddingHorizontal: rs(12),
    borderRadius: rs(20), marginRight: rs(8),
  },
  // Light green success tint — no themed "success background" token exists for chip fills.
  badgeAchieved: { backgroundColor: '#DCFCE7', borderWidth: 1, borderColor: '#BBF7D0' },
  badgeUnachieved: { backgroundColor: c.border, borderWidth: 1, borderColor: c.borderStrong },
  badgeIcon: { fontSize: rf(14), marginRight: rs(4) },
  badgeIconAchieved: { color: c.success },
  badgeIconUnachieved: { color: c.textMuted },
  badgeLabel: { fontSize: rf(11), fontFamily: 'Montserrat-SemiBold' },
  badgeLabelAchieved: { color: c.success },
  badgeLabelUnachieved: { color: c.textSecondary },
});
