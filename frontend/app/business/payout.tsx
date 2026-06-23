import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, FlatList, RefreshControl, Alert, TextInput,
} from 'react-native';
import AppImage from '@/components/AppImage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import {
  getPayoutHistory, requestPayout, getSellerLockedBalance
} from '@/services/payments';
import { useSellerGuard } from '@/hooks/useSellerGuard';
import { useActiveBusiness } from '@/hooks/useBusiness';
import DisclaimerModal from '@/components/DisclaimerModal';
import { getDisclaimerByType, Disclaimer } from '@/services/disclaimers';

const STATUS_FILTERS = ['All', 'Pending', 'Processing', 'Completed', 'Failed'] as const;

function nextMondayLabel() {
  const now = new Date();
  const day = now.getDay();
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  const next = new Date(now);
  next.setDate(now.getDate() + daysUntilMonday);
  return next.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

function statusColor(status: string) {
  switch (status) {
    case 'completed': return '#16A34A';
    case 'processing': return '#2563EB';
    case 'pending': return '#D97706';
    case 'failed': return '#EF4444';
    default: return '#64748B';
  }
}

export default function PayoutScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasPayoutMethod, setHasPayoutMethod] = useState(false);
  const [balance, setBalance] = useState(0);
  const [lockedBalance, setLockedBalance] = useState(0);
  const [lockedEntries, setLockedEntries] = useState<any[]>([]);
  const [showLocked, setShowLocked] = useState(false);
  const [payoutHistory, setPayoutHistory] = useState<any[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [payoutTerms, setPayoutTerms] = useState<Disclaimer | null>(null);
  const [isTermsChecked, setIsTermsChecked] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [showAmountInput, setShowAmountInput] = useState(false);

  const { isChecking } = useSellerGuard();
  const { activeBusiness, isLoading: isLoadingBusinesses } = useActiveBusiness();

  useEffect(() => {
    if (activeBusiness) {
      setBalance(Number.parseFloat(activeBusiness.current_balance || 0));
      setHasPayoutMethod(!!activeBusiness.payout_method);
      fetchHistory(activeBusiness._id);
      fetchLockedBalance(activeBusiness._id);
    }
  }, [activeBusiness]);

  useEffect(() => {
    getDisclaimerByType('payout_terms').then(setPayoutTerms).catch(() => null);
  }, []);

  useEffect(() => {
    let list = payoutHistory;
    if (statusFilter !== 'All') list = list.filter(p => p.status === statusFilter.toLowerCase());
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p =>
        String(p.amount).includes(q) ||
        new Date(p.created_at).toLocaleDateString().toLowerCase().includes(q) ||
        (p.transaction_reference || '').toLowerCase().includes(q)
      );
    }
    setFilteredHistory(list);
  }, [payoutHistory, statusFilter, searchQuery]);

  const fetchHistory = async (storeId: string) => {
    try {
      const resp = await getPayoutHistory(storeId);
      if (resp.success) setPayoutHistory(resp.data);
    } catch { /* no-op */ }
    finally { setLoading(false); }
  };

  const fetchLockedBalance = async (storeId: string) => {
    try {
      const resp = await getSellerLockedBalance(storeId);
      if (resp.success) {
        setLockedEntries(resp.data || []);
        setLockedBalance(Number.parseFloat(resp.lockedTotal || 0));
      }
    } catch { /* no-op */ }
  };

  const onRefresh = useCallback(async () => {
    if (!activeBusiness) return;
    setRefreshing(true);
    setBalance(Number.parseFloat(activeBusiness.current_balance || 0));
    setHasPayoutMethod(!!activeBusiness.payout_method);
    await Promise.all([fetchHistory(activeBusiness._id), fetchLockedBalance(activeBusiness._id)]);
    setRefreshing(false);
  }, [activeBusiness]);

  const handleWithdraw = () => {
    if (payoutTerms && !isTermsChecked) {
      Alert.alert('Agreement Required', 'Please agree to the Payout Terms before withdrawing.');
      return;
    }
    if (balance <= 0) {
      Alert.alert('Insufficient Balance', 'You have no available balance to withdraw.');
      return;
    }
    setWithdrawAmount(balance.toFixed(2));
    setShowAmountInput(true);
  };

  const confirmWithdraw = async () => {
    const amount = Number.parseFloat(withdrawAmount);
    if (!amount || amount <= 0) {
      Alert.alert('Invalid Amount', 'Enter a valid withdrawal amount.');
      return;
    }
    if (amount > balance) {
      Alert.alert('Insufficient Balance', 'Amount exceeds your available balance.');
      return;
    }
    setShowAmountInput(false);
    Alert.alert(
      'Confirm Withdrawal',
      `Request a payout of ₵${amount.toFixed(2)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Withdraw',
          onPress: async () => {
            setIsWithdrawing(true);
            try {
              await requestPayout({
                storeId: activeBusiness._id,
                amount,
                method: activeBusiness.payout_method,
                details: activeBusiness.payout_details
              });
              Alert.alert('Request Sent', 'Your payout request has been submitted.');
              if (activeBusiness) {
                setBalance(prev => prev - amount);
                await fetchHistory(activeBusiness._id);
              }
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Payout request failed.');
            } finally {
              setIsWithdrawing(false);
            }
          },
        },
      ]
    );
  };

  const renderHistoryItem = ({ item }: { item: any }) => (
    <View style={styles.historyItem}>
      <View style={styles.historyLeft}>
        <View style={[styles.statusDot, { backgroundColor: statusColor(item.status) }]} />
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.historyDate}>
              {new Date(item.created_at).toLocaleDateString([], { month: 'short', day: '2-digit', year: 'numeric' })}
            </Text>
            <View style={[styles.typeBadge, { backgroundColor: item.admin_notes?.includes('auto') || item.admin_notes?.includes('Auto') ? '#EFF6FF' : '#F0FDF4' }]}>
              <Text style={[styles.typeBadgeText, { color: item.admin_notes?.includes('auto') || item.admin_notes?.includes('Auto') ? '#2563EB' : '#16A34A' }]}>
                {item.admin_notes?.toLowerCase().includes('auto') ? 'Auto' : 'Manual'}
              </Text>
            </View>
          </View>
          <Text style={[styles.historyStatus, { color: statusColor(item.status) }]}>
            {item.status.toUpperCase()}
          </Text>
          {item.transaction_reference && (
            <Text style={styles.historyRef} numberOfLines={1}>Ref: {item.transaction_reference}</Text>
          )}
        </View>
      </View>
      <Text style={styles.historyAmount}>₵{Number.parseFloat(item.amount).toFixed(2)}</Text>
    </View>
  );

  if (isChecking || isLoadingBusinesses || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0C1559" />
      </View>
    );
  }

  return (
    <View style={styles.mainContainer}>
      <StatusBar style="light" />
      <View style={StyleSheet.absoluteFillObject}>
        <View style={styles.bottomLogos}>
          <AppImage source={require('../../assets/images/splash-icon.png')} style={styles.fadedLogo} />
        </View>
      </View>

      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <LinearGradient
          colors={['#0C1559', '#1e3a8a']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.headerContainer}
        >
          <SafeAreaView edges={['top']} style={{ width: '100%' }}>
            <View style={styles.headerContent}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={24} color="#FFF" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Payouts</Text>
              <View style={{ width: 40 }} />
            </View>
          </SafeAreaView>
        </LinearGradient>

        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0C1559']} />}
        >
          {hasPayoutMethod ? (
            <View style={styles.contentContainer}>
              {/* Balance Card */}
              <View style={styles.balanceCard}>
                <View>
                  <Text style={styles.balanceLabel}>Available Balance</Text>
                  <Text style={styles.balanceAmount}>₵{balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                  {lockedBalance > 0 && (
                    <Text style={styles.lockedHint}>
                      + ₵{lockedBalance.toFixed(2)} locked (return window)
                    </Text>
                  )}
                </View>
                <TouchableOpacity style={styles.withdrawBtn} onPress={handleWithdraw} disabled={isWithdrawing}>
                  {isWithdrawing ? (
                    <ActivityIndicator size="small" color="#0C1559" />
                  ) : (
                    <Text style={styles.withdrawText}>Request Early{'\n'}Payout</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Amount input when requesting */}
              {showAmountInput && (
                <View style={styles.amountInputCard}>
                  <Text style={styles.amountInputLabel}>Enter withdrawal amount (GHS)</Text>
                  <View style={styles.amountInputRow}>
                    <Text style={styles.currencySymbol}>₵</Text>
                    <TextInput
                      style={styles.amountInput}
                      keyboardType="decimal-pad"
                      value={withdrawAmount}
                      onChangeText={setWithdrawAmount}
                      autoFocus
                    />
                    <TouchableOpacity style={styles.confirmBtn} onPress={confirmWithdraw}>
                      <Text style={styles.confirmBtnText}>Confirm</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity onPress={() => setShowAmountInput(false)}>
                    <Text style={styles.cancelLink}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              )}

              {payoutTerms && (
                <View style={styles.disclaimerRow}>
                  <TouchableOpacity onPress={() => setIsTermsChecked(!isTermsChecked)} activeOpacity={0.8}>
                    <View style={[styles.disclaimerBox, isTermsChecked && styles.disclaimerBoxChecked]}>
                      {isTermsChecked && <Ionicons name="checkmark" size={13} color="#FFF" />}
                    </View>
                  </TouchableOpacity>
                  <Text style={styles.disclaimerText}>
                    I agree to the{' '}
                    <Text style={styles.disclaimerLink} onPress={() => setShowTermsModal(true)}>
                      Payout Terms
                    </Text>
                  </Text>
                </View>
              )}

              {/* Schedule Info */}
              <View style={styles.scheduleCard}>
                <Feather name="calendar" size={16} color="#0C1559" style={{ marginRight: 8 }} />
                <Text style={styles.scheduleText}>
                  Next auto-payout: <Text style={{ fontFamily: 'Montserrat-Bold' }}>{nextMondayLabel()}</Text>
                </Text>
              </View>

              {/* Method Card */}
              <View style={styles.methodCard}>
                <View style={styles.methodRow}>
                  <View style={styles.methodIcon}>
                    <FontAwesome5 name="university" size={18} color="#0C1559" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.methodTitle}>Payout Method</Text>
                    <Text style={styles.methodSub}>{activeBusiness.payout_method === 'mobile_money' ? 'Mobile Money' : 'Bank Transfer'}</Text>
                  </View>
                  <TouchableOpacity onPress={() => router.push('/business/businessRegistration')}>
                    <Text style={styles.editText}>Edit</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Payout History */}
              <Text style={styles.sectionTitle}>Payout History</Text>

              {/* Search */}
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

              {/* Status Filters */}
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

              <FlatList
                data={filteredHistory}
                keyExtractor={item => item.id}
                renderItem={renderHistoryItem}
                scrollEnabled={false}
                contentContainerStyle={styles.historyList}
                ListEmptyComponent={
                  <View style={styles.emptyHistory}>
                    <Feather name="inbox" size={32} color="#CBD5E1" />
                    <Text style={styles.emptyHistoryText}>No payouts match your filter</Text>
                    <Text style={styles.emptyHistorySubText}>Auto-payouts run every Monday</Text>
                  </View>
                }
              />

              {/* Locked Earnings */}
              {lockedEntries.length > 0 && (
                <View style={styles.lockedSection}>
                  <TouchableOpacity
                    style={styles.lockedHeader}
                    onPress={() => setShowLocked(!showLocked)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Feather name="lock" size={14} color="#D97706" />
                      <Text style={styles.lockedTitle}>
                        Locked Earnings — ₵{lockedBalance.toFixed(2)}
                      </Text>
                    </View>
                    <Ionicons name={showLocked ? 'chevron-up' : 'chevron-down'} size={16} color="#64748B" />
                  </TouchableOpacity>
                  {showLocked && (
                    <View>
                      {lockedEntries.map((entry) => (
                        <View key={entry.id} style={styles.lockedItem}>
                          <View>
                            <Text style={styles.lockedOrderNum}>
                              {entry.order_number ? `Order #${entry.order_number}` : 'Order'}
                            </Text>
                            <Text style={styles.lockedReason}>
                              {entry.has_open_return
                                ? 'Return pending'
                                : entry.payout_eligible_at
                                ? `Unlocks ${new Date(entry.payout_eligible_at).toLocaleDateString()}`
                                : 'Locked'}
                            </Text>
                          </View>
                          <Text style={styles.lockedAmount}>₵{Number.parseFloat(entry.amount).toFixed(2)}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </View>
          ) : (
            <View style={styles.emptyStateContainer}>
              <View style={styles.emptyIconCircle}>
                <MaterialCommunityIcons name="bank-remove" size={64} color="#CBD5E1" />
              </View>
              <Text style={styles.emptyTitle}>No Payout Method Set</Text>
              <Text style={styles.emptyText}>
                Update your business details to start receiving earnings automatically every Monday.
              </Text>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => router.push('/business/businessRegistration')}
              >
                <Text style={styles.actionBtnText}>Set Up Payout Method</Text>
                <Feather name="arrow-right" size={18} color="#FFF" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.back()}>
                <Text style={styles.secondaryBtnText}>Do this later</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        <DisclaimerModal
          type="payout_terms"
          visible={showTermsModal}
          onClose={() => setShowTermsModal(false)}
          onAcknowledge={() => { setIsTermsChecked(true); setShowTermsModal(false); }}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#F8FAFC' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  safeArea: { flex: 1 },
  bottomLogos: { position: 'absolute', bottom: 20, left: -20 },
  fadedLogo: { width: 150, height: 150, resizeMode: 'contain', opacity: 0.03 },
  headerContainer: {
    paddingBottom: 20, borderBottomLeftRadius: 30, borderBottomRightRadius: 30,
    marginBottom: 10, shadowColor: '#0C1559', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 12, elevation: 8,
  },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginTop: 10 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontFamily: 'Montserrat-Bold', color: '#FFF' },
  contentContainer: { paddingHorizontal: 20, marginTop: 10 },
  balanceCard: {
    backgroundColor: '#0C1559', borderRadius: 20, padding: 24, marginBottom: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    shadowColor: '#0C1559', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  balanceLabel: { color: '#94A3B8', fontSize: 12, fontFamily: 'Montserrat-Medium', marginBottom: 4 },
  balanceAmount: { color: '#FFF', fontSize: 28, fontFamily: 'Montserrat-Bold' },
  lockedHint: { color: '#94A3B8', fontSize: 11, fontFamily: 'Montserrat-Regular', marginTop: 4 },
  withdrawBtn: { backgroundColor: '#A3E635', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, alignItems: 'center' },
  withdrawText: { color: '#0C1559', fontFamily: 'Montserrat-Bold', fontSize: 11, textAlign: 'center' },
  amountInputCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  amountInputLabel: { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: '#64748B', marginBottom: 10 },
  amountInputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  currencySymbol: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#0C1559', marginRight: 6 },
  amountInput: { flex: 1, borderBottomWidth: 2, borderBottomColor: '#0C1559', fontSize: 22, fontFamily: 'Montserrat-Bold', color: '#0C1559', paddingBottom: 4 },
  confirmBtn: { backgroundColor: '#0C1559', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10, marginLeft: 12 },
  confirmBtnText: { color: '#FFF', fontFamily: 'Montserrat-Bold', fontSize: 13 },
  cancelLink: { color: '#94A3B8', fontFamily: 'Montserrat-Medium', fontSize: 12, textAlign: 'center' },
  scheduleCard: { backgroundColor: '#EFF6FF', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  scheduleText: { fontSize: 13, fontFamily: 'Montserrat-Regular', color: '#1E293B', flex: 1 },
  methodCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  methodRow: { flexDirection: 'row', alignItems: 'center' },
  methodIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  methodTitle: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
  methodSub: { fontSize: 12, color: '#64748B', fontFamily: 'Montserrat-Medium' },
  editText: { color: '#0C1559', fontFamily: 'Montserrat-Bold', fontSize: 12 },
  sectionTitle: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginBottom: 12 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 12,
    paddingHorizontal: 12, height: 44, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0',
  },
  searchInput: { flex: 1, fontSize: 13, fontFamily: 'Montserrat-Regular', color: '#1E293B' },
  filtersRow: { marginBottom: 12 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F1F5F9', marginRight: 8 },
  filterChipActive: { backgroundColor: '#0C1559' },
  filterChipText: { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: '#64748B' },
  filterChipTextActive: { color: '#FFF' },
  historyList: { backgroundColor: '#FFF', borderRadius: 16, padding: 5, borderWidth: 1, borderColor: '#E2E8F0' },
  historyItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  historyLeft: { flexDirection: 'row', alignItems: 'flex-start' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10, marginTop: 5 },
  historyDate: { fontSize: 13, fontFamily: 'Montserrat-SemiBold', color: '#0F172A' },
  typeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  typeBadgeText: { fontSize: 10, fontFamily: 'Montserrat-Bold' },
  historyStatus: { fontSize: 11, fontFamily: 'Montserrat-Bold', marginTop: 2 },
  historyRef: { fontSize: 10, color: '#94A3B8', fontFamily: 'Montserrat-Regular', marginTop: 2, maxWidth: 160 },
  historyAmount: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
  emptyHistory: { alignItems: 'center', paddingVertical: 30 },
  emptyHistoryText: { fontSize: 14, fontFamily: 'Montserrat-SemiBold', color: '#94A3B8', marginTop: 10 },
  emptyHistorySubText: { fontSize: 12, fontFamily: 'Montserrat-Regular', color: '#CBD5E1', marginTop: 4 },
  lockedSection: { marginTop: 20, backgroundColor: '#FFF', borderRadius: 16, borderWidth: 1, borderColor: '#FEF3C7', overflow: 'hidden' },
  lockedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, backgroundColor: '#FFFBEB' },
  lockedTitle: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: '#B45309' },
  lockedItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderTopWidth: 1, borderTopColor: '#FEF3C7' },
  lockedOrderNum: { fontSize: 13, fontFamily: 'Montserrat-SemiBold', color: '#1E293B' },
  lockedReason: { fontSize: 11, fontFamily: 'Montserrat-Regular', color: '#94A3B8', marginTop: 2 },
  lockedAmount: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: '#B45309' },
  emptyStateContainer: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, marginTop: 60 },
  emptyIconCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  emptyTitle: { fontSize: 20, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginBottom: 12, textAlign: 'center' },
  emptyText: { fontSize: 14, fontFamily: 'Montserrat-Regular', color: '#64748B', textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  actionBtn: { flexDirection: 'row', backgroundColor: '#0C1559', paddingVertical: 16, paddingHorizontal: 30, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', marginBottom: 16 },
  actionBtnText: { color: '#FFF', fontSize: 15, fontFamily: 'Montserrat-Bold' },
  secondaryBtn: { padding: 12 },
  secondaryBtnText: { color: '#64748B', fontSize: 14, fontFamily: 'Montserrat-Bold' },
  disclaimerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, paddingHorizontal: 4 },
  disclaimerBox: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: '#A3E635', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  disclaimerBoxChecked: { backgroundColor: '#A3E635' },
  disclaimerText: { flex: 1, fontSize: 13, fontFamily: 'Montserrat-Medium', color: '#94A3B8', lineHeight: 18 },
  disclaimerLink: { color: '#A3E635', fontFamily: 'Montserrat-Bold', textDecorationLine: 'underline' },
});
