import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { AdminPanel } from '@/components/admin/AdminShell';
import AdminScreenSkeleton from '@/components/admin/AdminSkeleton';
import { adminColors } from '@/components/admin/adminTheme';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { LineChart } from 'react-native-chart-kit';
import { getAdminDashboard, getAdminRevenue, getAdminRevenueBreakdown } from '@/services/api';

const { width: SW } = Dimensions.get('window');

const STATUS_PILL: Record<string, { bg: string; text: string }> = {
  paid:     { bg: '#DCFCE7', text: '#16A34A' },
  refunded: { bg: '#F3E8FF', text: '#7C3AED' },
  failed:   { bg: '#FEE2E2', text: '#DC2626' },
  success:  { bg: '#DCFCE7', text: '#16A34A' },
};

const STAT_CARDS = [
  {
    key: 'revenue',
    label: 'Total Revenue',
    icon: 'wallet-outline' as const,
    iconBg: '#DCFCE7',
    iconColor: '#16A34A',
    bar: '#16A34A',
  },
  {
    key: 'orders',
    label: 'Transactions',
    icon: 'cart-outline' as const,
    iconBg: '#DBEAFE',
    iconColor: '#2563EB',
    bar: '#2563EB',
  },
  {
    key: 'avg',
    label: 'Average',
    icon: 'stats-chart-outline' as const,
    iconBg: '#EDE9FE',
    iconColor: '#7C3AED',
    bar: '#7C3AED',
  },
];

const SOURCE_CARDS = [
  { key: 'buyer_protection_fees', label: 'Buyer Protection', icon: 'shield-checkmark', color: '#1E40AF', bg: '#DBEAFE' },
  { key: 'ad_revenue', label: 'Ad Revenue', icon: 'megaphone', color: '#65A30D', bg: '#ECFCCB' },
  { key: 'platform_commission', label: 'Commission', icon: 'trending-up', color: '#2563EB', bg: '#DBEAFE' },
  { key: 'delivery_fees_retained', label: 'Delivery Retained', icon: 'car', color: '#EA580C', bg: '#FED7AA' },
];

type Period = 'week' | 'month' | 'year';

