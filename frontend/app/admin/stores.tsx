import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import AdminShell, { AdminPanel } from '@/components/admin/AdminShell';
import { adminColors, useAdminBreakpoint } from '@/components/admin/adminTheme';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { adminVerifyStore, getAdminStores } from '@/services/api';

type FilterType = 'all' | 'pending' | 'verified' | 'rejected';

interface Store {
  id?: string;
  _id?: string;
  store_name: string;
  description?: string;
  city?: string;
  category?: string;
  logo_url?: string;
  verification_status: string;
  owner?: {
    id: string;
    full_name?: string;
    email?: string;
  };
}

const FILTER_TABS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'verified', label: 'Verified' },
  { key: 'rejected', label: 'Rejected' },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  pending: { label: 'Pending', color: '#92400E', bg: '#FEF3C7', icon: 'time-outline' },
  verified: { label: 'Verified', color: '#065F46', bg: '#D1FAE5', icon: 'checkmark-circle-outline' },
  rejected: { label: 'Rejected', color: '#991B1B', bg: '#FEE2E2', icon: 'close-circle-outline' },
};

export default function AdminStores() {
  const router = useRouter();
  const { isDesktop } = useAdminBreakpoint();
  const [filter, setFilter] = useState<FilterType>('pending');
  const [search, setSearch] = useState('');
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<Store | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const refreshPendingCount = async () => {
    try {
      const res = await getAdminStores({ verificationStatus: 'pending' });
      const data = Array.isArray(res?.stores)
        ? res.stores
        : Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res)
            ? res
            : [];
      setPendingCount(data.length);
    } catch (error) {
      console.log('Error fetching pending count', error);
    }
  };

  const loadStores = useCallback(async (showRefreshing = false) => {
    try {
      if (showRefreshing) setRefreshing(true);
      else setLoading(true);

      const params: Record<string, string> = {};
      if (filter !== 'all') params.verificationStatus = filter;
      if (search.trim()) params.search = search.trim();

      const res = await getAdminStores(params);
      const data = Array.isArray(res?.stores)
        ? res.stores
        : Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res)
            ? res
            : [];
      setStores(data);
      refreshPendingCount();
    } catch (error: any) {
      CustomInAppToast.show({
        type: 'error',
        title: 'Error',
        message: error.message || 'Failed to load stores',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter, search]);

  useEffect(() => {
    loadStores();
  }, [loadStores]);

  const handleApprove = async (storeId: string, storeName: string) => {
    try {
      setActionLoading(storeId);
      await adminVerifyStore(storeId, 'verified');
      CustomInAppToast.show({
        type: 'success',
        title: 'Approved',
        message: `${storeName} has been verified`,
      });
      loadStores();
    } catch (error: any) {
      CustomInAppToast.show({
        type: 'error',
        title: 'Error',
        message: error.message || 'Could not approve store',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const openRejectModal = (store: Store) => {
    setRejectTarget(store);
    setRejectReason('');
    setRejectModal(true);
  };

  const handleReject = async () => {
    const storeId = rejectTarget?.id || rejectTarget?._id;
    if (!storeId) return;
    if (!rejectReason.trim()) {
      CustomInAppToast.show({
        type: 'error',
        title: 'Reason required',
        message: 'Please provide a rejection reason',
      });
      return;
    }

    try {
      setActionLoading(storeId);
      setRejectModal(false);
      await adminVerifyStore(storeId, 'rejected', rejectReason.trim());
      CustomInAppToast.show({
        type: 'success',
        title: 'Rejected',
        message: `${rejectTarget?.store_name} has been rejected`,
      });
      loadStores();
    } catch (error: any) {
      CustomInAppToast.show({
        type: 'error',
        title: 'Error',
        message: error.message || 'Could not reject store',
      });
    } finally {
      setActionLoading(null);
      setRejectTarget(null);
    }
  };

  const summary = useMemo(() => {
    const verified = stores.filter((store) => store.verification_status === 'verified').length;
    const rejected = stores.filter((store) => store.verification_status === 'rejected').length;
    return [
      { label: 'Visible Stores', value: stores.length, color: adminColors.blue, icon: 'storefront-outline' },
      { label: 'Pending', value: pendingCount, color: adminColors.amber, icon: 'time-outline' },
      { label: 'Verified', value: verified, color: adminColors.green, icon: 'checkmark-circle-outline' },
      { label: 'Rejected', value: rejected, color: adminColors.red, icon: 'close-circle-outline' },
    ];
  }, [pendingCount, stores]);

  return (
    <>
      <StatusBar style="dark" />
      <AdminShell
        title="Stores"
        subtitle="Review documentation, approve storefronts, and manage verification outcomes."
        searchValue={search}
        onSearchChange={setSearch}
        onSearchSubmit={() => loadStores()}
        searchPlaceholder="Search stores by name or owner..."
        onRefresh={() => loadStores(true)}
      >
        <View style={styles.page}>
          <View style={styles.summaryRow}>
            {summary.map((item) => (
              <AdminPanel key={item.label} style={styles.summaryCard}>
                <View style={[styles.summaryIcon, { backgroundColor: `${item.color}18` }]}>
                  <Ionicons name={item.icon as any} size={18} color={item.color} />
                </View>
                <Text style={styles.summaryLabel}>{item.label}</Text>
                <Text style={styles.summaryValue}>{item.value.toLocaleString()}</Text>
              </AdminPanel>
            ))}
          </View>

          <View style={styles.filterRow}>
            {FILTER_TABS.map((tab) => {
              const active = filter === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  onPress={() => setFilter(tab.key)}
                >
                  <Text style={[styles.filterText, active && styles.filterTextActive]}>{tab.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={adminColors.blue} />
            </View>
          ) : (
            <FlatList
              data={stores}
              keyExtractor={(item, index) => item.id || item._id || index.toString()}
              numColumns={isDesktop ? 2 : 1}
              key={isDesktop ? 'desktop' : 'mobile'}
              columnWrapperStyle={isDesktop ? styles.columnWrap : undefined}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={() => loadStores(true)} tintColor={adminColors.blue} />
              }
              renderItem={({ item }) => {
                const actualId = item.id || item._id;
                const status = STATUS_CONFIG[item.verification_status] || STATUS_CONFIG.pending;
                const isActioning = actionLoading === actualId;

                const goToDetails = () => {
                  if (!actualId) {
                    CustomInAppToast.show({
                      type: 'error',
                      title: 'Invalid Store',
                      message: 'Missing store identifier.',
                    });
                    return;
                  }
                  router.push(`/admin/store-details/${actualId}` as any);
                };

                return (
                  <TouchableOpacity style={styles.cardOuter} onPress={goToDetails}>
                    <AdminPanel style={styles.storeCard}>
                      <View style={styles.cardHeader}>
                        <View style={styles.storeAvatar}>
                          {item.logo_url ? (
                            <Image source={{ uri: item.logo_url }} style={styles.logoImage} />
                          ) : (
                            <Text style={styles.storeAvatarText}>
                              {(item.store_name || 'S').charAt(0).toUpperCase()}
                            </Text>
                          )}
                        </View>
                        <View style={styles.storeHeaderInfo}>
                          <Text style={styles.storeName} numberOfLines={1}>
                            {item.store_name}
                          </Text>
                          <Text style={styles.storeOwner}>
                            {item.owner?.full_name || 'No owner name'}
                          </Text>
                          <Text style={styles.storeEmail} numberOfLines={1}>
                            {item.owner?.email || 'No email provided'}
                          </Text>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                          <Ionicons name={status.icon as any} size={12} color={status.color} />
                          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                        </View>
                      </View>

                      <View style={styles.metaCard}>
                        <View style={styles.metaRow}>
                          <Ionicons name="location-outline" size={14} color={adminColors.textMuted} />
                          <Text style={styles.metaText}>{item.city || 'Location N/A'}</Text>
                        </View>
                        <View style={styles.metaRow}>
                          <Ionicons name="pricetag-outline" size={14} color={adminColors.textMuted} />
                          <Text style={styles.metaText}>{item.category || 'General'}</Text>
                        </View>
                      </View>

                      <TouchableOpacity
                        style={styles.docLink}
                        onPress={(event) => {
                          event.stopPropagation();
                          goToDetails();
                        }}
                      >
                        <Feather name="file-text" size={14} color={adminColors.navy} />
                        <Text style={styles.docLinkText}>See store documentation & legal assets</Text>
                        <Feather name="chevron-right" size={14} color={adminColors.navy} />
                      </TouchableOpacity>

                      <View style={styles.actions}>
                        {isActioning ? (
                          <ActivityIndicator size="small" color={adminColors.navy} />
                        ) : (
                          <>
                            {item.verification_status === 'pending' ? (
                              <>
                                <TouchableOpacity
                                  style={[styles.actionBtn, styles.approveBtn]}
                                  onPress={(event) => {
                                    event.stopPropagation();
                                    handleApprove(actualId!, item.store_name);
                                  }}
                                >
                                  <Text style={styles.actionBtnText}>Quick approve</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[styles.actionBtn, styles.rejectBtn]}
                                  onPress={(event) => {
                                    event.stopPropagation();
                                    openRejectModal(item);
                                  }}
                                >
                                  <Text style={[styles.actionBtnText, { color: adminColors.red }]}>Reject</Text>
                                </TouchableOpacity>
                              </>
                            ) : item.verification_status === 'verified' ? (
                              <TouchableOpacity
                                style={[styles.actionBtn, styles.rejectBtn, styles.actionBtnFull]}
                                onPress={(event) => {
                                  event.stopPropagation();
                                  openRejectModal(item);
                                }}
                              >
                                <Text style={[styles.actionBtnText, { color: adminColors.red }]}>Revoke approval</Text>
                              </TouchableOpacity>
                            ) : (
                              <TouchableOpacity
                                style={[styles.actionBtn, styles.approveBtn, styles.actionBtnFull]}
                                onPress={(event) => {
                                  event.stopPropagation();
                                  handleApprove(actualId!, item.store_name);
                                }}
                              >
                                <Text style={styles.actionBtnText}>Re-approve</Text>
                              </TouchableOpacity>
                            )}
                          </>
                        )}
                      </View>
                    </AdminPanel>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <AdminPanel style={styles.emptyState}>
                  <Ionicons name="storefront-outline" size={54} color={adminColors.textSoft} />
                  <Text style={styles.emptyTitle}>No stores found</Text>
                  <Text style={styles.emptySubtitle}>Try a different filter or search term.</Text>
                </AdminPanel>
              }
            />
          )}
        </View>

        <Modal visible={rejectModal} animationType="fade" transparent onRequestClose={() => setRejectModal(false)}>
          <View style={styles.modalOverlay}>
            <AdminPanel style={styles.modalCard}>
              <Text style={styles.modalTitle}>Reject store</Text>
              <Text style={styles.modalSubtitle}>
                Share a clear reason so the store owner knows what to fix before reapplying.
              </Text>
              <TextInput
                value={rejectReason}
                onChangeText={setRejectReason}
                placeholder="Enter rejection reason..."
                placeholderTextColor={adminColors.textSoft}
                multiline
                style={styles.modalInput}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalSecondary} onPress={() => setRejectModal(false)}>
                  <Text style={styles.modalSecondaryText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalPrimary} onPress={handleReject}>
                  <Text style={styles.modalPrimaryText}>Reject store</Text>
                </TouchableOpacity>
              </View>
            </AdminPanel>
          </View>
        </Modal>
      </AdminShell>
    </>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginBottom: 16,
  },
  summaryCard: {
    minWidth: 160,
    flex: 1,
  },
  summaryIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  summaryLabel: {
    color: adminColors.textMuted,
    fontSize: 13,
    fontFamily: 'Montserrat-SemiBold',
    marginBottom: 4,
  },
  summaryValue: {
    color: adminColors.text,
    fontSize: 26,
    fontFamily: 'Montserrat-Bold',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  filterChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: adminColors.surface,
    borderWidth: 1,
    borderColor: adminColors.borderStrong,
  },
  filterChipActive: {
    backgroundColor: adminColors.navyDeep,
    borderColor: adminColors.navyDeep,
  },
  filterText: {
    color: adminColors.textMuted,
    fontSize: 12,
    fontFamily: 'Montserrat-SemiBold',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  listContent: {
    paddingBottom: 120,
  },
  columnWrap: {
    gap: 14,
  },
  cardOuter: {
    flex: 1,
    marginBottom: 14,
  },
  storeCard: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
  },
  storeAvatar: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: adminColors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  storeAvatarText: {
    color: adminColors.navy,
    fontFamily: 'Montserrat-Bold',
    fontSize: 20,
  },
  storeHeaderInfo: {
    flex: 1,
  },
  storeName: {
    color: adminColors.text,
    fontSize: 16,
    fontFamily: 'Montserrat-Bold',
    marginBottom: 4,
  },
  storeOwner: {
    color: adminColors.textMuted,
    fontSize: 13,
    fontFamily: 'Montserrat-SemiBold',
    marginBottom: 2,
  },
  storeEmail: {
    color: adminColors.textSoft,
    fontSize: 12,
    fontFamily: 'Montserrat-Regular',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 10,
    fontFamily: 'Montserrat-Bold',
  },
  metaCard: {
    marginTop: 16,
    marginBottom: 14,
    gap: 12,
    backgroundColor: adminColors.surfaceSoft,
    borderRadius: 18,
    padding: 14,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  metaText: {
    color: adminColors.textMuted,
    fontSize: 13,
    fontFamily: 'Montserrat-Regular',
  },
  docLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  docLinkText: {
    flex: 1,
    color: adminColors.navy,
    fontSize: 13,
    fontFamily: 'Montserrat-SemiBold',
  },
  actions: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  actionBtnFull: {
    flex: 1,
  },
  approveBtn: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  rejectBtn: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  actionBtnText: {
    color: '#047857',
    fontSize: 12,
    fontFamily: 'Montserrat-Bold',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 46,
  },
  emptyTitle: {
    color: adminColors.text,
    fontSize: 18,
    fontFamily: 'Montserrat-Bold',
    marginTop: 14,
    marginBottom: 6,
  },
  emptySubtitle: {
    color: adminColors.textMuted,
    fontSize: 13,
    fontFamily: 'Montserrat-Regular',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
  },
  modalTitle: {
    color: adminColors.text,
    fontSize: 22,
    fontFamily: 'Montserrat-Bold',
    marginBottom: 6,
  },
  modalSubtitle: {
    color: adminColors.textMuted,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'Montserrat-Regular',
    marginBottom: 16,
  },
  modalInput: {
    minHeight: 130,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: adminColors.borderStrong,
    backgroundColor: adminColors.surfaceSoft,
    padding: 14,
    textAlignVertical: 'top',
    color: adminColors.text,
    fontFamily: 'Montserrat-Regular',
    fontSize: 14,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 18,
  },
  modalSecondary: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: adminColors.surfaceSoft,
  },
  modalSecondaryText: {
    color: adminColors.textMuted,
    fontFamily: 'Montserrat-SemiBold',
  },
  modalPrimary: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: adminColors.navyDeep,
  },
  modalPrimaryText: {
    color: '#FFFFFF',
    fontFamily: 'Montserrat-Bold',
  },
});
