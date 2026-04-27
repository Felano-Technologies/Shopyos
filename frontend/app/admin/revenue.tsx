import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import AdminShell, { AdminPanel } from '@/components/admin/AdminShell';
import { adminColors } from '@/components/admin/adminTheme';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { getAdminDashboard, getAdminRevenue } from '@/services/api';

export default function AdminRevenue() {
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
      { label: 'Total Revenue', value: `₵${totalRevenue.toLocaleString('en-GH', { minimumFractionDigits: 2 })}`, icon: 'wallet-outline', color: adminColors.blue },
      { label: 'Transactions', value: payoutCount.toLocaleString(), icon: 'swap-horizontal-outline', color: adminColors.green },
      { label: 'Average', value: `₵${avg.toFixed(2)}`, icon: 'analytics-outline', color: adminColors.violet },
    ];
  }, [totalRevenue, transactions]);

  return (
    <>
      <StatusBar style="dark" />
      <AdminShell
        title="Revenue"
        subtitle="Track total commission earned and inspect recent platform payouts."
        onRefresh={() => loadData(true)}
      >
        <View style={styles.page}>
          <View style={styles.summaryRow}>
            {summary.map((item) => (
              <AdminPanel key={item.label} style={styles.summaryCard}>
                <View style={[styles.summaryIcon, { backgroundColor: `${item.color}18` }]}>
                  <Ionicons name={item.icon as any} size={18} color={item.color} />
                </View>
                <Text style={styles.summaryLabel}>{item.label}</Text>
                <Text style={styles.summaryValue}>{item.value}</Text>
              </AdminPanel>
            ))}
          </View>

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

          <AdminPanel style={styles.listPanel}>
            <Text style={styles.sectionTitle}>Recent transactions</Text>
            {loading ? (
              <View style={styles.center}>
                <ActivityIndicator size="large" color={adminColors.blue} />
              </View>
            ) : (
              <FlatList
                data={transactions}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
                refreshControl={
                  <RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor={adminColors.blue} />
                }
                renderItem={({ item }) => (
                  <View style={styles.itemRow}>
                    <View style={styles.iconBg}>
                      <Ionicons name="trending-up" size={20} color={adminColors.green} />
                    </View>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemMain}>
                        {item.order?.order_number ? `Order #${item.order.order_number}` : 'Payment'} —{' '}
                        {item.order?.store?.store_name || 'Store'}
                      </Text>
                      <Text style={styles.itemSub}>{formatDate(item.created_at)}</Text>
                    </View>
                    <Text style={styles.itemPrice}>+₵{parseFloat(item.amount || 0).toFixed(2)}</Text>
                  </View>
                )}
                ListEmptyComponent={
                  <View style={styles.emptyState}>
                    <Ionicons name="bar-chart-outline" size={50} color="#CBD5E1" />
                    <Text style={styles.emptyText}>No transactions yet</Text>
                  </View>
                }
              />
            )}
          </AdminPanel>
        </View>
      </AdminShell>
    </>
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
  page: {
    flex: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginBottom: 16,
  },
  summaryCard: {
    minWidth: 180,
    flex: 1,
  },
  summaryIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  summaryLabel: {
    color: adminColors.textMuted,
    fontSize: 13,
    fontFamily: 'Montserrat-SemiBold',
    marginBottom: 4,
  },
  summaryValue: {
    color: adminColors.text,
    fontSize: 24,
    fontFamily: 'Montserrat-Bold',
  },
  heroCard: {
    backgroundColor: adminColors.navyDeep,
    marginBottom: 16,
  },
  heroLabel: {
    color: '#C7D2FE',
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 13,
  },
  heroValue: {
    color: '#FFFFFF',
    fontFamily: 'Montserrat-Bold',
    fontSize: 34,
    marginTop: 10,
  },
  heroSub: {
    color: '#CBD5E1',
    fontFamily: 'Montserrat-Regular',
    fontSize: 13,
    marginTop: 6,
  },
  listPanel: {
    flex: 1,
  },
  sectionTitle: {
    color: adminColors.text,
    fontSize: 20,
    fontFamily: 'Montserrat-Bold',
    marginBottom: 14,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  listContent: {
    paddingBottom: 120,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: adminColors.border,
    gap: 14,
  },
  iconBg: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemMain: {
    color: adminColors.text,
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
  },
  itemSub: {
    color: adminColors.textSoft,
    fontSize: 12,
    fontFamily: 'Montserrat-Regular',
    marginTop: 4,
  },
  itemPrice: {
    color: adminColors.green,
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 44,
  },
  emptyText: {
    marginTop: 12,
    color: adminColors.textSoft,
    fontFamily: 'Montserrat-Regular',
  },
});
