import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { getLoyaltyBalance, getLoyaltyTransactions } from '@/services/api';

interface LoyaltyTransaction {
  id: string;
  order_id: string | null;
  type: 'earn' | 'redeem';
  points: number;
  description: string;
  created_at: string;
  order_number: string | null;
}

const POINTS_TO_CURRENCY = 100;

export default function LoyaltyPointsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [balance, setBalance] = useState(0);
  const [lifetimeEarned, setLifetimeEarned] = useState(0);
  const [redeemableValue, setRedeemableValue] = useState(0);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 20;

  const loadData = useCallback(async (reset = false) => {
    try {
      const currentOffset = reset ? 0 : offset;
      const [balanceRes, txRes] = await Promise.all([
        getLoyaltyBalance().catch(() => null),
        getLoyaltyTransactions({ limit: PAGE_SIZE, offset: currentOffset }).catch(() => null),
      ]);

      if (balanceRes?.success) {
        setBalance(balanceRes.balance);
        setLifetimeEarned(balanceRes.lifetimeEarned);
        setRedeemableValue(balanceRes.redeemableValue);
      }

      if (txRes?.success) {
        const newTxs: LoyaltyTransaction[] = txRes.transactions || [];
        setTransactions(prev => reset ? newTxs : [...prev, ...newTxs]);
        setHasMore(newTxs.length === PAGE_SIZE);
        setOffset(currentOffset + newTxs.length);
      }
    } catch {
      // silently fail — UI shows empty state
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [offset]);

  useEffect(() => {
    loadData(true);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    setOffset(0);
    setHasMore(true);
    loadData(true);
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      setLoadingMore(true);
      loadData(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const renderTransaction = ({ item }: { item: LoyaltyTransaction }) => {
    const isEarn = item.type === 'earn';
    return (
      <View style={styles.txCard}>
        <View style={[styles.txIconBox, { backgroundColor: isEarn ? '#DCFCE7' : '#FEF2F2' }]}>
          <Feather
            name={isEarn ? 'trending-up' : 'gift'}
            size={18}
            color={isEarn ? '#16A34A' : '#DC2626'}
          />
        </View>
        <View style={styles.txDetails}>
          <Text style={styles.txDescription}>{item.description}</Text>
          {item.order_number && (
            <Text style={styles.txOrderNum}>Order #{item.order_number}</Text>
          )}
          <Text style={styles.txDate}>{formatDate(item.created_at)}</Text>
        </View>
        <Text style={[styles.txPoints, { color: isEarn ? '#16A34A' : '#DC2626' }]}>
          {isEarn ? '+' : ''}{item.points} pts
        </Text>
      </View>
    );
  };

  const ListHeader = () => (
    <View>
      {/* Balance Card */}
      <View style={styles.balanceCard}>
        <View style={styles.balanceTop}>
          <Feather name="star" size={20} color="#FBBF24" />
          <Text style={styles.balanceLabel}>Your Points Balance</Text>
        </View>
        <Text style={styles.balancePoints}>{balance.toLocaleString()}</Text>
        <Text style={styles.balanceSubtitle}>points</Text>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>₵{redeemableValue.toFixed(2)}</Text>
            <Text style={styles.statLabel}>Redeemable Value</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{lifetimeEarned.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Lifetime Earned</Text>
          </View>
        </View>
      </View>

      {/* How it works */}
      <View style={styles.howCard}>
        <Text style={styles.howTitle}>How it works</Text>
        <View style={styles.howRow}>
          <View style={[styles.howIcon, { backgroundColor: '#EEF2FF' }]}>
            <Feather name="shopping-bag" size={16} color="#4F46E5" />
          </View>
          <Text style={styles.howText}>Earn 1 point for every ₵1 you spend</Text>
        </View>
        <View style={styles.howRow}>
          <View style={[styles.howIcon, { backgroundColor: '#FEF9C3' }]}>
            <Feather name="tag" size={16} color="#CA8A04" />
          </View>
          <Text style={styles.howText}>100 points = ₵1 off at checkout</Text>
        </View>
        <View style={styles.howRow}>
          <View style={[styles.howIcon, { backgroundColor: '#DCFCE7' }]}>
            <Feather name="percent" size={16} color="#16A34A" />
          </View>
          <Text style={styles.howText}>Redeem up to 20% of your order total</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Transaction History</Text>
    </View>
  );

  const ListEmpty = () => (
    <View style={styles.emptyContainer}>
      <Feather name="star" size={48} color="#CBD5E1" />
      <Text style={styles.emptyTitle}>No transactions yet</Text>
      <Text style={styles.emptySubtitle}>Start shopping to earn loyalty points</Text>
    </View>
  );

  const ListFooter = () =>
    loadingMore ? (
      <ActivityIndicator size="small" color="#0C1559" style={{ marginVertical: 16 }} />
    ) : null;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0C1559" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Loyalty Points</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0C1559" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C1559" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Loyalty Points</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={renderTransaction}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        ListFooterComponent={ListFooter}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#0C1559']}
            tintColor="#0C1559"
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: '#0C1559',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  // Balance card
  balanceCard: {
    backgroundColor: '#0C1559',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#0C1559',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  balanceTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  balanceLabel: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '500',
  },
  balancePoints: {
    color: '#FBBF24',
    fontSize: 56,
    fontWeight: '800',
    lineHeight: 64,
  },
  balanceSubtitle: {
    color: '#94A3B8',
    fontSize: 14,
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 16,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  statValue: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  statLabel: {
    color: '#94A3B8',
    fontSize: 11,
  },
  // How it works
  howCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  howTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  howRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  howIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  howText: {
    fontSize: 13,
    color: '#475569',
    flex: 1,
  },
  // Section title
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  // Transaction items
  txCard: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  txIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  txDetails: {
    flex: 1,
  },
  txDescription: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 2,
  },
  txOrderNum: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 2,
  },
  txDate: {
    fontSize: 11,
    color: '#94A3B8',
  },
  txPoints: {
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 8,
  },
  // Empty state
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
    textAlign: 'center',
  },
});