export default function AdminRevenue() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [period, setPeriod] = useState<Period>('month');
  const [breakdown, setBreakdown] = useState<any>(null);

  const loadData = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const [dashRes, revRes, bdRes] = await Promise.all([
        getAdminDashboard(),
        getAdminRevenue({ limit: 50 }),
        getAdminRevenueBreakdown(period),
      ]);
      if (dashRes?.stats?.totalRevenue !== undefined) {
        setTotalRevenue(dashRes.stats.totalRevenue);
      }
      const txs = Array.isArray(revRes?.transactions) ? revRes.transactions : [];
      setTransactions(txs);
      if (bdRes.success) setBreakdown(bdRes);
    } catch (error: any) {
      CustomInAppToast.show({
        type: 'error',
        title: 'Error',
        message: error.message || 'Failed to load revenue',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [period]);

  const summary = useMemo(() => {
    const payoutCount = transactions.length;
    const avg = payoutCount ? totalRevenue / payoutCount : 0;
    return [
      `₵${totalRevenue.toLocaleString('en-GH', { minimumFractionDigits: 2 })}`,
      payoutCount.toLocaleString(),
      `₵${avg.toFixed(2)}`,
    ];
  }, [totalRevenue, transactions]);

  const chartConfig = {
    backgroundGradientFrom: '#fff',
    backgroundGradientTo: '#fff',
    decimalPlaces: 0,
    color: (o = 1) => `rgba(12,21,89,${o})`,
    labelColor: () => '#64748B',
    propsForDots: { r: '4', strokeWidth: '2' },
    propsForBackgroundLines: { strokeDasharray: '5', stroke: 'rgba(0,0,0,0.05)' },
  };

  const hasChart = breakdown?.chart?.labels?.length > 0;

  const getSourceValue = (key: string) => {
    if (!breakdown?.sources) return 0;
    const source = breakdown.sources[key];
    if (!source) return 0;
    if (typeof source === 'object') return source.total || 0;
    return source;
  };

  const listHeader = (
    <>
      {/* Stat cards row */}
      <View style={styles.summaryRow}>
        {STAT_CARDS.map((card, i) => (
          <View key={card.key} style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: card.iconBg }]}>
              <Ionicons name={card.icon} size={16} color={card.iconColor} />
            </View>
            <Text style={styles.statValue}>{summary[i]}</Text>
            <Text style={styles.statLabel}>{card.label}</Text>
            <View style={[styles.statBar, { backgroundColor: card.bar }]} />
          </View>
        ))}
      </View>

      {/* Period toggle */}
      <View style={styles.periodRow}>
        {(['week', 'month', 'year'] as Period[]).map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.periodBtn, period === p && styles.periodBtnActive]}
            onPress={() => setPeriod(p)}
          >
            <Text style={[styles.periodText, period === p && styles.periodTextActive]}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Revenue source cards */}
      {breakdown?.sources && (
        <>
          <View style={styles.sourceGrid}>
            {SOURCE_CARDS.map((card) => {
              const value = getSourceValue(card.key);
              return (
                <View key={card.key} style={styles.sourceCard}>
                  <View style={[styles.sourceIcon, { backgroundColor: card.bg }]}>
                    <Ionicons name={card.icon as any} size={18} color={card.color} />
                  </View>
                  <Text style={styles.sourceLabel}>{card.label}</Text>
                  <Text style={[styles.sourceValue, { color: card.color }]}>
                    ₵{(value || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Grand total banner */}
          <AdminPanel style={styles.heroCard}>
            <Text style={styles.heroLabel}>Platform Revenue This Period</Text>
            <Text style={styles.heroValue}>
              ₵{(breakdown.grand_total || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}
            </Text>
          </AdminPanel>
        </>
      )}

      {/* Chart */}
      {hasChart && (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Revenue by Source</Text>
          <LineChart
            data={{
              labels: breakdown.chart.labels,
              datasets: breakdown.chart.datasets.map((ds: any) => ({
                ...ds,
                color: () =>
                  ds.label === 'Buyer Protection' ? '#1E40AF' :
                  ds.label === 'Ad Revenue' ? '#65A30D' :
                  ds.label === 'Commission' ? '#2563EB' : '#EA580C',
              })),
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

      {/* Top ad spenders */}
      {breakdown?.top_ad_spenders?.length > 0 && (
        <View style={styles.spendersCard}>
          <Text style={styles.chartTitle}>Top Ad Spenders</Text>
          {breakdown.top_ad_spenders.map((s: any, i: number) => (
            <View key={s.store_name} style={styles.spenderRow}>
              <Text style={styles.spenderRank}>#{i + 1}</Text>
              <Text style={styles.spenderName} numberOfLines={1}>{s.store_name}</Text>
              <Text style={styles.spenderValue}>₵{(s.spent || 0).toFixed(2)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* List section header */}
      <AdminPanel style={styles.listPanel}>
        <Text style={styles.sectionTitle}>Recent transactions</Text>
      </AdminPanel>
    </>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      {/* Compact header */}
      <LinearGradient colors={['#0C1559', '#1e3a8a']} style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Revenue</Text>
      </LinearGradient>

      {loading && !refreshing ? (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F7FA' }} edges={['top', 'left', 'right']}>
          <AdminScreenSkeleton metrics={3} rows={5} />
        </SafeAreaView>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.listContent, { paddingBottom: Math.max(insets.bottom, 16) + 80 }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor={adminColors.blue} />
          }
          ListHeaderComponent={listHeader}
          renderItem={({ item }) => {
            const status = (item.status || '').toLowerCase();
            const pill = STATUS_PILL[status] ?? { bg: '#F1F5F9', text: '#475569' };
            return (
              <View style={styles.itemRowWrap}>
                <View style={styles.itemRow}>
                  <View style={styles.iconBg}>
                    <Ionicons name="trending-up" size={18} color="#16A34A" />
                  </View>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemMain}>
                      {item.order?.order_number ? `Order #${item.order.order_number}` : 'Payment'} —{' '}
                      {item.order?.store?.store_name || 'Store'}
                    </Text>
                    <Text style={styles.itemSub}>{formatDate(item.created_at)}</Text>
                  </View>
                  <View style={styles.itemRight}>
                    <Text style={styles.itemPrice}>+₵{Number.parseFloat(item.amount || 0).toFixed(2)}</Text>
                    {status ? (
                      <View style={[styles.statusPill, { backgroundColor: pill.bg }]}>
                        <Text style={[styles.statusPillText, { color: pill.text }]}>{status}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={[styles.itemRowWrap, styles.emptyState]}>
              <Ionicons name="bar-chart-outline" size={50} color="#CBD5E1" />
              <Text style={styles.emptyText}>No transactions yet</Text>
            </View>
          }
          ListFooterComponent={<View style={styles.listFooter} />}
        />
      )}
    </View>
  );
}

function formatDate(ts: string) {
  try {
    return new Date(ts).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return ts;
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    backgroundColor: '#0C1559',
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

  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 4,
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
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
    color: '#0F172A',
    fontSize: 15,
    fontFamily: 'Montserrat-Bold',
    marginBottom: 2,
  },
  statLabel: {
    color: '#64748B',
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

  periodRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  periodBtn: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  periodBtnActive: {
    backgroundColor: '#0C1559',
    borderColor: '#0C1559',
  },
  periodText: {
    fontSize: 13,
    fontFamily: 'Montserrat-SemiBold',
    color: '#64748B',
  },
  periodTextActive: {
    color: '#FFFFFF',
  },

  sourceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 10,
  },
  sourceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    width: '48%',
    flexGrow: 1,
  },
  sourceIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  sourceLabel: {
    fontSize: 11,
    fontFamily: 'Montserrat-Medium',
    color: '#64748B',
    marginBottom: 4,
  },
  sourceValue: {
    fontSize: 16,
    fontFamily: 'Montserrat-Bold',
  },

  heroCard: {
    backgroundColor: '#0C1559',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 12,
    marginBottom: 12,
    marginTop: 12,
  },
  heroLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 13,
  },
  heroValue: {
    color: '#FFFFFF',
    fontFamily: 'Montserrat-Bold',
    fontSize: 28,
    marginTop: 8,
  },

  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  chartTitle: {
    fontSize: 15,
    fontFamily: 'Montserrat-Bold',
    color: '#0F172A',
    marginBottom: 12,
  },

  spendersCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 12,
    marginBottom: 12,
  },
  spenderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  spenderRank: {
    fontSize: 12,
    fontFamily: 'Montserrat-Bold',
    color: '#64748B',
    width: 24,
  },
  spenderName: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Montserrat-SemiBold',
    color: '#0F172A',
  },
  spenderValue: {
    fontSize: 13,
    fontFamily: 'Montserrat-Bold',
    color: '#0C1559',
  },

  listPanel: {
    marginHorizontal: 12,
    marginBottom: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  sectionTitle: {
    color: '#0F172A',
    fontSize: 15,
    fontFamily: 'Montserrat-Bold',
    marginBottom: 14,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  listContent: {
    paddingBottom: 40,
  },

  itemRowWrap: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 12,
  },
  iconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemMain: {
    color: '#0F172A',
    fontSize: 13,
    fontFamily: 'Montserrat-SemiBold',
  },
  itemSub: {
    color: '#94A3B8',
    fontSize: 11,
    fontFamily: 'Montserrat-Regular',
    marginTop: 3,
  },
  itemRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  itemPrice: {
    color: '#16A34A',
    fontSize: 13,
    fontFamily: 'Montserrat-Bold',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
  },
  statusPillText: {
    fontSize: 10,
    fontFamily: 'Montserrat-SemiBold',
    textTransform: 'capitalize',
  },

  emptyState: {
    alignItems: 'center',
    paddingVertical: 44,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  emptyText: {
    marginTop: 12,
    color: '#94A3B8',
    fontFamily: 'Montserrat-Regular',
  },
  listFooter: {
    height: 16,
    marginHorizontal: 12,
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
});
