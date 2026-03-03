import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, FlatList,
    TextInput, ActivityIndicator, Modal, RefreshControl, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { getAdminStores, adminVerifyStore } from '@/services/api';

type FilterType = 'all' | 'pending' | 'verified' | 'rejected';

interface Store {
    id: string;
    store_name: string;
    description?: string;
    city?: string;
    category?: string;
    verification_status: string;
    is_verified: boolean;
    rejection_reason?: string;
    created_at: string;
    owner?: {
        id: string;
        full_name?: string;
        email?: string;
    };
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
    pending:  { label: 'Pending',  color: '#92400E', bg: '#FEF3C7', icon: 'time-outline' },
    verified: { label: 'Verified', color: '#065F46', bg: '#D1FAE5', icon: 'checkmark-circle-outline' },
    rejected: { label: 'Rejected', color: '#991B1B', bg: '#FEE2E2', icon: 'close-circle-outline' },
};

const FILTER_TABS: { key: FilterType; label: string }[] = [
    { key: 'all',      label: 'All' },
    { key: 'pending',  label: 'Pending' },
    { key: 'verified', label: 'Verified' },
    { key: 'rejected', label: 'Rejected' },
];

export default function AdminStores() {
    const router = useRouter();
    const [filter, setFilter]         = useState<FilterType>('pending');
    const [search, setSearch]         = useState('');
    const [stores, setStores]         = useState<Store[]>([]);
    const [loading, setLoading]       = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // Reject modal
    const [rejectModal, setRejectModal]   = useState(false);
    const [rejectTarget, setRejectTarget] = useState<Store | null>(null);
    const [rejectReason, setRejectReason] = useState('');

    const loadStores = useCallback(async (showRefreshing = false) => {
        try {
            if (showRefreshing) setRefreshing(true);
            else setLoading(true);

            const params: Record<string, string> = {};
            if (filter !== 'all') params.verificationStatus = filter;
            if (search.trim())    params.search = search.trim();

            const res = await getAdminStores(params);
            const data = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
            setStores(data);
        } catch (err: any) {
            Toast.show({ type: 'error', text1: 'Error', text2: err.message || 'Failed to load stores' });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [filter, search]);

    useEffect(() => { loadStores(); }, [loadStores]);

    const handleApprove = async (store: Store) => {
        try {
            setActionLoading(store.id);
            await adminVerifyStore(store.id, 'verified');
            Toast.show({ type: 'success', text1: 'Approved', text2: `${store.store_name} has been verified` });
            loadStores();
        } catch (err: any) {
            Toast.show({ type: 'error', text1: 'Error', text2: err.message || 'Could not approve store' });
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
        if (!rejectTarget) return;
        if (!rejectReason.trim()) {
            Toast.show({ type: 'error', text1: 'Reason required', text2: 'Please provide a rejection reason' });
            return;
        }
        try {
            setActionLoading(rejectTarget.id);
            setRejectModal(false);
            await adminVerifyStore(rejectTarget.id, 'rejected', rejectReason.trim());
            Toast.show({ type: 'success', text1: 'Rejected', text2: `${rejectTarget.store_name} has been rejected` });
            loadStores();
        } catch (err: any) {
            Toast.show({ type: 'error', text1: 'Error', text2: err.message || 'Could not reject store' });
        } finally {
            setActionLoading(null);
            setRejectTarget(null);
        }
    };

    const StoreCard = ({ item }: { item: Store }) => {
        const statusCfg = STATUS_CONFIG[item.verification_status] || STATUS_CONFIG.pending;
        const isActioning = actionLoading === item.id;

        return (
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <View style={styles.storeAvatar}>
                        <Text style={styles.storeAvatarText}>
                            {(item.store_name || 'S').charAt(0).toUpperCase()}
                        </Text>
                    </View>
                    <View style={styles.storeInfo}>
                        <Text style={styles.storeName} numberOfLines={1}>{item.store_name}</Text>
                        {item.owner?.full_name && (
                            <Text style={styles.storeOwner}>{item.owner.full_name}</Text>
                        )}
                        {item.owner?.email && (
                            <Text style={styles.storeEmail} numberOfLines={1}>{item.owner.email}</Text>
                        )}
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
                        <Ionicons name={statusCfg.icon as any} size={12} color={statusCfg.color} />
                        <Text style={[styles.statusText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
                    </View>
                </View>

                <View style={styles.cardMeta}>
                    {item.city && (
                        <View style={styles.metaRow}>
                            <Ionicons name="location-outline" size={13} color="#64748B" />
                            <Text style={styles.metaText}>{item.city}</Text>
                        </View>
                    )}
                    {item.category && (
                        <View style={styles.metaRow}>
                            <Ionicons name="pricetag-outline" size={13} color="#64748B" />
                            <Text style={styles.metaText}>{item.category}</Text>
                        </View>
                    )}
                    <View style={styles.metaRow}>
                        <Ionicons name="calendar-outline" size={13} color="#64748B" />
                        <Text style={styles.metaText}>
                            {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'N/A'}
                        </Text>
                    </View>
                </View>

                {item.rejection_reason && item.verification_status === 'rejected' && (
                    <View style={styles.rejectionNote}>
                        <Ionicons name="information-circle-outline" size={14} color="#991B1B" />
                        <Text style={styles.rejectionText} numberOfLines={2}>{item.rejection_reason}</Text>
                    </View>
                )}

                {item.verification_status === 'pending' && (
                    <View style={styles.actions}>
                        {isActioning ? (
                            <ActivityIndicator size="small" color="#0C1559" />
                        ) : (
                            <>
                                <TouchableOpacity
                                    style={[styles.actionBtn, styles.approveBtn]}
                                    onPress={() => handleApprove(item)}
                                >
                                    <Ionicons name="checkmark-circle-outline" size={16} color="#FFF" />
                                    <Text style={styles.actionBtnText}>Approve</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.actionBtn, styles.rejectBtn]}
                                    onPress={() => openRejectModal(item)}
                                >
                                    <Ionicons name="close-circle-outline" size={16} color="#FFF" />
                                    <Text style={styles.actionBtnText}>Reject</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                )}

                {item.verification_status === 'verified' && (
                    <View style={styles.actions}>
                        {isActioning ? (
                            <ActivityIndicator size="small" color="#0C1559" />
                        ) : (
                            <TouchableOpacity
                                style={[styles.actionBtn, styles.rejectBtn, { flex: 1 }]}
                                onPress={() => openRejectModal(item)}
                            >
                                <Ionicons name="close-circle-outline" size={16} color="#FFF" />
                                <Text style={styles.actionBtnText}>Revoke Approval</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                {item.verification_status === 'rejected' && (
                    <View style={styles.actions}>
                        {isActioning ? (
                            <ActivityIndicator size="small" color="#0C1559" />
                        ) : (
                            <TouchableOpacity
                                style={[styles.actionBtn, styles.approveBtn, { flex: 1 }]}
                                onPress={() => handleApprove(item)}
                            >
                                <Ionicons name="checkmark-circle-outline" size={16} color="#FFF" />
                                <Text style={styles.actionBtnText}>Approve After Review</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar style="light" />

            <LinearGradient colors={['#0C1559', '#1e40af']} style={styles.header}>
                <SafeAreaView edges={['top', 'left', 'right']}>
                    <View style={styles.headerRow}>
                        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                            <Ionicons name="arrow-back" size={22} color="#FFF" />
                        </TouchableOpacity>
                        <View>
                            <Text style={styles.headerLabel}>ADMIN</Text>
                            <Text style={styles.headerTitle}>Store Verification</Text>
                        </View>
                        <View style={{ width: 40 }} />
                    </View>
                </SafeAreaView>
            </LinearGradient>

            {/* Search */}
            <View style={styles.searchContainer}>
                <Ionicons name="search-outline" size={18} color="#94A3B8" style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search stores or owners..."
                    placeholderTextColor="#94A3B8"
                    value={search}
                    onChangeText={setSearch}
                    returnKeyType="search"
                    onSubmitEditing={() => loadStores()}
                />
                {search.length > 0 && (
                    <TouchableOpacity onPress={() => setSearch('')}>
                        <Ionicons name="close-circle" size={18} color="#94A3B8" />
                    </TouchableOpacity>
                )}
            </View>

            {/* Filter Tabs */}
            <View style={styles.tabs}>
                {FILTER_TABS.map(tab => (
                    <TouchableOpacity
                        key={tab.key}
                        style={[styles.tab, filter === tab.key && styles.tabActive]}
                        onPress={() => setFilter(tab.key)}
                    >
                        <Text style={[styles.tabText, filter === tab.key && styles.tabTextActive]}>
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#0C1559" />
                </View>
            ) : (
                <FlatList
                    data={stores}
                    keyExtractor={item => item.id}
                    renderItem={({ item }) => <StoreCard item={item} />}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={() => loadStores(true)} tintColor="#0C1559" />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Ionicons name="storefront-outline" size={52} color="#CBD5E1" />
                            <Text style={styles.emptyTitle}>No Stores Found</Text>
                            <Text style={styles.emptySubtitle}>No {filter === 'all' ? '' : filter} stores at this time</Text>
                        </View>
                    }
                />
            )}

            {/* Rejection Reason Modal */}
            <Modal visible={rejectModal} transparent animationType="fade" onRequestClose={() => setRejectModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Reject Store</Text>
                        <Text style={styles.modalSubtitle}>
                            Rejecting <Text style={{ fontFamily: 'Montserrat-Bold' }}>{rejectTarget?.store_name}</Text>.
                            Please provide a reason for the seller.
                        </Text>
                        <TextInput
                            style={styles.reasonInput}
                            placeholder="Enter rejection reason..."
                            placeholderTextColor="#94A3B8"
                            value={rejectReason}
                            onChangeText={setRejectReason}
                            multiline
                            numberOfLines={4}
                            textAlignVertical="top"
                        />
                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.modalBtn, styles.modalCancelBtn]}
                                onPress={() => { setRejectModal(false); setRejectTarget(null); }}
                            >
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalBtn, styles.modalConfirmBtn]}
                                onPress={handleReject}
                            >
                                <Text style={styles.modalConfirmText}>Confirm Rejection</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F1F5F9' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    header: { paddingBottom: 24, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 6 },
    backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
    headerLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontFamily: 'Montserrat-Bold', letterSpacing: 2, textAlign: 'center' },
    headerTitle: { color: '#FFF', fontSize: 20, fontFamily: 'Montserrat-Bold', textAlign: 'center' },

    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', marginHorizontal: 16, marginTop: 16, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, elevation: 2 },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, fontSize: 14, fontFamily: 'Montserrat-Medium', color: '#0F172A' },

    tabs: { flexDirection: 'row', marginHorizontal: 16, marginTop: 12, backgroundColor: '#E2E8F0', borderRadius: 12, padding: 3 },
    tab: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
    tabActive: { backgroundColor: '#0C1559', elevation: 3, shadowColor: '#0C1559', shadowOpacity: 0.3, shadowRadius: 6 },
    tabText: { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: '#64748B' },
    tabTextActive: { color: '#FFF' },

    listContent: { padding: 16, paddingBottom: 40 },

    card: { backgroundColor: '#FFF', borderRadius: 20, padding: 16, marginBottom: 14, elevation: 3, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10 },
    cardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
    storeAvatar: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    storeAvatarText: { fontSize: 20, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
    storeInfo: { flex: 1 },
    storeName: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
    storeOwner: { fontSize: 13, fontFamily: 'Montserrat-SemiBold', color: '#334155', marginTop: 1 },
    storeEmail: { fontSize: 11, fontFamily: 'Montserrat-Medium', color: '#64748B', marginTop: 1 },

    statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, gap: 3 },
    statusText: { fontSize: 11, fontFamily: 'Montserrat-Bold' },

    cardMeta: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, gap: 10 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    metaText: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: '#64748B' },

    rejectionNote: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#FEF2F2', borderRadius: 10, padding: 10, marginTop: 10, gap: 6 },
    rejectionText: { flex: 1, fontSize: 12, fontFamily: 'Montserrat-Medium', color: '#991B1B' },

    actions: { flexDirection: 'row', marginTop: 14, gap: 10 },
    actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 12, gap: 5 },
    approveBtn: { backgroundColor: '#10B981' },
    rejectBtn: { backgroundColor: '#EF4444' },
    actionBtnText: { color: '#FFF', fontSize: 13, fontFamily: 'Montserrat-Bold' },

    emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
    emptyTitle: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#334155', marginTop: 12 },
    emptySubtitle: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: '#94A3B8', marginTop: 4 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalCard: { backgroundColor: '#FFF', borderRadius: 24, padding: 24, width: '100%' },
    modalTitle: { fontSize: 20, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginBottom: 6 },
    modalSubtitle: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: '#64748B', marginBottom: 16 },
    reasonInput: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, padding: 12, fontSize: 14, fontFamily: 'Montserrat-Medium', color: '#0F172A', minHeight: 100 },
    modalActions: { flexDirection: 'row', marginTop: 16, gap: 10 },
    modalBtn: { flex: 1, paddingVertical: 13, borderRadius: 14, alignItems: 'center' },
    modalCancelBtn: { backgroundColor: '#F1F5F9' },
    modalConfirmBtn: { backgroundColor: '#EF4444' },
    modalCancelText: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#475569' },
    modalConfirmText: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#FFF' },
});
