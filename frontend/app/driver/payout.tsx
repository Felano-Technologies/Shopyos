import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, FlatList, RefreshControl, Alert, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { getDriverPayoutHistory, requestDriverPayout } from '@/services/payments';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { useProfile } from '@/hooks/useProfile';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';
import { formatCurrency } from '@/utils/formatCurrency';

const STATUS_FILTERS = ['All', 'Completed', 'Pending', 'Failed'] as const;
function statusColor(status: string) {
  switch (status) {
    case 'completed': return '#16A34A';
    case 'processing': return '#2563EB';
    case 'pending': return '#D97706';
    case 'failed': return '#EF4444';
    default: return '#64748B';
  }
}

export default function DriverPayoutScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { data: profile } = useProfile();

  const [walletBalance, setWalletBalance] = useState(0);
  const [payoutMethod, setPayoutMethod] = useState<string | null>(null);
  const [payoutDetails, setPayoutDetails] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [showAmountSheet, setShowAmountSheet] = useState(false);
  const [requestAmount, setRequestAmount] = useState('');


  useEffect(() => {
    if (profile) {
      setWalletBalance(Number.parseFloat((profile as any).wallet_balance || 0));
      setPayoutMethod((profile as any).payout_method || null);
      setPayoutDetails((profile as any).payout_details || null);
    }
    fetchHistory();
  }, [profile]);

  useEffect(() => {
    let list = history;
    if (statusFilter !== 'All') list = list.filter(p => p.status === statusFilter.toLowerCase());
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p => String(p.amount).includes(q) || (p.transaction_reference || '').toLowerCase().includes(q));
    }
    setFilteredHistory(list);
  }, [history, statusFilter, searchQuery]);

  const fetchHistory = async () => {
    try {
      const resp = await getDriverPayoutHistory();
      if (resp.success) setHistory(resp.data);
    } catch { /* no-op */ }
    finally { setLoading(false); }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchHistory();
    setRefreshing(false);
  }, []);

  const handleRequestPayout = () => {
    if (!payoutMethod) {
      CustomInAppToast.show({ type: 'error', title: 'No Payout Method', message: 'Please set up a payout method first.' });
      return;
    }
    if (walletBalance < 10) {
      CustomInAppToast.show({ type: 'error', title: 'Insufficient Balance', message: 'Minimum payout amount is GHS 10.' });
      return;
    }
    setRequestAmount(walletBalance.toFixed(2));
    setShowAmountSheet(true);
  };

  const confirmRequest = async () => {
    const amount = Number.parseFloat(requestAmount);
    if (!amount || amount < 10) {
      CustomInAppToast.show({ type: 'error', title: 'Invalid Amount', message: 'Minimum payout is GHS 10.' });
      return;
    }
    setShowAmountSheet(false);
    setIsRequesting(true);
    try {
      await requestDriverPayout(amount);
      CustomInAppToast.show({ type: 'success', title: 'Request Sent', message: 'Your payout has been requested and will be processed shortly.' });
      setWalletBalance(prev => prev - amount);
      await fetchHistory();
    } catch (e: any) {
      CustomInAppToast.show({ type: 'error', title: 'Error', message: e.message || 'Payout request failed.' });
    } finally {
      setIsRequesting(false);
    }
  };

  const renderHistoryItem = ({ item }: { item: any }) => (
    <View style={styles.historyItem}>
      <View style={styles.historyLeft}>
        <View style={[styles.iconBox, { backgroundColor: statusColor(item.status) + '20' }]}>
          <Feather
            name={item.admin_notes?.toLowerCase().includes('auto') ? 'clock' : 'arrow-up-right'}
            size={16}
            color={statusColor(item.status)}
          />
        </View>
        <View>
          <Text style={styles.historyType}>
            {item.admin_notes?.toLowerCase().includes('auto') ? 'Auto Payout' : 'Manual Request'}
          </Text>
          <Text style={styles.historyDate}>
            {new Date(item.created_at).toLocaleDateString([], { month: 'short', day: '2-digit', year: 'numeric' })}
          </Text>
          {item.transaction_reference && (
            <Text style={styles.historyRef} numberOfLines={1}>Ref: {item.transaction_reference}</Text>
          )}
        </View>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.historyAmount, { color: statusColor(item.status) }]}>
          +{formatCurrency(item.amount)}
        </Text>
        <Text style={[styles.historyStatus, { color: statusColor(item.status) }]}>
          {item.status.toUpperCase()}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor={colors.headerGradient[0]} />
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <SafeAreaView edges={['top', 'left', 'right']}>
          <View style={styles.navBar}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color={colors.accent} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>My Payouts</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Wallet Balance Card */}
          <View style={styles.balanceContainer}>
            <Text style={styles.balanceLabel}>Wallet Balance</Text>
            <Text style={styles.balanceValue}>{formatCurrency(walletBalance)}</Text>
            <Text style={styles.autoPayoutNote}>Paid out instantly after each delivery</Text>
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.earlyPayoutBtn, isRequesting && { opacity: 0.6 }]}
                onPress={handleRequestPayout}
                disabled={isRequesting}
              >
                {isRequesting ? (
                  <ActivityIndicator size="small" color={colors.accentText} />
                ) : (
                  <Text style={styles.earlyPayoutBtnText}>Request Payout</Text>
                )}
                {!isRequesting && <Feather name="chevron-right" size={16} color={colors.accentText} />}
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      >
        {/* Payout Method Card */}
        <View style={styles.content}>
          <TouchableOpacity
            style={styles.methodSummaryCard}
            onPress={() => router.push('/driver/payout-settings' as any)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View style={styles.methodIconCircle}>
                <Feather
                  name={payoutMethod === 'mobile_money' ? 'smartphone' : payoutMethod === 'bank' ? 'credit-card' : 'settings'}
                  size={18}
                  color={colors.primary}
                />
              </View>
              <View>
                {payoutMethod ? (
                  <>
                    <Text style={styles.methodSummaryTitle}>
                      {payoutMethod === 'mobile_money' ? 'Mobile Money' : 'Bank Transfer'}
                    </Text>
                    <Text style={styles.methodSummaryDetail}>
                      {payoutDetails?.phone || payoutDetails?.account_number || 'Account on file'}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.methodSummaryTitle}>No payout method set</Text>
                    <Text style={[styles.methodSummaryDetail, { color: '#D97706' }]}>Tap to add MOMO or bank account</Text>
                  </>
                )}
              </View>
            </View>
            <Feather name="chevron-right" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          {/* Amount Sheet (inline) */}
          {showAmountSheet && (
            <View style={styles.amountSheet}>
              <Text style={styles.amountSheetTitle}>Enter Amount (GHS)</Text>
              <Text style={styles.amountSheetNote}>Min: GHS 10 · Available: {formatCurrency(walletBalance)}</Text>
              <View style={styles.amountInputRow}>
                <Text style={styles.currencySymbol}>₵</Text>
                <TextInput
                  style={styles.amountInput}
                  keyboardType="decimal-pad"
                  value={requestAmount}
                  onChangeText={setRequestAmount}
                  autoFocus
                />
                <TouchableOpacity style={styles.confirmBtn} onPress={confirmRequest}>
                  <Text style={styles.confirmBtnText}>Request</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => setShowAmountSheet(false)} style={{ alignItems: 'center', marginTop: 8 }}>
                <Text style={{ color: colors.textMuted, fontFamily: 'Montserrat-Medium', fontSize: 13 }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* History */}
          <Text style={styles.sectionTitle}>Payout History</Text>
          <View style={styles.searchBar}>
            <Feather name="search" size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by amount or reference..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery !== '' && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersRow}>
            {STATUS_FILTERS.map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.filterChip, statusFilter === f && styles.filterChipActive]}
                onPress={() => setStatusFilter(f)}
              >
                <Text style={[styles.filterChipText, statusFilter === f && styles.filterChipTextActive]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {loading ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 20 }} />
          ) : (
            <FlatList
              data={filteredHistory}
              keyExtractor={item => item.id}
              renderItem={renderHistoryItem}
              scrollEnabled={false}
              contentContainerStyle={styles.historyList}
              ListEmptyComponent={
                <View style={styles.emptyHistory}>
                  <Feather name="inbox" size={32} color={colors.textMuted} />
                  <Text style={styles.emptyHistoryText}>No payouts yet</Text>
                  <Text style={styles.emptyHistorySubText}>Complete deliveries to start earning</Text>
                </View>
              }
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundAlt },
  header: { backgroundColor: colors.headerGradient[0], paddingBottom: 30, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  navBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 20 },
  backBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12 },
  headerTitle: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#FFF' },
  balanceContainer: { alignItems: 'center', paddingBottom: 10 },
  balanceLabel: { color: '#CBD5E1', fontSize: 13, fontFamily: 'Montserrat-Medium' },
  balanceValue: { color: '#FFF', fontSize: 36, fontFamily: 'Montserrat-Bold', marginVertical: 8 },
  autoPayoutNote: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontFamily: 'Montserrat-Regular', marginBottom: 16 },
  actionRow: { flexDirection: 'row', gap: 12 },
  earlyPayoutBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.accent, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20 },
  earlyPayoutBtnText: { color: colors.accentText, fontFamily: 'Montserrat-Bold', marginRight: 4 },
  content: { flex: 1, padding: 20 },
  methodCard: { backgroundColor: colors.surface, borderRadius: 20, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: colors.borderStrong },
  methodCardTitle: { fontSize: 15, fontFamily: 'Montserrat-Bold', color: colors.text, marginBottom: 12 },
  warningBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', borderRadius: 8, padding: 10, marginBottom: 16 },
  warningText: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: '#92400E', flex: 1 },
  methodTabs: { flexDirection: 'row', backgroundColor: colors.border, borderRadius: 12, padding: 3, marginBottom: 16 },
  methodTab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  methodTabActive: { backgroundColor: colors.surface, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  methodTabText: { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: colors.textSecondary },
  methodTabTextActive: { color: colors.primary },
  networkRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  networkChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: colors.border, borderWidth: 1, borderColor: 'transparent' },
  networkChipActive: { backgroundColor: colors.border, borderColor: '#2563EB' },
  networkChipText: { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: colors.textSecondary },
  networkChipTextActive: { color: '#2563EB' },
  formLabel: { fontSize: 11, fontFamily: 'Montserrat-SemiBold', color: colors.textSecondary, marginBottom: 6, textTransform: 'uppercase' },
  formInput: { backgroundColor: colors.backgroundAlt, borderRadius: 10, borderWidth: 1, borderColor: colors.borderStrong, padding: 12, fontSize: 14, fontFamily: 'Montserrat-Regular', color: colors.text, marginBottom: 12 },
  saveMethodBtn: { backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 4 },
  saveMethodBtnText: { color: colors.textInverse, fontFamily: 'Montserrat-Bold', fontSize: 14 },
  methodSummaryCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 16, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.borderStrong },
  methodIconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  methodSummaryTitle: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: colors.text },
  methodSummaryDetail: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: colors.textSecondary, marginTop: 2 },
  changeMethodText: { fontSize: 12, fontFamily: 'Montserrat-Bold', color: colors.primary },
  amountSheet: { backgroundColor: colors.surface, borderRadius: 20, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: colors.borderStrong },
  amountSheetTitle: { fontSize: 15, fontFamily: 'Montserrat-Bold', color: colors.text, marginBottom: 4 },
  amountSheetNote: { fontSize: 12, fontFamily: 'Montserrat-Regular', color: colors.textMuted, marginBottom: 14 },
  amountInputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  currencySymbol: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: colors.primary, marginRight: 6 },
  amountInput: { flex: 1, borderBottomWidth: 2, borderBottomColor: colors.primary, fontSize: 22, fontFamily: 'Montserrat-Bold', color: colors.primary, paddingBottom: 4 },
  confirmBtn: { backgroundColor: colors.primary, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10, marginLeft: 12 },
  confirmBtnText: { color: colors.textInverse, fontFamily: 'Montserrat-Bold', fontSize: 13 },
  sectionTitle: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: colors.text, marginBottom: 12 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 12, height: 44, marginBottom: 12, borderWidth: 1, borderColor: colors.borderStrong },
  searchInput: { flex: 1, fontSize: 13, fontFamily: 'Montserrat-Regular', color: colors.text },
  filtersRow: { marginBottom: 12 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: colors.border, marginRight: 8 },
  filterChipActive: { backgroundColor: colors.primary },
  filterChipText: { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: colors.textSecondary },
  filterChipTextActive: { color: colors.textInverse },
  historyList: { backgroundColor: colors.surface, borderRadius: 16, padding: 5, borderWidth: 1, borderColor: colors.borderStrong },
  historyItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  historyLeft: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  historyType: { fontSize: 13, fontFamily: 'Montserrat-SemiBold', color: colors.text },
  historyDate: { fontSize: 12, fontFamily: 'Montserrat-Regular', color: colors.textSecondary, marginTop: 2 },
  historyRef: { fontSize: 10, color: colors.textMuted, fontFamily: 'Montserrat-Regular', marginTop: 2, maxWidth: 180 },
  historyAmount: { fontSize: 14, fontFamily: 'Montserrat-Bold' },
  historyStatus: { fontSize: 10, fontFamily: 'Montserrat-Bold', marginTop: 2 },
  emptyHistory: { alignItems: 'center', paddingVertical: 30 },
  emptyHistoryText: { fontSize: 14, fontFamily: 'Montserrat-SemiBold', color: colors.textMuted, marginTop: 10 },
  emptyHistorySubText: { fontSize: 12, fontFamily: 'Montserrat-Regular', color: colors.textMuted, marginTop: 4 },
});
