import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
  Share,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { getLoyaltyBalance, getLoyaltyTransactions } from '@/services/api';
import { getCachedUserProfile } from '@/services/storage';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';

type LegacyPalette = {
  bg: string;
  navy: string;
  headerBg: string;
  card: string;
  body: string;
  muted: string;
  subtle: string;
};

function buildC(colors: ThemeColors): LegacyPalette {
  return {
    bg: colors.backgroundAlt,
    navy: colors.primary,
    headerBg: colors.headerGradient[0],
    card: colors.surface,
    body: colors.text,
    muted: colors.textSecondary,
    subtle: colors.textMuted,
  };
}

interface LoyaltyTransaction {
  id: string;
  order_id: string | null;
  type: 'earn' | 'redeem' | 'referral' | 'expire' | 'admin_adjustment';
  points: number;
  description: string;
  created_at: string;
  order_number: string | null;
  related_user_name: string | null;
  related_user_avatar: string | null;
}

function ReferralCard({ code }: Readonly<{ code: string }>) {
  const themeColors = useThemeColors();
  const C = useMemo(() => buildC(themeColors), [themeColors]);
  const styles = useMemo(() => getStyles(C), [C]);
  const copyCode = async () => {
    await Clipboard.setStringAsync(code);
    CustomInAppToast.show({ type: 'success', title: 'Copied!', message: 'Referral code copied to clipboard.' });
  };

  const shareCode = async () => {
    try {
      await Share.share({
        message: `Join me on Shopyos! Use my referral code ${code} when you sign up and we both earn bonus points. 🛍️`,
      });
    } catch { /* user dismissed the share sheet */ }
  };

  return (
    <View style={styles.referralCard}>
      <View style={{ flex: 1 }}>
        <Text style={styles.referralLabel}>Your Referral Code</Text>
        <TouchableOpacity onPress={copyCode} activeOpacity={0.7} accessibilityLabel="Copy referral code" accessibilityRole="button">
          <View style={styles.referralCodeRow}>
            <Text style={styles.referralCode}>{code}</Text>
            <Feather name="copy" size={15} color="#0C1559" />
          </View>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.shareBtn} onPress={shareCode} accessibilityLabel="Share referral code" accessibilityRole="button">
        <Feather name="share-2" size={15} color="#FFF" />
        <Text style={styles.shareBtnText}>Share</Text>
      </TouchableOpacity>
    </View>
  );
}

function ListHeader({ balance, redeemableValue, lifetimeEarned, referralCode }: Readonly<{
  balance: number;
  redeemableValue: number;
  lifetimeEarned: number;
  referralCode: string | null;
}>) {
  const themeColors = useThemeColors();
  const C = useMemo(() => buildC(themeColors), [themeColors]);
  const styles = useMemo(() => getStyles(C), [C]);
  return (
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
        <View style={styles.howRow}>
          <View style={[styles.howIcon, { backgroundColor: '#FEE2E2' }]}>
            <Feather name="users" size={16} color="#DC2626" />
          </View>
          <Text style={styles.howText}>Invite friends with your referral code and earn bonus points when they place their first order</Text>
        </View>
      </View>

      {referralCode ? <ReferralCard code={referralCode} /> : null}

      <Text style={styles.sectionTitle}>Transaction History</Text>
    </View>
  );
}

function ListEmpty() {
  const themeColors = useThemeColors();
  const C = useMemo(() => buildC(themeColors), [themeColors]);
  const styles = useMemo(() => getStyles(C), [C]);
  return (
    <View style={styles.emptyContainer}>
      <Feather name="star" size={48} color={C.subtle} />
      <Text style={styles.emptyTitle}>No transactions yet</Text>
      <Text style={styles.emptySubtitle}>Start shopping to earn loyalty points</Text>
    </View>
  );
}

function ListFooter({ loadingMore }: Readonly<{ loadingMore: boolean }>) {
  const themeColors = useThemeColors();
  const C = useMemo(() => buildC(themeColors), [themeColors]);
  return loadingMore ? (
    <ActivityIndicator size="small" color={C.navy} style={{ marginVertical: 16 }} />
  ) : null;
}

