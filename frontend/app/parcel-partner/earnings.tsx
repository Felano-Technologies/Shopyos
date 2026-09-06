import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, FlatList, RefreshControl, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { getMyHubs, updateHubPayoutMethod } from '@/services/parcelPartner';
import { requestHubPayout, getHubPayoutHistory } from '@/services/payments';
import { CustomInAppToast } from '@/components/InAppToastHost';
import DisclaimerModal from '@/components/DisclaimerModal';
import { getDisclaimerByType, acknowledgeDisclaimer, Disclaimer } from '@/services/disclaimers';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';
import { formatCurrency } from '@/utils/formatCurrency';

const MOMO_NETWORKS = ['MTN', 'Vodafone', 'AirtelTigo'] as const;
const NETWORK_CODES: Record<string, string> = { MTN: 'MTN', Vodafone: 'VOD', AirtelTigo: 'ATL' };

function statusColor(status: string) {
  switch (status) {
    case 'completed': return '#16A34A';
    case 'processing': return '#2563EB';
    case 'pending': return '#D97706';
    case 'failed': return '#EF4444';
    default: return '#64748B';
  }
}

export default function ParcelPartnerEarningsScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [hubs, setHubs] = useState<any[]>([]);
  const [selectedHub, setSelectedHub] = useState<any | null>(null);
  const [loadingHubs, setLoadingHubs] = useState(true);

  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [showAmountSheet, setShowAmountSheet] = useState(false);
  const [requestAmount, setRequestAmount] = useState('');
  const [isRequesting, setIsRequesting] = useState(false);

  const [showMethodForm, setShowMethodForm] = useState(false);
  const [methodTab, setMethodTab] = useState<'momo' | 'bank'>('momo');
  const [momoNetwork, setMomoNetwork] = useState('MTN');
  const [momoPhone, setMomoPhone] = useState('');
  const [momoName, setMomoName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankName, setBankName] = useState('');
  const [savingMethod, setSavingMethod] = useState(false);

  const [hubEarningsTerms, setHubEarningsTerms] = useState<Disclaimer | null>(null);
  const [isTermsChecked, setIsTermsChecked] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  useEffect(() => {
    getDisclaimerByType('parcel_hub_earnings').then(setHubEarningsTerms).catch(() => null);
  }, []);

  const fetchHubs = useCallback(async () => {
    try {
      setLoadingHubs(true);
      const res = await getMyHubs();
      if (res.success) {
        setHubs(res.data);
        setSelectedHub((prev: any) => prev ? (res.data.find((h: any) => h.id === prev.id) || res.data[0] || null) : (res.data[0] || null));
      }
    } catch (err: any) {
      CustomInAppToast.show({ type: 'error', title: 'Error', message: err.message || 'Failed to load hubs.' });
    } finally {
      setLoadingHubs(false);
    }
  }, []);

  const fetchHistory = useCallback(async (hubId: string) => {
    try {
      setLoadingHistory(true);
      const res = await getHubPayoutHistory(hubId);
      if (res.success) setHistory(res.data);
    } catch { /* no-op */ }
    finally { setLoadingHistory(false); }
  }, []);

  useEffect(() => { fetchHubs(); }, [fetchHubs]);
  useEffect(() => {
    if (selectedHub) fetchHistory(selectedHub.id);
  }, [selectedHub, fetchHistory]);

  useEffect(() => {
    if (!selectedHub?.payout_details) return;
    if (selectedHub.payout_method === 'mobile_money') {
      const networkKey = Object.keys(NETWORK_CODES).find(k => NETWORK_CODES[k] === selectedHub.payout_details.network) || 'MTN';
      setMomoNetwork(networkKey);
      setMomoPhone(selectedHub.payout_details.phone || '');
      setMomoName(selectedHub.payout_details.name || '');
      setMethodTab('momo');
    } else if (selectedHub.payout_method === 'bank') {
      setBankAccount(selectedHub.payout_details.account_number || '');
      setBankName(selectedHub.payout_details.name || '');
      setMethodTab('bank');
    }
  }, [selectedHub]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchHubs();
    if (selectedHub) await fetchHistory(selectedHub.id);
    setRefreshing(false);
  }, [fetchHubs, fetchHistory, selectedHub]);

  const handleSaveMethod = async () => {
    if (!selectedHub) return;
    if (methodTab === 'momo' && (!momoPhone.trim() || !momoName.trim())) {
      CustomInAppToast.show({ type: 'error', title: 'Missing Info', message: 'Enter your MOMO phone number and full name.' });
      return;
    }
    if (methodTab === 'bank' && (!bankAccount.trim() || !bankName.trim())) {
      CustomInAppToast.show({ type: 'error', title: 'Missing Info', message: 'Enter your account number and account holder name.' });
      return;
    }

    setSavingMethod(true);
    try {
      const details = methodTab === 'momo'
        ? { phone: momoPhone.trim(), network: NETWORK_CODES[momoNetwork], name: momoName.trim() }
        : { account_number: bankAccount.trim(), name: bankName.trim(), bank_code: '030' };

      await updateHubPayoutMethod(selectedHub.id, methodTab === 'momo' ? 'mobile_money' : 'bank', details);
      CustomInAppToast.show({ type: 'success', title: 'Saved', message: 'Payout method updated successfully.' });
      setShowMethodForm(false);
      await fetchHubs();
    } catch (e: any) {
      CustomInAppToast.show({ type: 'error', title: 'Error', message: e.message || 'Failed to save payout method.' });
    } finally {
      setSavingMethod(false);
    }
  };

  const handleRequestPayout = () => {
    if (!selectedHub?.payout_method) {
      CustomInAppToast.show({ type: 'error', title: 'No Payout Method', message: 'Please set up a payout method first.' });
      setShowMethodForm(true);
      return;
    }
    const balance = Number.parseFloat(selectedHub.current_balance || 0);
    if (balance < 10) {
      CustomInAppToast.show({ type: 'error', title: 'Insufficient Balance', message: 'Minimum payout amount is GHS 10.' });
      return;
    }
    setRequestAmount(balance.toFixed(2));
    setShowAmountSheet(true);
  };

  const confirmRequest = async () => {
    if (hubEarningsTerms && !isTermsChecked) {
      CustomInAppToast.show({ type: 'info', title: 'Agreement Required', message: 'Please agree to the Parcel Hub Earnings terms before requesting a payout.' });
      return;
    }
    const amount = Number.parseFloat(requestAmount);
    if (!amount || amount < 10) {
      CustomInAppToast.show({ type: 'error', title: 'Invalid Amount', message: 'Minimum payout is GHS 10.' });
      return;
    }
    setShowAmountSheet(false);
    setIsRequesting(true);
    try {
      await requestHubPayout(selectedHub.id, amount);
      CustomInAppToast.show({ type: 'success', title: 'Request Sent', message: 'Your payout has been requested and will be processed shortly.' });
      await fetchHubs();
      await fetchHistory(selectedHub.id);
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
          <Feather name="arrow-up-right" size={16} color={statusColor(item.status)} />
        </View>
        <View>
          <Text style={styles.historyDate}>
            {new Date(item.created_at).toLocaleDateString([], { month: 'short', day: '2-digit', year: 'numeric' })}
          </Text>
          {item.transaction_reference && (
            <Text style={styles.historyRef} numberOfLines={1}>Ref: {item.transaction_reference}</Text>
          )}
        </View>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.historyAmount, { color: statusColor(item.status) }]}>+{formatCurrency(item.amount)}</Text>
        <Text style={[styles.historyStatus, { color: statusColor(item.status) }]}>{item.status.toUpperCase()}</Text>
      </View>
    </View>
  );

  if (loadingHubs) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!selectedHub) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" backgroundColor={colors.headerGradient[0]} />
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <SafeAreaView edges={['top', 'left', 'right']}>
            <View style={styles.navBar}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={24} color={colors.accent} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Earnings</Text>
              <View style={{ width: 40 }} />
            </View>
          </SafeAreaView>
        </View>
        <View style={styles.centered}>
          <Feather name="inbox" size={40} color={colors.textMuted} />
          <Text style={styles.emptyText}>No hub assigned to your account yet.</Text>
          <Text style={styles.emptySubText}>An admin needs to assign you to a parcel hub before you can view earnings or request a payout.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor={colors.headerGradient[0]} />
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <SafeAreaView edges={['top', 'left', 'right']}>
          <View style={styles.navBar}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color={colors.accent} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{selectedHub.hub_name}</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.balanceContainer}>
            <Text style={styles.balanceLabel}>Hub Balance</Text>
            <Text style={styles.balanceValue}>{formatCurrency(selectedHub.current_balance || 0)}</Text>
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.earlyPayoutBtn, isRequesting && { opacity: 0.6 }]}
                onPress={handleRequestPayout}
                disabled={isRequesting}
              >
                {isRequesting
                  ? <ActivityIndicator size="small" color={colors.accentText} />
                  : <Text style={styles.earlyPayoutBtnText}>Request Payout</Text>}
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
        <View style={styles.content}>
          <TouchableOpacity style={styles.methodSummaryCard} onPress={() => setShowMethodForm(v => !v)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View style={styles.methodIconCircle}>
                <Feather name={selectedHub.payout_method === 'bank' ? 'credit-card' : 'smartphone'} size={16} color={colors.primary} />
              </View>
              <View style={{ marginLeft: 10, flex: 1 }}>
                <Text style={styles.methodSummaryTitle}>Payout Method</Text>
                <Text style={styles.methodSummarySub} numberOfLines={1}>
                  {selectedHub.payout_method ? (selectedHub.payout_method === 'bank' ? 'Bank Transfer' : 'Mobile Money') : 'Not set up yet'}
                </Text>
              </View>
            </View>
            <Feather name={showMethodForm ? 'chevron-up' : 'chevron-right'} size={18} color={colors.textMuted} />
          </TouchableOpacity>

          {showMethodForm && (
            <View style={styles.formCard}>
              <View style={styles.methodTabs}>
                {(['momo', 'bank'] as const).map((t) => (
                  <TouchableOpacity key={t} style={[styles.methodTab, methodTab === t && styles.methodTabActive]} onPress={() => setMethodTab(t)}>
                    <Text style={[styles.methodTabText, methodTab === t && styles.methodTabTextActive]}>
                      {t === 'momo' ? 'Mobile Money' : 'Bank Transfer'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {methodTab === 'momo' ? (
                <>
                  <View style={styles.networkRow}>
                    {MOMO_NETWORKS.map((n) => (
                      <TouchableOpacity key={n} style={[styles.networkChip, momoNetwork === n && styles.networkChipActive]} onPress={() => setMomoNetwork(n)}>
                        <Text style={[styles.networkChipText, momoNetwork === n && styles.networkChipTextActive]}>{n}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TextInput style={styles.formInput} value={momoName} onChangeText={setMomoName} placeholder="Full name on MOMO" placeholderTextColor={colors.textMuted} />
                  <TextInput style={styles.formInput} value={momoPhone} onChangeText={setMomoPhone} keyboardType="phone-pad" placeholder="024XXXXXXX" placeholderTextColor={colors.textMuted} />
                </>
              ) : (
                <>
                  <TextInput style={styles.formInput} value={bankName} onChangeText={setBankName} placeholder="Account holder name" placeholderTextColor={colors.textMuted} />
                  <TextInput style={styles.formInput} value={bankAccount} onChangeText={setBankAccount} keyboardType="number-pad" placeholder="Account number" placeholderTextColor={colors.textMuted} />
                </>
              )}

              <TouchableOpacity style={[styles.saveMethodBtn, savingMethod && { opacity: 0.6 }]} onPress={handleSaveMethod} disabled={savingMethod}>
                {savingMethod ? <ActivityIndicator size="small" color={colors.textInverse} /> : <Text style={styles.saveMethodBtnText}>Save</Text>}
              </TouchableOpacity>
            </View>
          )}

          {showAmountSheet && (
            <View style={styles.amountSheet}>
              <Text style={styles.amountSheetTitle}>Enter Amount (GHS)</Text>
              <Text style={styles.amountSheetNote}>Min: GHS 10 · Available: {formatCurrency(selectedHub.current_balance || 0)}</Text>
              <View style={styles.amountInputRow}>
                <Text style={styles.currencySymbol}>₵</Text>
                <TextInput style={styles.amountInput} keyboardType="decimal-pad" value={requestAmount} onChangeText={setRequestAmount} autoFocus />
                <TouchableOpacity style={styles.confirmBtn} onPress={confirmRequest}>
                  <Text style={styles.confirmBtnText}>Request</Text>
                </TouchableOpacity>
              </View>

              {hubEarningsTerms && (
                <View style={styles.disclaimerRow}>
                  <TouchableOpacity activeOpacity={0.8} onPress={async () => {
                    if (isTermsChecked) { setIsTermsChecked(false); return; }
                    try { await acknowledgeDisclaimer('parcel_hub_earnings', hubEarningsTerms.version); setIsTermsChecked(true); }
                    catch { CustomInAppToast.show({ type: 'error', title: 'Error', message: 'Could not record your agreement. Please try again.' }); }
                  }}>
                    <View style={[styles.disclaimerBox, isTermsChecked && styles.disclaimerBoxChecked]}>
                      {isTermsChecked && <Ionicons name="checkmark" size={13} color="#FFF" />}
                    </View>
                  </TouchableOpacity>
                  <Text style={styles.disclaimerText}>
                    I agree to the{' '}
                    <Text style={styles.disclaimerLink} onPress={() => setShowTermsModal(true)}>Parcel Hub Earnings Terms</Text>
                  </Text>
                </View>
              )}

              <TouchableOpacity onPress={() => setShowAmountSheet(false)} style={{ alignItems: 'center', marginTop: 8 }}>
                <Text style={{ color: colors.textMuted, fontFamily: 'Montserrat-Medium', fontSize: 13 }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.sectionTitle}>Payout History</Text>
          {loadingHistory ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 20 }} />
          ) : (
            <FlatList
              data={history}
              keyExtractor={(item) => item.id}
              renderItem={renderHistoryItem}
              scrollEnabled={false}
              ListEmptyComponent={
                <View style={styles.emptyHistory}>
                  <Feather name="inbox" size={32} color={colors.textMuted} />
                  <Text style={styles.emptyHistoryText}>No payouts yet</Text>
                </View>
              }
            />
          )}
        </View>
      </ScrollView>

      <DisclaimerModal
        type="parcel_hub_earnings"
        visible={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        onAcknowledge={() => { setIsTermsChecked(true); setShowTermsModal(false); }}
      />
    </View>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundAlt },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.backgroundAlt, paddingHorizontal: 32 },
  emptyText: { fontSize: 15, fontFamily: 'Montserrat-Bold', color: colors.text, marginTop: 16, textAlign: 'center' },
  emptySubText: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: colors.textMuted, marginTop: 8, textAlign: 'center', lineHeight: 19 },
  header: { backgroundColor: colors.headerGradient[0], paddingBottom: 20 },
  navBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8 },
  backBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12 },
  headerTitle: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#FFF' },
  balanceContainer: { paddingHorizontal: 20, marginTop: 16 },
  balanceLabel: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: 'rgba(255,255,255,0.7)' },
  balanceValue: { fontSize: 32, fontFamily: 'Montserrat-Bold', color: '#FFF', marginTop: 4 },
  actionRow: { flexDirection: 'row', marginTop: 16 },
  earlyPayoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 20,
  },
  earlyPayoutBtnText: { color: colors.accentText, fontFamily: 'Montserrat-Bold', fontSize: 14 },
  content: { padding: 20 },
  methodSummaryCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.borderStrong, marginBottom: 16,
  },
  methodIconCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  methodSummaryTitle: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: colors.text },
  methodSummarySub: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: colors.textMuted, marginTop: 2 },
  formCard: { backgroundColor: colors.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.borderStrong, marginBottom: 16 },
  methodTabs: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  methodTab: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: colors.backgroundAlt, borderWidth: 1.5, borderColor: colors.borderStrong },
  methodTabActive: { borderColor: colors.primary, backgroundColor: colors.border },
  methodTabText: { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: colors.textMuted },
  methodTabTextActive: { color: colors.primary },
  networkRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  networkChip: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10, backgroundColor: colors.border, borderWidth: 1, borderColor: 'transparent' },
  networkChipActive: { borderColor: '#2563EB' },
  networkChipText: { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: colors.textSecondary },
  networkChipTextActive: { color: '#2563EB' },
  formInput: {
    backgroundColor: colors.backgroundAlt, borderRadius: 10, borderWidth: 1, borderColor: colors.borderStrong,
    padding: 12, fontSize: 14, fontFamily: 'Montserrat-Regular', color: colors.text, marginBottom: 12,
  },
  saveMethodBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  saveMethodBtnText: { color: colors.textInverse, fontFamily: 'Montserrat-Bold', fontSize: 14 },
  amountSheet: { backgroundColor: colors.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.borderStrong, marginBottom: 16 },
  amountSheetTitle: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: colors.text, marginBottom: 4 },
  amountSheetNote: { fontSize: 12, fontFamily: 'Montserrat-Regular', color: colors.textMuted, marginBottom: 14 },
  amountInputRow: { flexDirection: 'row', alignItems: 'center' },
  currencySymbol: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: colors.primary, marginRight: 6 },
  amountInput: { flex: 1, borderBottomWidth: 2, borderBottomColor: colors.primary, fontSize: 22, fontFamily: 'Montserrat-Bold', color: colors.primary, paddingBottom: 4 },
  confirmBtn: { backgroundColor: colors.primary, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10, marginLeft: 12 },
  confirmBtnText: { color: colors.textInverse, fontFamily: 'Montserrat-Bold', fontSize: 13 },
  disclaimerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, paddingHorizontal: 4 },
  disclaimerBox: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  disclaimerBoxChecked: { backgroundColor: colors.primary },
  disclaimerText: { flex: 1, fontSize: 13, fontFamily: 'Montserrat-Medium', color: colors.textMuted, lineHeight: 18 },
  disclaimerLink: { color: colors.primary, fontFamily: 'Montserrat-Bold', textDecorationLine: 'underline' },
  sectionTitle: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: colors.text, marginBottom: 12 },
  historyItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.borderStrong,
  },
  historyLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBox: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  historyDate: { fontSize: 13, fontFamily: 'Montserrat-SemiBold', color: colors.text },
  historyRef: { fontSize: 11, fontFamily: 'Montserrat-Regular', color: colors.textMuted, marginTop: 2, maxWidth: 160 },
  historyAmount: { fontSize: 14, fontFamily: 'Montserrat-Bold' },
  historyStatus: { fontSize: 10, fontFamily: 'Montserrat-Bold', marginTop: 2 },
  emptyHistory: { alignItems: 'center', paddingVertical: 40 },
  emptyHistoryText: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: colors.textMuted, marginTop: 10 },
});
