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
import AdminScreenSkeleton from '@/components/admin/AdminSkeleton';
import { adminColors } from '@/components/admin/adminTheme';
import { CustomInAppToast } from '@/components/InAppToastHost';
import {
  getAdminStores,
  getPendingDriverVerifications,
  adminVerifyStore,
  approveDriverVerification,
  rejectDriverVerification,
} from '@/services/admin';

const HEADER_GRADIENT = ['#01217B', '#0C2E8A', '#0E5E1A'] as [string, string, string];

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
            <Text style={styles.cardEmail}>{email ? `${email} · ` : ''}{date}</Text>
          </View>
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.rejectBtn}
            onPress={() => openRejectModal(id, activeTab === 'stores' ? 'store' : 'driver')}
            disabled={actionLoading}
          >
            <Text style={styles.rejectBtnText}>Reject</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.approveBtn}
            onPress={() => handleApprove(id, activeTab === 'stores' ? 'store' : 'driver')}
            disabled={actionLoading}
          >
            <Text style={styles.approveBtnText}>Approve</Text>
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
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Pending Approvals</Text>
          {totalPending > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{totalPending}</Text>
            </View>
          )}
          <View style={{ flex: 1 }} />
        </LinearGradient>

        <View style={styles.tabRow}>
          {(['stores', 'drivers'] as const).map(tab => {
            const count = tab === 'stores' ? pendingStores.length : pendingDrivers.length;
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  {count > 0 && ` (${count})`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {loading && !refreshing ? (
          <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F7FA' }} edges={['top', 'left', 'right']}>
            <AdminScreenSkeleton metrics={4} rows={4} />
          </SafeAreaView>
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
  safeArea: { flex: 1, backgroundColor: '#F5F7FA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: '#fff', fontSize: 18, fontFamily: 'Montserrat-Bold' },
  headerBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  headerBadgeText: { color: '#fff', fontSize: 11, fontFamily: 'Montserrat-Bold' },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    margin: 12,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0C1559',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: { fontSize: 13, fontFamily: 'Montserrat-SemiBold', color: '#64748B' },
  tabTextActive: { color: '#0C1559' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: 0, paddingBottom: 40 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0C1559',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  cardHeader: { flexDirection: 'row', gap: 12, marginBottom: 12, alignItems: 'center' },
  cardAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardAvatarText: { color: '#7C3AED', fontSize: 16, fontFamily: 'Montserrat-Bold' },
  cardName: { color: '#0F172A', fontSize: 14, fontFamily: 'Montserrat-SemiBold', marginBottom: 2 },
  cardEmail: { color: '#94A3B8', fontSize: 11, fontFamily: 'Montserrat-Regular' },
  cardDate: { color: '#94A3B8', fontSize: 11, fontFamily: 'Montserrat-Regular' },
  cardActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  approveBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#16A34A',
    alignItems: 'center',
  },
  approveBtnText: { color: '#FFFFFF', fontSize: 13, fontFamily: 'Montserrat-SemiBold' },
  rejectBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FFF5F5',
    alignItems: 'center',
  },
  rejectBtnText: { color: '#DC2626', fontSize: 13, fontFamily: 'Montserrat-SemiBold' },
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
