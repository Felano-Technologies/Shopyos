import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Dimensions,
  Modal,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AdminPanel } from '@/components/admin/AdminShell';
import AdminScreenSkeleton from '@/components/admin/AdminSkeleton';
import { useAdminColors, AdminColors } from '@/components/admin/adminTheme';
import { GlassSurface } from '@/components/ui/GlassSurface';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { LineChart } from 'react-native-chart-kit';
import { getFinancialSummary } from '@/services/api';

const { width: SW } = Dimensions.get('window');

type FinancialSummary = {
  period: { from: string; to: string };
  revenue: {
    grand_total: number;
    sources: {
      buyer_protection_fees: { total: number };
      ad_revenue: { total: number };
      platform_commission: { total: number };
      delivery_fees_retained: { total: number };
      hub_commission: { total: number };
    };
  };
  expenses: { total: number; by_category: { category_id: string; category_name: string; total: number }[] };
  net_profit: number;
  chart: { labels: string[]; revenue: number[]; expenses: number[]; net: number[] };
};

const formatCurrency = (n: number) =>
  `₵${Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const firstOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};
const today = () => new Date().toISOString().slice(0, 10);
const isValidDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s).getTime());

const SOURCE_ROWS = [
  { key: 'buyer_protection_fees', label: 'Buyer Protection Fees' },
  { key: 'platform_commission', label: 'Platform Commission' },
  { key: 'hub_commission', label: 'Hub Commission' },
  { key: 'delivery_fees_retained', label: 'Delivery Fees Retained' },
  { key: 'ad_revenue', label: 'Ad Revenue' },
] as const;

export default function AdminFinancialDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const C = useAdminColors();
  const styles = useMemo(() => getStyles(C), [C]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState<FinancialSummary | null>(null);

  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);

  const loadData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const res = await getFinancialSummary({ from, to });
      if (res.success) setSummary(res.data);
    } catch (error: any) {
      CustomInAppToast.show({
        type: 'error',
        title: 'Error',
        message: error.message || 'Failed to load the financial summary',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [from, to]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const revenue = summary?.revenue.grand_total ?? 0;
  const expensesTotal = summary?.expenses.total ?? 0;
  const netProfit = summary?.net_profit ?? 0;
  const netNegative = netProfit < 0;

  const STAT_CARDS = [
    { key: 'revenue', label: 'Total Revenue', value: revenue, icon: 'trending-up-outline' as const, iconBg: '#DBEAFE', iconColor: '#2563EB', bar: '#2563EB' },
    { key: 'expenses', label: 'Total Expenses', value: expensesTotal, icon: 'trending-down-outline' as const, iconBg: '#FEE2E2', iconColor: '#DC2626', bar: '#EF4444' },
    { key: 'net', label: 'Net Profit', value: netProfit, icon: 'wallet-outline' as const, iconBg: netNegative ? '#FEE2E2' : '#DCFCE7', iconColor: netNegative ? '#DC2626' : '#16A34A', bar: netNegative ? '#EF4444' : '#16A34A' },
  ];

  const chartConfig = {
    backgroundGradientFrom: '#fff',
    backgroundGradientTo: '#fff',
    decimalPlaces: 0,
    color: (o = 1) => `rgba(12,21,89,${o})`,
    labelColor: () => '#64748B',
    propsForDots: { r: '4', strokeWidth: '2' },
    propsForBackgroundLines: { strokeDasharray: '5', stroke: 'rgba(0,0,0,0.05)' },
  };

  const hasChart = (summary?.chart?.labels?.length ?? 0) > 0;

  const applyDateRange = () => {
    if (!isValidDate(draftFrom) || !isValidDate(draftTo)) {
      CustomInAppToast.show({
        type: 'error',
        title: 'Invalid Date Range',
        message: 'Enter both dates as YYYY-MM-DD.',
      });
      return;
    }
    if (new Date(draftFrom) > new Date(draftTo)) {
      CustomInAppToast.show({
        type: 'error',
        title: 'Invalid Date Range',
        message: 'The start date must be on or before the end date.',
      });
      return;
    }
    setFrom(draftFrom);
    setTo(draftTo);
    setShowDatePicker(false);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      <LinearGradient colors={C.headerGradient} style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Financial Dashboard</Text>
        <TouchableOpacity
          style={styles.rangeBtn}
          onPress={() => {
            setDraftFrom(from);
            setDraftTo(to);
            setShowDatePicker(true);
          }}
        >
          <Feather name="calendar" size={16} color="#FFFFFF" />
        </TouchableOpacity>
      </LinearGradient>

      {loading && !refreshing ? (
        <AdminScreenSkeleton metrics={3} rows={5} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.listContent, { paddingBottom: Math.max(insets.bottom, 16) + 40 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor={C.navy} />}
        >
          {/* Range display */}
          <View style={styles.rangeRow}>
            <Feather name="calendar" size={13} color={C.textMuted} />
            <Text style={styles.rangeText}>{from} → {to}</Text>
          </View>

          {/* Stat cards row */}
          <View style={styles.summaryRow}>
            {STAT_CARDS.map((card) => (
              <View key={card.key} style={styles.statCard}>
                <View style={[styles.statIconWrap, { backgroundColor: card.iconBg }]}>
                  <Ionicons name={card.icon} size={16} color={card.iconColor} />
                </View>
                <Text
                  style={[
                    styles.statValue,
                    card.key === 'net' && netNegative ? { color: '#DC2626' } : null,
                  ]}
                  numberOfLines={1}
                >
                  {formatCurrency(card.value)}
                </Text>
                <Text style={styles.statLabel}>{card.label}</Text>
                <View style={[styles.statBar, { backgroundColor: card.bar }]} />
              </View>
            ))}
          </View>

          {/* Chart */}
          {hasChart && (
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Revenue vs. Expenses</Text>
              <LineChart
                data={{
                  labels: summary!.chart.labels,
                  datasets: [
                    { data: summary!.chart.revenue, color: () => '#2563EB', strokeWidth: 2 },
                    { data: summary!.chart.expenses, color: () => '#EF4444', strokeWidth: 2 },
                    { data: summary!.chart.net, color: () => '#16A34A', strokeWidth: 2 },
                  ],
                  legend: ['Revenue', 'Expenses', 'Net'],
                }}
                width={SW - 56}
                height={220}
                chartConfig={chartConfig}
                bezier
                style={{ borderRadius: 12 }}
                withInnerLines
                withOuterLines={false}
                withVerticalLines={false}
                yAxisLabel="₵"
                yAxisInterval={1}
              />
            </View>
          )}

          {/* Revenue by source */}
          <AdminPanel style={styles.listPanel}>
            <Text style={styles.sectionTitle}>Revenue by Source</Text>
            {summary?.revenue?.sources ? (
              SOURCE_ROWS.map((r) => (
                <View key={r.key} style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>{r.label}</Text>
                  <Text style={styles.breakdownValue}>
                    {formatCurrency(summary.revenue.sources[r.key].total)}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>No revenue recorded in this range.</Text>
            )}
          </AdminPanel>

          {/* Expenses by category */}
          <AdminPanel style={[styles.listPanel, { marginTop: 12 }]}>
            <Text style={styles.sectionTitle}>Expenses by Category</Text>
            {summary?.expenses?.by_category?.length ? (
              summary.expenses.by_category.map((cat) => (
                <View key={cat.category_id} style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>{cat.category_name}</Text>
                  <Text style={styles.breakdownValue}>{formatCurrency(cat.total)}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>No expenses recorded in this range.</Text>
            )}
          </AdminPanel>
        </ScrollView>
      )}

      {/* Date range picker modal — reuses the existing TextInput YYYY-MM-DD pattern
          used elsewhere in the app (see business/analytics.tsx custom range picker). */}
      <Modal visible={showDatePicker} animationType="fade" transparent>
        <View style={styles.datePickerOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowDatePicker(false)} activeOpacity={1} />
          <GlassSurface style={styles.datePickerSheet}>
            <Text style={styles.datePickerTitle}>Select Date Range</Text>
            <Text style={styles.datePickerHint}>Format: YYYY-MM-DD</Text>
            <TextInput
              style={styles.dateInput}
              placeholder="From date (e.g. 2026-09-01)"
              value={draftFrom}
              onChangeText={setDraftFrom}
              placeholderTextColor={C.textSoft}
            />
            <TextInput
              style={styles.dateInput}
              placeholder="To date (e.g. 2026-09-06)"
              value={draftTo}
              onChangeText={setDraftTo}
              placeholderTextColor={C.textSoft}
            />
            <View style={styles.datePickerActions}>
              <TouchableOpacity style={styles.dateCancelBtn} onPress={() => setShowDatePicker(false)}>
                <Text style={styles.dateCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dateApplyBtn} onPress={applyDateRange}>
                <Text style={styles.dateApplyText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </GlassSurface>
        </View>
      </Modal>
    </View>
  );
}

const getStyles = (C: AdminColors) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.appBg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontFamily: 'Montserrat-Bold',
    color: '#FFFFFF',
  },
  rangeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  listContent: {
    paddingBottom: 40,
  },

  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingTop: 14,
  },
  rangeText: {
    fontSize: 12,
    fontFamily: 'Montserrat-SemiBold',
    color: C.textMuted,
  },

  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 4,
  },
  statCard: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    flexGrow: 1,
    flex: 1,
  },
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    color: C.text,
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
    marginBottom: 2,
  },
  statLabel: {
    color: C.textMuted,
    fontSize: 10,
    fontFamily: 'Montserrat-SemiBold',
  },
  statBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
  },

  chartCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  chartTitle: {
    fontSize: 15,
    fontFamily: 'Montserrat-Bold',
    color: C.text,
    marginBottom: 12,
  },

  listPanel: {
    marginHorizontal: 12,
    marginBottom: 0,
  },
  sectionTitle: {
    color: C.text,
    fontSize: 15,
    fontFamily: 'Montserrat-Bold',
    marginBottom: 10,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  breakdownLabel: {
    fontSize: 13,
    fontFamily: 'Montserrat-Medium',
    color: C.textMuted,
  },
  breakdownValue: {
    fontSize: 13,
    fontFamily: 'Montserrat-Bold',
    color: C.text,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: 'Montserrat-Regular',
    color: C.textSoft,
    paddingVertical: 12,
    textAlign: 'center',
  },

  // Date picker modal (mirrors business/analytics.tsx custom range picker)
  datePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  datePickerSheet: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 22,
  },
  datePickerTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat-Bold',
    color: C.text,
    marginBottom: 4,
  },
  datePickerHint: {
    fontSize: 11,
    fontFamily: 'Montserrat-Medium',
    color: C.textSoft,
    marginBottom: 14,
  },
  dateInput: {
    backgroundColor: C.surfaceSoft,
    borderRadius: 12,
    padding: 13,
    fontFamily: 'Montserrat-Medium',
    fontSize: 14,
    borderWidth: 1,
    borderColor: C.border,
    color: C.text,
    marginBottom: 10,
  },
  datePickerActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  dateCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: C.surfaceMuted,
    alignItems: 'center',
  },
  dateCancelText: {
    fontSize: 13,
    fontFamily: 'Montserrat-Bold',
    color: C.textMuted,
  },
  dateApplyBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: C.navy,
    alignItems: 'center',
  },
  dateApplyText: {
    fontSize: 13,
    fontFamily: 'Montserrat-Bold',
    color: '#FFFFFF',
  },
});
