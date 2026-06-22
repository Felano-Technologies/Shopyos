import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Alert,
} from 'react-native';
import AppImage from '@/components/AppImage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { getPayoutHistory, requestPayout } from '@/services/api';
import { useSellerGuard } from '@/hooks/useSellerGuard';
import { useActiveBusiness } from '@/hooks/useBusiness';
import DisclaimerModal from '@/components/DisclaimerModal';
import { getDisclaimerByType, Disclaimer } from '@/services/disclaimers';
export default function PayoutScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasPayoutMethod, setHasPayoutMethod] = useState(false);
  const [balance, setBalance] = useState(0);
  const [payoutHistory, setPayoutHistory] = useState<any[]>([]);
  const [payoutTerms, setPayoutTerms] = useState<Disclaimer | null>(null);
  const [isTermsChecked, setIsTermsChecked] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const { isChecking } = useSellerGuard();
  const { activeBusiness, isLoading: isLoadingBusinesses } = useActiveBusiness();
  
  useEffect(() => {
    if (activeBusiness) {
      const store = activeBusiness;
      setBalance(Number.parseFloat(store.current_balance || 0));
      setHasPayoutMethod(!!store.payout_method);
      fetchHistory(store._id);
    }
  }, [activeBusiness]);

  useEffect(() => {
    getDisclaimerByType('payout_terms').then(setPayoutTerms).catch(() => null);
  }, []);

  const handleWithdraw = () => {
    if (payoutTerms && !isTermsChecked) {
      Alert.alert('Agreement Required', 'Please read and agree to the Payout Terms before withdrawing.');
      return;
    }
    if (balance <= 0) {
      Alert.alert('Insufficient Balance', 'You have no balance available to withdraw.');
      return;
    }
    Alert.alert(
      'Confirm Withdrawal',
      `Request a payout of ₵${balance.toFixed(2)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Withdraw',
          onPress: async () => {
            setIsWithdrawing(true);
            try {
              await requestPayout({ storeId: activeBusiness._id, amount: balance });
              Alert.alert('Request Sent', 'Your payout request has been submitted and will be processed shortly.');
              if (activeBusiness) await fetchHistory(activeBusiness._id);
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Payout request failed. Please try again.');
            } finally {
              setIsWithdrawing(false);
            }
          },
        },
      ]
    );
  };

  const fetchHistory = async (storeId: string) => {
    try {
      const historyResp = await getPayoutHistory(storeId);
      if (historyResp.success) {
        setPayoutHistory(historyResp.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    if (!activeBusiness) return;
    setRefreshing(true);
    try {
      setBalance(Number.parseFloat(activeBusiness.current_balance || 0));
      setHasPayoutMethod(!!activeBusiness.payout_method);
      await fetchHistory(activeBusiness._id);
    } finally {
      setRefreshing(false);
    }
  }, [activeBusiness]);

  // --- Render Item for History ---
  const renderHistoryItem = ({ item }: { item: any }) => (
    <View style={styles.historyItem}>
      <View style={styles.historyLeft}>
        <View style={[styles.statusDot, { backgroundColor: item.status === 'completed' ? '#16A34A' : '#F59E0B' }]} />
        <View>
          <Text style={styles.historyDate}>{new Date(item.created_at).toLocaleDateString([], { month: 'short', day: '2-digit', year: 'numeric' })}</Text>
          <Text style={styles.historyStatus}>{item.status.toUpperCase()}</Text>
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
      {/* Background Watermark */}
      <View style={StyleSheet.absoluteFillObject}>
        <View style={styles.bottomLogos}>
          <AppImage source={require('../../assets/images/splash-icon.png')} style={styles.fadedLogo} />
        </View>
      </View>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        {/* --- Header --- */}
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
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0C1559']} tintColor="#0C1559" />
          }
        >
          {hasPayoutMethod ? (
            // --- ACTIVE DASHBOARD STATE ---
            <View style={styles.contentContainer}>
              {/* Balance Card */}
              <View style={styles.balanceCard}>
                <View>
                  <Text style={styles.balanceLabel}>Available for Payout</Text>
                  <Text style={styles.balanceAmount}>₵{balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                </View>
                <TouchableOpacity style={styles.withdrawBtn} onPress={handleWithdraw} disabled={isWithdrawing}>
                  {isWithdrawing ? (
                    <ActivityIndicator size="small" color="#0C1559" />
                  ) : (
                    <Text style={styles.withdrawText}>Withdraw</Text>
                  )}
                </TouchableOpacity>
              </View>
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
              {/* Method Info */}
              <View style={styles.methodCard}>
                <View style={styles.methodRow}>
                  <View style={styles.methodIcon}>
                    <FontAwesome5 name="university" size={18} color="#0C1559" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.methodTitle}>Standard Payout</Text>
                    <Text style={styles.methodSub}>Ending in **** 4589</Text>
                  </View>
                  <TouchableOpacity onPress={() => router.push('/business/businessRegistration')}>
                    <Text style={styles.editText}>Edit</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.divider} />
                <Text style={styles.scheduleText}>
                  Next scheduled payout: <Text style={{ fontFamily: 'Montserrat-Bold' }}>Feb 14, 2026</Text>
                </Text>
              </View>
              {/* History List */}
              <Text style={styles.sectionTitle}>Recent Payouts</Text>
              <FlatList
                data={payoutHistory}
                keyExtractor={item => item.id}
                renderItem={renderHistoryItem}
                scrollEnabled={false}
                contentContainerStyle={styles.historyList}
              />
            </View>
          ) : (
            // --- EMPTY STATE (No Method Set) ---
            <View style={styles.emptyStateContainer}>
              <View style={styles.emptyIconCircle}>
                <MaterialCommunityIcons name="bank-remove" size={64} color="#CBD5E1" />
              </View>
              <Text style={styles.emptyTitle}>No Payout Method Set</Text>
              <Text style={styles.emptyText}>
                You have not set up a way to get paid yet. Please update your business details to start receiving earnings.
              </Text>
              <TouchableOpacity
                style={styles.actionBtn}
                activeOpacity={0.8}
                onPress={() => router.push('/business/businessRegistration')}
              >
                <Text style={styles.actionBtnText}>Set Up Payout Method</Text>
                <Feather name="arrow-right" size={18} color="#FFF" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => router.back()}
              >
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
  mainContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  safeArea: {
    flex: 1,
  },
  // Background
  bottomLogos: {
    position: 'absolute',
    bottom: 20,
    left: -20,
  },
  fadedLogo: {
    width: 150,
    height: 150,
    resizeMode: 'contain',
    opacity: 0.03,
  },
  // Header
  headerContainer: {
    paddingBottom: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    marginBottom: 10,
    shadowColor: "#0C1559",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Montserrat-Bold',
    color: '#FFF',
  },
  // Content Area
  contentContainer: {
    paddingHorizontal: 20,
    marginTop: 10,
  },
  // Active State Styles
  balanceCard: {
    backgroundColor: '#0C1559',
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: "#0C1559",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  balanceLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontFamily: 'Montserrat-Medium',
    marginBottom: 4,
  },
  balanceAmount: {
    color: '#FFF',
    fontSize: 28,
    fontFamily: 'Montserrat-Bold',
  },
  withdrawBtn: {
    backgroundColor: '#A3E635',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  withdrawText: {
    color: '#0C1559',
    fontFamily: 'Montserrat-Bold',
    fontSize: 12,
  },
  methodCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 25,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  methodIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  methodTitle: {
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
    color: '#0F172A',
  },
  methodSub: {
    fontSize: 12,
    color: '#64748B',
    fontFamily: 'Montserrat-Medium',
  },
  editText: {
    color: '#0C1559',
    fontFamily: 'Montserrat-Bold',
    fontSize: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginBottom: 12,
  },
  scheduleText: {
    fontSize: 12,
    color: '#64748B',
    fontFamily: 'Montserrat-Regular',
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat-Bold',
    color: '#0F172A',
    marginBottom: 12,
  },
  historyList: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 5,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  historyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  historyDate: {
    fontSize: 14,
    fontFamily: 'Montserrat-SemiBold',
    color: '#0F172A',
  },
  historyStatus: {
    fontSize: 11,
    color: '#64748B',
    fontFamily: 'Montserrat-Medium',
  },
  historyAmount: {
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
    color: '#0C1559',
  },
  // Empty State Styles
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    marginTop: 60,
  },
  emptyIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: 'Montserrat-Bold',
    color: '#0F172A',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Montserrat-Regular',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  actionBtn: {
    flexDirection: 'row',
    backgroundColor: '#0C1559',
    paddingVertical: 16,
    paddingHorizontal: 30,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    marginBottom: 16,
    shadowColor: "#0C1559",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  actionBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontFamily: 'Montserrat-Bold',
  },
  secondaryBtn: {
    padding: 12,
  },
  secondaryBtnText: {
    color: '#64748B',
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
  },
  disclaimerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, paddingHorizontal: 4 },
  disclaimerBox: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: '#A3E635', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  disclaimerBoxChecked: { backgroundColor: '#A3E635' },
  disclaimerText: { flex: 1, fontSize: 13, fontFamily: 'Montserrat-Medium', color: '#94A3B8', lineHeight: 18 },
  disclaimerLink: { color: '#A3E635', fontFamily: 'Montserrat-Bold', textDecorationLine: 'underline' },
});