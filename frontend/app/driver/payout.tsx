import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, FlatList, RefreshControl, Alert, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { getDriverPayoutHistory, requestDriverPayout } from '@/services/payments';
import { useProfile } from '@/hooks/useProfile';

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
      Alert.alert('No Payout Method', 'Please set up a payout method first.');
      return;
    }
    if (walletBalance < 10) {
      Alert.alert('Insufficient Balance', 'Minimum payout amount is GHS 10.');
      return;
    }
    setRequestAmount(walletBalance.toFixed(2));
    setShowAmountSheet(true);
  };

  const confirmRequest = async () => {
    const amount = Number.parseFloat(requestAmount);
    if (!amount || amount < 10) {
      Alert.alert('Invalid Amount', 'Minimum payout is GHS 10.');
      return;
    }
    setShowAmountSheet(false);
    setIsRequesting(true);
    try {
      await requestDriverPayout(amount);
      Alert.alert('Request Sent', 'Your payout has been requested and will be processed shortly.');
      setWalletBalance(prev => prev - amount);
      await fetchHistory();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Payout request failed.');
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
          +₵{Number.parseFloat(item.amount).toFixed(2)}
        </Text>
        <Text style={[styles.historyStatus, { color: statusColor(item.status) }]}>
          {item.status.toUpperCase()}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor="#0C1559" />
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <SafeAreaView edges={['top', 'left', 'right']}>
          <View style={styles.navBar}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color="#A3E635" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>My Payouts</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Wallet Balance Card */}
          <View style={styles.balanceContainer}>
            <Text style={styles.balanceLabel}>Wallet Balance</Text>
            <Text style={styles.balanceValue}>₵{walletBalance.toFixed(2)}</Text>
            <Text style={styles.autoPayoutNote}>Paid out automatically every morning by 8 AM</Text>
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.earlyPayoutBtn, isRequesting && { opacity: 0.6 }]}
                onPress={handleRequestPayout}
                disabled={isRequesting}
              >
                {isRequesting ? (
                  <ActivityIndicator size="small" color="#0C1559" />
                ) : (
                  <Text style={styles.earlyPayoutBtnText}>Request Early Payout</Text>
                )}
                {!isRequesting && <Feather name="chevron-right" size={16} color="#0C1559" />}
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0C1559']} />}
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
                  color="#0C1559"
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
            <Feather name="chevron-right" size={18} color="#94A3B8" />
          </TouchableOpacity>

          {/* Amount Sheet (inline) */}
          {showAmountSheet && (
            <View style={styles.amountSheet}>
              <Text style={styles.amountSheetTitle}>Enter Amount (GHS)</Text>
              <Text style={styles.amountSheetNote}>Min: GHS 10 · Available: ₵{walletBalance.toFixed(2)}</Text>
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
                <Text style={{ color: '#94A3B8', fontFamily: 'Montserrat-Medium', fontSize: 13 }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* History */}
          <Text style={styles.sectionTitle}>Payout History</Text>
          <View style={styles.searchBar}>
            <Feather name="search" size={16} color="#94A3B8" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by amount or reference..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery !== '' && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={16} color="#94A3B8" />
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
            <ActivityIndicator size="small" color="#0C1559" style={{ marginTop: 20 }} />
          ) : (
            <FlatList
              data={filteredHistory}
              keyExtractor={item => item.id}
              renderItem={renderHistoryItem}
              scrollEnabled={false}
              contentContainerStyle={styles.historyList}
              ListEmptyComponent={
                <View style={styles.emptyHistory}>
                  <Feather name="inbox" size={32} color="#CBD5E1" />
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { backgroundColor: '#0C1559', paddingBottom: 30, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  navBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 20 },
  backBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12 },
  headerTitle: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#FFF' },
  balanceContainer: { alignItems: 'center', paddingBottom: 10 },
  balanceLabel: { color: '#CBD5E1', fontSize: 13, fontFamily: 'Montserrat-Medium' },
  balanceValue: { color: '#FFF', fontSize: 36, fontFamily: 'Montserrat-Bold', marginVertical: 8 },
  autoPayoutNote: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontFamily: 'Montserrat-Regular', marginBottom: 16 },
  actionRow: { flexDirection: 'row', gap: 12 },
  earlyPayoutBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#A3E635', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20 },
  earlyPayoutBtnText: { color: '#0C1559', fontFamily: 'Montserrat-Bold', marginRight: 4 },
  content: { flex: 1, padding: 20 },
  methodCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  methodCardTitle: { fontSize: 15, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginBottom: 12 },
  warningBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', borderRadius: 8, padding: 10, marginBottom: 16 },
  warningText: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: '#92400E', flex: 1 },
  methodTabs: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 12, padding: 3, marginBottom: 16 },
  methodTab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  methodTabActive: { backgroundColor: '#FFF', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  methodTabText: { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: '#64748B' },
  methodTabTextActive: { color: '#0C1559' },
  networkRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  networkChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: 'transparent' },
  networkChipActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  networkChipText: { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: '#64748B' },
  networkChipTextActive: { color: '#2563EB' },
  formLabel: { fontSize: 11, fontFamily: 'Montserrat-SemiBold', color: '#64748B', marginBottom: 6, textTransform: 'uppercase' },
  formInput: { backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', padding: 12, fontSize: 14, fontFamily: 'Montserrat-Regular', color: '#1E293B', marginBottom: 12 },
  saveMethodBtn: { backgroundColor: '#0C1559', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 4 },
  saveMethodBtnText: { color: '#FFF', fontFamily: 'Montserrat-Bold', fontSize: 14 },
  methodSummaryCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 16, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  methodIconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  methodSummaryTitle: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
  methodSummaryDetail: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: '#64748B', marginTop: 2 },
  changeMethodText: { fontSize: 12, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
  amountSheet: { backgroundColor: '#FFF', borderRadius: 20, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  amountSheetTitle: { fontSize: 15, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginBottom: 4 },
  amountSheetNote: { fontSize: 12, fontFamily: 'Montserrat-Regular', color: '#94A3B8', marginBottom: 14 },
  amountInputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  currencySymbol: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#0C1559', marginRight: 6 },
  amountInput: { flex: 1, borderBottomWidth: 2, borderBottomColor: '#0C1559', fontSize: 22, fontFamily: 'Montserrat-Bold', color: '#0C1559', paddingBottom: 4 },
  confirmBtn: { backgroundColor: '#0C1559', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10, marginLeft: 12 },
  confirmBtnText: { color: '#FFF', fontFamily: 'Montserrat-Bold', fontSize: 13 },
  sectionTitle: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginBottom: 12 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 12, paddingHorizontal: 12, height: 44, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  searchInput: { flex: 1, fontSize: 13, fontFamily: 'Montserrat-Regular', color: '#1E293B' },
  filtersRow: { marginBottom: 12 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F1F5F9', marginRight: 8 },
  filterChipActive: { backgroundColor: '#0C1559' },
  filterChipText: { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: '#64748B' },
  filterChipTextActive: { color: '#FFF' },
  historyList: { backgroundColor: '#FFF', borderRadius: 16, padding: 5, borderWidth: 1, borderColor: '#E2E8F0' },
  historyItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  historyLeft: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  historyType: { fontSize: 13, fontFamily: 'Montserrat-SemiBold', color: '#0F172A' },
  historyDate: { fontSize: 12, fontFamily: 'Montserrat-Regular', color: '#64748B', marginTop: 2 },
  historyRef: { fontSize: 10, color: '#94A3B8', fontFamily: 'Montserrat-Regular', marginTop: 2, maxWidth: 180 },
  historyAmount: { fontSize: 14, fontFamily: 'Montserrat-Bold' },
  historyStatus: { fontSize: 10, fontFamily: 'Montserrat-Bold', marginTop: 2 },
  emptyHistory: { alignItems: 'center', paddingVertical: 30 },
  emptyHistoryText: { fontSize: 14, fontFamily: 'Montserrat-SemiBold', color: '#94A3B8', marginTop: 10 },
  emptyHistorySubText: { fontSize: 12, fontFamily: 'Montserrat-Regular', color: '#CBD5E1', marginTop: 4 },
});
