import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { format } from 'date-fns';
import { getMyReturns } from '@/services/orders';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';
import { formatCurrency } from '@/utils/formatCurrency';

const { width: SW } = Dimensions.get('window');
const SCALE = Math.min(Math.max(SW / 390, 0.85), 1.15);
const rs = (n: number) => Math.round(n * SCALE);
const rf = (n: number) => Math.round(n * Math.min(SCALE, 1.1));

// Return-status badge colors are intentionally fixed across themes (amber/green/red/blue
// semantics must stay recognizable regardless of light/dark mode), not theme tokens.
const STATUS_COLORS: Record<string, { color: string; bg: string; label: string }> = {
  pending:          { color: '#B45309', bg: '#FEF3C7', label: 'Pending' },
  seller_approved:  { color: '#166534', bg: '#DCFCE7', label: 'Approved' },
  seller_declined:  { color: '#B91C1C', bg: '#FEE2E2', label: 'Declined' },
  admin_review:     { color: '#1D4ED8', bg: '#DBEAFE', label: 'Admin Review' },
  refund_issued:    { color: '#166534', bg: '#DCFCE7', label: 'Refund Issued' },
  closed:           { color: '#64748B', bg: '#F1F5F9', label: 'Closed' },
};

const getStatusStyle = (s: string) =>
  STATUS_COLORS[s] ?? { color: '#64748B', bg: '#F3F4F6', label: s }; // fallback for an unmapped status, same fixed palette as above

const ReturnCard = ({ item }: { item: any }) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const cfg = getStatusStyle(item.status);
  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <Text style={styles.orderNum}>Order #{item.order_number || item.order_id?.slice(-8)}</Text>
        <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
          <Text style={[styles.badgeTxt, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>
      <Text style={styles.reason} numberOfLines={2}>{item.reason}</Text>
      
      <View style={styles.breakdownBox}>
        <Text style={styles.breakdownText}>
          Product Subtotal (Refundable): <Text style={styles.bold}>{formatCurrency(item.refundable_amount)}</Text>
        </Text>
        <Text style={styles.breakdownText}>
          Delivery Fee (Non-Refundable): <Text style={styles.bold}>{formatCurrency(item.delivery_fee_at_time)}</Text>
        </Text>
      </View>

      {item.seller_response ? (
        <View style={styles.sellerNote}>
          <Ionicons name="storefront-outline" size={12} color={colors.primary} />
          <Text style={styles.sellerNoteTxt} numberOfLines={2}>{item.seller_response}</Text>
        </View>
      ) : null}
      {item.refund_amount ? (
        <Text style={styles.refundAmt}>Refunded: {formatCurrency(item.refund_amount)}</Text>
      ) : null}
      <Text style={styles.date}>{format(new Date(item.created_at), 'dd MMM yyyy')}</Text>
    </View>
  );
};

export default function ReturnsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [returns, setReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const PAGE = 15;

  const loadReturns = useCallback(async (p = 1, replace = false) => {
    try {
      const res = await getMyReturns({ page: p, limit: PAGE });
      const rows = res.data || [];
      setReturns((prev) => replace ? rows : [...prev, ...rows]);
      setHasMore(rows.length === PAGE);
      setPage(p);
    } catch { /* ignore */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => { loadReturns(1, true); }, [loadReturns]);

  const onRefresh = () => { setRefreshing(true); loadReturns(1, true); };
  const onEndReached = () => { if (hasMore && !loading) loadReturns(page + 1); };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient
        colors={colors.headerGradient}
        style={[styles.header, { paddingTop: insets.top + rs(12) }]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={rs(22)} color="#fff" /> {/* white icon on the fixed navy header gradient */}
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Returns</Text>
        <View style={{ width: rs(38) }} />
      </LinearGradient>

      {(() => {
        if (loading && returns.length === 0) {
          return (
            <View style={styles.centred}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          );
        }
        if (returns.length === 0) {
          return (
            <View style={styles.centred}>
              <Ionicons name="refresh-circle-outline" size={rs(56)} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No return requests</Text>
              <Text style={styles.emptyBody}>Returns you submit will appear here.</Text>
            </View>
          );
        }
        return (
        <FlatList
          data={returns}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ReturnCard item={item} />}
          contentContainerStyle={{ padding: rs(16), paddingBottom: insets.bottom + rs(20) }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          ListFooterComponent={hasMore ? <ActivityIndicator color={colors.primary} style={{ marginVertical: rs(16) }} /> : null}
        />
        );
      })()}
    </View>
  );
}

const getStyles = (c: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.surfaceElevated },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: rs(20), paddingBottom: rs(20),
  },
  backBtn: {
    width: rs(38), height: rs(38), borderRadius: rs(12),
    backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center', // fixed translucent button on the header gradient
  },
  headerTitle: { fontSize: rf(17), fontFamily: 'Montserrat-Bold', color: '#fff' }, // white text on the fixed navy header gradient
  centred: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: rs(10) },
  emptyTitle: { fontSize: rf(17), fontFamily: 'Montserrat-Bold', color: c.text },
  emptyBody: { fontSize: rf(13), fontFamily: 'Montserrat-Medium', color: c.textSecondary, textAlign: 'center', paddingHorizontal: rs(40) },
  card: {
    backgroundColor: c.surface, borderRadius: rs(16), padding: rs(16),
    marginBottom: rs(12), borderWidth: 1, borderColor: c.border,
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: rs(6) },
  orderNum: { fontSize: rf(13), fontFamily: 'Montserrat-Bold', color: c.text },
  badge: { paddingHorizontal: rs(10), paddingVertical: rs(4), borderRadius: rs(8) },
  badgeTxt: { fontSize: rf(11), fontFamily: 'Montserrat-Bold' },
  reason: { fontSize: rf(13), fontFamily: 'Montserrat-Medium', color: c.textSecondary, marginBottom: rs(6) },
  sellerNote: { flexDirection: 'row', gap: rs(6), alignItems: 'flex-start', backgroundColor: c.surfaceElevated, borderRadius: rs(8), padding: rs(8), marginBottom: rs(6) },
  sellerNoteTxt: { flex: 1, fontSize: rf(12), fontFamily: 'Montserrat-Medium', color: c.primary },
  refundAmt: { fontSize: rf(13), fontFamily: 'Montserrat-Bold', color: c.success, marginBottom: rs(4) },
  date: { fontSize: rf(11), fontFamily: 'Montserrat-Medium', color: c.textMuted },
  breakdownBox: {
    backgroundColor: c.surfaceElevated,
    borderRadius: rs(8),
    padding: rs(10),
    marginTop: rs(4),
    marginBottom: rs(8),
    borderWidth: 1,
    borderColor: c.border,
  },
  breakdownText: { fontSize: rf(11.5), fontFamily: 'Montserrat-Medium', color: c.textSecondary, marginBottom: rs(3) },
  bold: { fontFamily: 'Montserrat-SemiBold', color: c.text },
});
