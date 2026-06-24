import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { AdminPanel } from '@/components/admin/AdminShell';
import AdminScreenSkeleton from '@/components/admin/AdminSkeleton';
import { adminColors } from '@/components/admin/adminTheme';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { getAdminDashboard, getAdminRevenue } from '@/services/api';

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

export default function AdminRevenue() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);

  const loadData = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const [dashRes, revRes] = await Promise.all([
        getAdminDashboard(),
        getAdminRevenue({ limit: 50 }),
      ]);
      if (dashRes?.stats?.totalRevenue !== undefined) {
        setTotalRevenue(dashRes.stats.totalRevenue);
      }
      const txs = Array.isArray(revRes?.transactions) ? revRes.transactions : [];
      setTransactions(txs);
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
  }, []);

  const summary = useMemo(() => {
    const payoutCount = transactions.length;
    const avg = payoutCount ? totalRevenue / payoutCount : 0;
    return [
      `₵${totalRevenue.toLocaleString('en-GH', { minimumFractionDigits: 2 })}`,
      payoutCount.toLocaleString(),
      `₵${avg.toFixed(2)}`,
    ];
  }, [totalRevenue, transactions]);

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

      {/* Hero card */}
      <AdminPanel style={styles.heroCard}>
        <Text style={styles.heroLabel}>Total commission earned</Text>
        {loading ? (
          <ActivityIndicator color="#FFFFFF" style={{ marginTop: 12 }} />
        ) : (
          <Text style={styles.heroValue}>
            ₵{totalRevenue.toLocaleString('en-GH', { minimumFractionDigits: 2 })}
          </Text>
        )}
        <Text style={styles.heroSub}>{transactions.length} completed payments recorded</Text>
      </AdminPanel>

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
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Revenue</Text>
      </View>

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

  // Stat cards
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

  // Hero card
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
    fontSize: 32,
    marginTop: 10,
  },
  heroSub: {
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Montserrat-Regular',
    fontSize: 13,
    marginTop: 6,
  },

  // List panel header
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

  // Transaction row wrapper (white card continuation)
  itemRowWrap: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },

  // Transaction row
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

  // Empty state
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
