import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Dimensions } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { BarChart } from 'react-native-chart-kit';
import { getDriverEarningsAnalytics, getMyDeliveries } from '@/services/api';

const { width: SW } = Dimensions.get('window');

export default function DriverEarnings() {
  const router = useRouter();
  const [view, setView] = useState<'weekly' | 'monthly'>('weekly');
  const [analytics, setAnalytics] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchData();
  }, [view]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [analyticsRes, historyRes] = await Promise.all([
        getDriverEarningsAnalytics(view),
        getMyDeliveries()
      ]);

      if (analyticsRes.success) setAnalytics(analyticsRes);
      
      if (historyRes.success && historyRes.deliveries) {
        setTransactions(historyRes.deliveries.slice(0, 5).map((d: any) => ({
          id: d.id || d._id,
          title: `Delivery #${d.order?.order_number || 'N/A'}`,
          time: new Date(d.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          amount: d.status === 'delivered' ? (d.driver_earnings || d.delivery_fee || 0) : 0,
          type: d.status === 'delivered' ? 'credit' : 'debit'
        })));
      }
    } catch (e) {
      console.error('Failed to fetch earnings data', e);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchData();
    } finally {
      setRefreshing(false);
    }
  }, [view]);

  const chartConfig = {
    backgroundGradientFrom: '#fff',
    backgroundGradientTo: '#fff',
    decimalPlaces: 2,
    color: (o = 1) => `rgba(12,21,89,${o})`,
    labelColor: () => '#64748B',
    propsForBackgroundLines: { strokeDasharray: '5', stroke: 'rgba(0,0,0,0.05)' },
    barPercentage: 0.6,
  };

  const hasChart = analytics?.chart?.labels?.length > 0 &&
    analytics?.chart?.data?.some((v: number) => v > 0);

  const renderTransaction = ({ item }: { item: any }) => (
    <View style={styles.transItem}>
      <View style={[styles.iconBox, item.type === 'debit' ? styles.debitBox : styles.creditBox]}>
        <Feather 
            name={item.type === 'debit' ? 'arrow-up-right' : 'arrow-down-left'} 
            size={20} 
            color={item.type === 'debit' ? '#EF4444' : '#16A34A'} 
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.transTitle}>{item.title}</Text>
        <Text style={styles.transTime}>{item.time}</Text>
      </View>
      <Text style={[styles.transAmount, item.type === 'debit' && { color: '#EF4444' }]}>
        {item.type === 'debit' ? '-' : '+'}₵{Math.abs(item.amount).toFixed(2)}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor="#0C1559" />
      <Stack.Screen options={{ headerShown: false }} />

      <LinearGradient colors={['#0C1559', '#1e3a8a']} style={styles.header}>
        <SafeAreaView edges={['top', 'left', 'right']}>
            <View style={styles.navBar}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#A3E635" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Earnings</Text>
                <TouchableOpacity>
                    <Ionicons name="help-circle-outline" size={24} color="#FFF" />
                </TouchableOpacity>
            </View>

            <View style={styles.balanceContainer}>
                <Text style={styles.balanceLabel}>This Month</Text>
                <Text style={styles.balanceValue}>
                  ₵{analytics?.summary?.total_earned_this_month?.toFixed(2) || '0.00'}
                </Text>
                <TouchableOpacity style={styles.cashoutBtn} onPress={() => router.push('/driver/payout' as any)}>
                    <Text style={styles.cashoutText}>Manage Payouts</Text>
                    <Feather name="chevron-right" size={16} color="#0C1559" />
                </TouchableOpacity>
            </View>
        </SafeAreaView>
      </LinearGradient>

      <View style={styles.content}>
        {loading && !refreshing ? (
          <ActivityIndicator size="small" color="#0C1559" style={{ marginTop: 20 }} />
        ) : (
          <>
            {/* Summary Card */}
            {analytics?.summary && (
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Deliveries</Text>
                    <Text style={styles.summaryValue}>{analytics.summary.total_deliveries_this_month}</Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Avg / Delivery</Text>
                    <Text style={styles.summaryValue}>
                      ₵{analytics.summary.avg_per_delivery?.toFixed(2) || '0.00'}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Chart Section */}
            <View style={styles.chartCard}>
              <View style={styles.chartHeader}>
                <Text style={styles.chartTitle}>Earnings</Text>
                <View style={styles.toggleRow}>
                  <TouchableOpacity
                    style={[styles.toggleBtn, view === 'weekly' && styles.toggleBtnActive]}
                    onPress={() => setView('weekly')}
                  >
                    <Text style={[styles.toggleText, view === 'weekly' && styles.toggleTextActive]}>Weekly</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.toggleBtn, view === 'monthly' && styles.toggleBtnActive]}
                    onPress={() => setView('monthly')}
                  >
                    <Text style={[styles.toggleText, view === 'monthly' && styles.toggleTextActive]}>Monthly</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {hasChart ? (
                <BarChart
                  data={{
                    labels: analytics.chart.labels,
                    datasets: [{ data: analytics.chart.data }],
                  }}
                  width={SW - 64}
                  height={200}
                  chartConfig={chartConfig}
                  style={{ borderRadius: 12 }}
                  yAxisLabel="₵"
                  yAxisInterval={1}
                  fromZero
                  withCustomBarColorFromData={false}
                  flatColor
                  showValuesOnTopOfBars={false}
                />
              ) : (
                <View style={styles.emptyChart}>
                  <Feather name="bar-chart-2" size={32} color="#CBD5E1" />
                  <Text style={styles.emptyText}>No earnings data for this period</Text>
                </View>
              )}
            </View>

            {/* Earnings Breakdown */}
            {analytics?.breakdown && (
              <View style={styles.breakdownCard}>
                <Text style={styles.breakdownTitle}>Earnings Breakdown</Text>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Base delivery fees</Text>
                  <Text style={styles.breakdownValue}>
                    ₵{analytics.breakdown.base_delivery_fees?.toFixed(2) || '0.00'}
                  </Text>
                </View>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Bonuses & rewards</Text>
                  <Text style={[styles.breakdownValue, { color: '#16A34A' }]}>
                    ₵{analytics.breakdown.bonuses_and_rewards?.toFixed(2) || '0.00'}
                  </Text>
                </View>
                <View style={styles.breakdownDivider} />
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownTotalLabel}>Total</Text>
                  <Text style={styles.breakdownTotalValue}>
                    ₵{analytics.breakdown.total?.toFixed(2) || '0.00'}
                  </Text>
                </View>
              </View>
            )}

            {/* Rating Card */}
            {analytics?.rating && (
              <View style={styles.ratingCard}>
                <Ionicons name="star" size={20} color="#EAB308" />
                <Text style={styles.ratingText}>
                  {analytics.rating.average} average · {analytics.rating.total_reviews} reviews
                </Text>
              </View>
            )}

            {/* Recent Activity */}
            <Text style={styles.sectionTitle}>Recent Deliveries</Text>
            <FlatList
                data={transactions}
                keyExtractor={item => item.id}
                renderItem={renderTransaction}
                contentContainerStyle={{ paddingBottom: 40 }}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={<Text style={{ textAlign: 'center', color: '#64748B' }}>No recent deliveries</Text>}
                refreshing={refreshing}
                onRefresh={onRefresh}
                scrollEnabled={false}
            />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { backgroundColor: '#0C1559', paddingBottom: 30, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  navBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 20 },
  backBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12 },
  headerTitle: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#FFF' },
  
  balanceContainer: { alignItems: 'center' },
  balanceLabel: { color: '#CBD5E1', fontSize: 14, fontFamily: 'Montserrat-Medium' },
  balanceValue: { color: '#FFF', fontSize: 36, fontFamily: 'Montserrat-Bold', marginVertical: 10 },
  cashoutBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#A3E635', paddingVertical: 8, paddingHorizontal: 20, borderRadius: 20 },
  cashoutText: { color: '#0C1559', fontFamily: 'Montserrat-Bold', marginRight: 5 },

  content: { flex: 1, padding: 20 },

  summaryCard: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 16,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, height: 40, backgroundColor: '#F1F5F9' },
  summaryLabel: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: '#64748B' },
  summaryValue: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginTop: 4 },

  chartCard: {
    backgroundColor: '#FFF', borderRadius: 20, padding: 16, marginBottom: 16,
    elevation: 3, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10,
  },
  chartHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16,
  },
  chartTitle: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
  toggleRow: { flexDirection: 'row', gap: 8 },
  toggleBtn: {
    paddingVertical: 6, paddingHorizontal: 14, borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  toggleBtnActive: { backgroundColor: '#0C1559' },
  toggleText: { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: '#64748B' },
  toggleTextActive: { color: '#FFF' },

  emptyChart: { height: 180, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: '#94A3B8', marginTop: 8 },

  breakdownCard: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 16,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4,
  },
  breakdownTitle: { fontSize: 15, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginBottom: 12 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  breakdownLabel: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: '#64748B' },
  breakdownValue: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
  breakdownDivider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 8 },
  breakdownTotalLabel: { fontSize: 15, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
  breakdownTotalValue: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0C1559' },

  ratingCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF',
    borderRadius: 16, padding: 16, marginBottom: 16, gap: 8,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4,
  },
  ratingText: { fontSize: 14, fontFamily: 'Montserrat-SemiBold', color: '#0F172A' },

  sectionTitle: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginBottom: 15 },
  transItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 15, borderRadius: 16, marginBottom: 10 },
  iconBox: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  creditBox: { backgroundColor: '#DCFCE7' },
  debitBox: { backgroundColor: '#FEE2E2' },
  transTitle: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
  transTime: { fontSize: 12, color: '#64748B', fontFamily: 'Montserrat-Medium' },
  transAmount: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#16A34A' },
});
