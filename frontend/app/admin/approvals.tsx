import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { adminColors } from '@/components/admin/adminTheme';
import { CustomInAppToast } from '@/components/InAppToastHost';
import {
  getAdminStores,
  getPendingDriverVerifications,
  adminVerifyStore,
  approveDriverVerification,
  rejectDriverVerification,
} from '@/services/admin';

const HEADER_GRADIENT = ['#0C1559', '#1e3a8a'] as [string, string];

export default function AdminApprovals() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'stores' | 'drivers'>('stores');
  const [pendingStores, setPendingStores] = useState<any[]>([]);
  const [pendingDrivers, setPendingDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<{ id: string; type: 'store' | 'driver' } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const [storesRes, driversRes] = await Promise.all([
        getAdminStores({ verification_status: 'pending' }),
        getPendingDriverVerifications(),
      ]);
      const stores = Array.isArray(storesRes?.stores)
        ? storesRes.stores
        : Array.isArray(storesRes)
        ? storesRes
        : [];
      const drivers = Array.isArray(driversRes?.verifications)
        ? driversRes.verifications
        : Array.isArray(driversRes)
        ? driversRes
        : [];
      setPendingStores(stores);
      setPendingDrivers(drivers);
    } catch (e: any) {
      CustomInAppToast.show({ type: 'error', title: 'Error', message: e.message });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleApprove = async (id: string, type: 'store' | 'driver') => {
    try {
      setActionLoading(true);
      if (type === 'store') {
        await adminVerifyStore(id, 'verified');
        setPendingStores((prev) => prev.filter((s) => (s.id || s._id) !== id));
      } else {
        await approveDriverVerification(id);
        setPendingDrivers((prev) => prev.filter((d) => (d.id || d._id) !== id));
      }
      CustomInAppToast.show({ type: 'success', title: 'Approved', message: 'Application approved successfully.' });
    } catch (e: any) {
      CustomInAppToast.show({ type: 'error', title: 'Error', message: e.message });
    } finally {
      setActionLoading(false);
    }
  };

  const openRejectModal = (id: string, type: 'store' | 'driver') => {
    setRejectTarget({ id, type });
    setRejectReason('');
    setShowRejectModal(true);
  };

  const handleRejectSubmit = async () => {
    if (!rejectTarget) return;
    try {
      setActionLoading(true);
      if (rejectTarget.type === 'store') {
        await adminVerifyStore(rejectTarget.id, 'rejected', rejectReason);
        setPendingStores((prev) => prev.filter((s) => (s.id || s._id) !== rejectTarget.id));
      } else {
        await rejectDriverVerification(rejectTarget.id, rejectReason);
        setPendingDrivers((prev) => prev.filter((d) => (d.id || d._id) !== rejectTarget.id));
      }
      CustomInAppToast.show({ type: 'success', title: 'Rejected', message: 'Application rejected.' });
      setShowRejectModal(false);
      setRejectTarget(null);
    } catch (e: any) {
      CustomInAppToast.show({ type: 'error', title: 'Error', message: e.message });
    } finally {
      setActionLoading(false);
    }
  };

  const totalPending = pendingStores.length + pendingDrivers.length;
  const activeList = activeTab === 'stores' ? pendingStores : pendingDrivers;

  const renderCard = ({ item }: { item: any }) => {
    const id = item.id || item._id || '';
    const isStore = activeTab === 'stores';
    const name = isStore ? (item.store_name || 'Unnamed Store') : (item.user?.full_name || item.full_name || 'Unknown Driver');
    const email = isStore ? (item.owner?.email || item.email || '') : (item.user?.email || item.email || '');
    const date = item.created_at ? new Date(item.created_at).toLocaleDateString() : 'N/A';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardAvatar}>
            <Text style={styles.cardAvatarText}>{name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardName}>{name}</Text>
            {email ? <Text style={styles.cardEmail}>{email}</Text> : null}
            <Text style={styles.cardDate}>Submitted: {date}</Text>
          </View>
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.approveBtn}
            onPress={() => handleApprove(id, activeTab === 'stores' ? 'store' : 'driver')}
            disabled={actionLoading}
          >
            <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
            <Text style={styles.approveBtnText}>Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.rejectBtn}
            onPress={() => openRejectModal(id, activeTab === 'stores' ? 'store' : 'driver')}
            disabled={actionLoading}
          >
            <Ionicons name="close-circle-outline" size={16} color="#DC2626" />
            <Text style={styles.rejectBtnText}>Reject</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <LinearGradient
          colors={HEADER_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.header}
        >
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Pending Approvals</Text>
            <Text style={styles.headerSubtitle}>{totalPending} total pending</Text>
          </View>
        </LinearGradient>

        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'stores' && styles.tabBtnActive]}
            onPress={() => setActiveTab('stores')}
          >
            <Text style={[styles.tabText, activeTab === 'stores' && styles.tabTextActive]}>
              Stores
            </Text>
            {pendingStores.length > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pendingStores.length}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'drivers' && styles.tabBtnActive]}
            onPress={() => setActiveTab('drivers')}
          >
            <Text style={[styles.tabText, activeTab === 'drivers' && styles.tabTextActive]}>
              Drivers
            </Text>
            {pendingDrivers.length > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pendingDrivers.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#0C1559" />
          </View>
        ) : (
          <FlatList
            data={activeList}
            keyExtractor={(item) => item.id || item._id || Math.random().toString()}
            renderItem={renderCard}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor="#0C1559" />}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Ionicons name="checkmark-done-circle-outline" size={48} color={adminColors.textMuted} />
                <Text style={styles.emptyTitle}>All clear!</Text>
                <Text style={styles.emptyText}>No pending {activeTab} applications.</Text>
              </View>
            }
          />
        )}

        <Modal visible={showRejectModal} transparent animationType="fade" onRequestClose={() => setShowRejectModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Reject Application</Text>
              <Text style={styles.modalSub}>Provide a reason for rejection.</Text>
              <TextInput
                style={styles.reasonInput}
                placeholder="Enter rejection reason..."
                placeholderTextColor="#94A3B8"
                multiline
                value={rejectReason}
                onChangeText={setRejectReason}
              />
              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.modalCancel} onPress={() => setShowRejectModal(false)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalConfirm, !rejectReason.trim() && { opacity: 0.5 }]}
                  onPress={handleRejectSubmit}
                  disabled={!rejectReason.trim() || actionLoading}
                >
                  {actionLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.confirmText}>Submit</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 18,
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  headerTitle: { color: '#fff', fontSize: 20, fontFamily: 'Montserrat-Bold' },
  headerSubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontFamily: 'Montserrat-Regular', marginTop: 2 },
  tabRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#fff',
    shadowColor: '#0B2060',
    shadowOpacity: 0.07,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  tabBtnActive: { backgroundColor: '#0C1559' },
  tabText: { color: '#1D2B73', fontSize: 14, fontFamily: 'Montserrat-SemiBold' },
  tabTextActive: { color: '#fff' },
  badge: {
    backgroundColor: '#DC2626',
    borderRadius: 999,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: { color: '#fff', fontSize: 10, fontFamily: 'Montserrat-Bold' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: 16, paddingBottom: 40 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#0B2060',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cardHeader: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  cardAvatar: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardAvatarText: { color: '#0C1559', fontSize: 18, fontFamily: 'Montserrat-Bold' },
  cardName: { color: '#1D2B73', fontSize: 15, fontFamily: 'Montserrat-Bold', marginBottom: 2 },
  cardEmail: { color: adminColors.textMuted, fontSize: 12, fontFamily: 'Montserrat-Regular', marginBottom: 2 },
  cardDate: { color: adminColors.textMuted, fontSize: 11, fontFamily: 'Montserrat-Regular' },
  cardActions: { flexDirection: 'row', gap: 10 },
  approveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#16A34A',
    borderRadius: 12,
    paddingVertical: 10,
  },
  approveBtnText: { color: '#fff', fontFamily: 'Montserrat-Bold', fontSize: 13 },
  rejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    paddingVertical: 10,
  },
  rejectBtnText: { color: '#DC2626', fontFamily: 'Montserrat-Bold', fontSize: 13 },
  emptyWrap: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { color: '#1D2B73', fontSize: 18, fontFamily: 'Montserrat-Bold', marginTop: 12, marginBottom: 6 },
  emptyText: { color: adminColors.textMuted, fontSize: 13, fontFamily: 'Montserrat-Regular' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 18,
  },
  modalTitle: { color: '#1D2B73', fontSize: 20, fontFamily: 'Montserrat-Bold', marginBottom: 6 },
  modalSub: { color: adminColors.textMuted, fontSize: 13, fontFamily: 'Montserrat-Regular', marginBottom: 14 },
  reasonInput: {
    minHeight: 110,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D9E2F2',
    backgroundColor: '#fff',
    padding: 14,
    textAlignVertical: 'top',
    color: '#1D2B73',
    fontFamily: 'Montserrat-Regular',
    fontSize: 14,
  },
  modalBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 },
  modalCancel: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
  },
  cancelText: { color: adminColors.textMuted, fontFamily: 'Montserrat-SemiBold' },
  modalConfirm: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#0C1559',
    minWidth: 80,
    alignItems: 'center',
  },
  confirmText: { color: '#fff', fontFamily: 'Montserrat-Bold' },
});