export default function LoyaltyPointsScreen() {
  const router = useRouter();
  const themeColors = useThemeColors();
  const C = useMemo(() => buildC(themeColors), [themeColors]);
  const styles = useMemo(() => getStyles(C), [C]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [balance, setBalance] = useState(0);
  const [lifetimeEarned, setLifetimeEarned] = useState(0);
  const [redeemableValue, setRedeemableValue] = useState(0);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [referralCode, setReferralCode] = useState<string | null>(null);
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
    getCachedUserProfile()
      .then((profile: any) => {
        const p = profile?.user || profile;
        if (p?.referral_code) setReferralCode(p.referral_code);
      })
      .catch(() => { });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const isPositive = item.type === 'earn' || item.type === 'referral' || item.type === 'admin_adjustment';
    const isReferral = item.type === 'referral';

    const iconName = isReferral ? 'users' : item.type === 'redeem' ? 'gift' : 'trending-up';
    const iconBg = isReferral ? '#FEE2E2' : isPositive ? '#DCFCE7' : '#FEF2F2';
    const iconColor = isReferral ? '#DC2626' : isPositive ? '#16A34A' : '#DC2626';
    const pointsColor = isPositive ? '#16A34A' : '#DC2626';

    return (
      <View style={styles.txCard}>
        <View style={[styles.txIconBox, { backgroundColor: iconBg }]}>
          <Feather name={iconName as any} size={18} color={iconColor} />
        </View>
        <View style={styles.txDetails}>
          {isReferral && item.related_user_name ? (
            <>
              <Text style={styles.txDescription}>Referral Bonus</Text>
              <Text style={styles.txOrderNum}>{item.related_user_name} placed their first order</Text>
            </>
          ) : (
            <Text style={styles.txDescription}>{item.description}</Text>
          )}
          {!isReferral && item.order_number && (
            <Text style={styles.txOrderNum}>Order #{item.order_number}</Text>
          )}
          <Text style={styles.txDate}>{formatDate(item.created_at)}</Text>
        </View>
        <Text style={[styles.txPoints, { color: pointsColor }]}>
          {isPositive ? '+' : ''}{item.points} pts
        </Text>
      </View>
    );
  };

  const headerBlock = (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Feather name="arrow-left" size={22} color="#FFF" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Loyalty Points</Text>
      <View style={{ width: 40 }} />
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={C.headerBg} />
        <SafeAreaView edges={['top', 'left', 'right']} style={{ backgroundColor: C.headerBg }}>
          {headerBlock}
        </SafeAreaView>
        <View style={[styles.loadingContainer, { backgroundColor: C.bg }]}>
          <ActivityIndicator size="large" color={C.navy} />
        </View>
        <SafeAreaView edges={['bottom']} style={{ backgroundColor: C.bg }} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.headerBg} />
      <SafeAreaView edges={['top', 'left', 'right']} style={{ backgroundColor: C.headerBg }}>
        {headerBlock}
      </SafeAreaView>

      <FlatList
        style={{ flex: 1, backgroundColor: C.bg }}
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={renderTransaction}
        ListHeaderComponent={() => <ListHeader balance={balance} redeemableValue={redeemableValue} lifetimeEarned={lifetimeEarned} referralCode={referralCode} />}
        ListEmptyComponent={ListEmpty}
        ListFooterComponent={() => <ListFooter loadingMore={loadingMore} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[C.navy]}
            tintColor={C.navy}
          />
        }
      />
      <SafeAreaView edges={['bottom']} style={{ backgroundColor: C.bg }} />
    </View>
  );
}

const getStyles = (C: LegacyPalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.headerBg,
  },
  header: {
    backgroundColor: C.headerBg,
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
    backgroundColor: C.headerBg,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: C.headerBg,
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
  // Referral card
  referralCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  referralLabel: { fontSize: 11, fontWeight: '600', color: '#15803D', textTransform: 'uppercase', letterSpacing: 0.5 },
  referralCodeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  referralCode: { fontSize: 18, fontWeight: 'bold', color: '#0C1559', letterSpacing: 1.5 },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#16A34A',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  shareBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  // How it works
  howCard: {
    backgroundColor: C.card,
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
    color: C.body,
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
    color: C.muted,
    flex: 1,
  },
  // Section title
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: C.body,
    marginTop: 15,
    marginBottom: 15,
  },
  // Transaction items
  txCard: {
    backgroundColor: C.card,
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
    color: C.body,
    marginBottom: 2,
  },
  txOrderNum: {
    fontSize: 12,
    color: C.muted,
    marginBottom: 2,
  },
  txDate: {
    fontSize: 11,
    color: C.subtle,
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
    color: C.muted,
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: C.subtle,
    marginTop: 4,
    textAlign: 'center',
  },
});
