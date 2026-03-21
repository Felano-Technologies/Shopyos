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
import { CustomInAppToast } from "@/components/InAppToastHost";
import { getAdminStores, adminVerifyStore } from '@/services/api';

type FilterType = 'all' | 'pending' | 'verified' | 'rejected';

interface Store {
    id?: string;
    _id?: string; // Handling MongoDB _id fallback
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
    pending: { label: 'Pending', color: '#92400E', bg: '#FEF3C7', icon: 'time-outline' },
    verified: { label: 'Verified', color: '#065F46', bg: '#D1FAE5', icon: 'checkmark-circle-outline' },
    rejected: { label: 'Rejected', color: '#991B1B', bg: '#FEE2E2', icon: 'close-circle-outline' },
};

const FILTER_TABS: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'verified', label: 'Verified' },
    { key: 'rejected', label: 'Rejected' },
];

export default function AdminStores() {
    const router = useRouter();
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
            const data = Array.isArray(res?.stores) ? res.stores : (Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []));
            setPendingCount(data.length);
        } catch (e) {
            console.log("Error fetching pending count", e);
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
            const data = Array.isArray(res?.stores) ? res.stores : (Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []));
            setStores(data);
            refreshPendingCount();
        } catch (err: any) {
            CustomInAppCustomInAppToast.show({ type: 'error', title: 'Error', message: err.message || 'Failed to load stores' });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [filter, search]);

    useEffect(() => { loadStores(); }, [loadStores]);

    const handleApprove = async (storeId: string, storeName: string) => {
        try {
            setActionLoading(storeId);
            await adminVerifyStore(storeId, 'verified');
            CustomInAppCustomInAppToast.show({ type: 'success', title: 'Approved', message: `${storeName} has been verified` });
            loadStores();
        } catch (err: any) {
            CustomInAppCustomInAppToast.show({ type: 'error', title: 'Error', message: err.message || 'Could not approve store' });
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
            CustomInAppCustomInAppToast.show({ type: 'error', title: 'Reason required', message: 'Please provide a rejection reason' });
            return;
        }
        try {
            setActionLoading(storeId);
            setRejectModal(false);
            await adminVerifyStore(storeId, 'rejected', rejectReason.trim());
            CustomInAppCustomInAppToast.show({ type: 'success', title: 'Rejected', message: `${rejectTarget?.store_name} has been rejected` });
            loadStores();
        } catch (err: any) {
            CustomInAppCustomInAppToast.show({ type: 'error', title: 'Error', message: err.message || 'Could not reject store' });
        } finally {
            setActionLoading(null);
            setRejectTarget(null);
        }
    };

    const StoreCard = ({ item }: { item: Store }) => {
        // --- SAFE ID EXTRACTION ---
        const actualId = item.id || item._id; 
        
        const statusCfg = STATUS_CONFIG[item.verification_status] || STATUS_CONFIG.pending;
        const isActioning = actionLoading === actualId;

        const goToDetails = () => {
            if (!actualId) {
                CustomInAppCustomInAppToast.show({ type: 'error', title: 'Invalid Store', message: 'Missing store identifier.' });
                return;
            }
            router.push(`/admin/store-details/${actualId}` as any);
        };

        return (
            <TouchableOpacity 
                style={styles.card} 
                onPress={goToDetails}
                activeOpacity={0.8}
            >
                <View style={styles.cardHeader}>
                    <View style={styles.storeAvatar}>
                        <Text style={styles.storeAvatarText}>
                            {(item.store_name || 'S').charAt(0).toUpperCase()}
                        </Text>
                    </View>
                    <View style={styles.storeInfo}>
                        <Text style={styles.storeName} numberOfLines={1}>{item.store_name}</Text>
                        <Text style={styles.storeOwner}>{item.owner?.full_name || 'No Owner Name'}</Text>
                        <Text style={styles.storeEmail} numberOfLines={1}>{item.owner?.email}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
                        <Ionicons name={statusCfg.icon as any} size={12} color={statusCfg.color} />
                        <Text style={[styles.statusText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
                    </View>
                </View>

                <View style={styles.cardMeta}>
                    <View style={styles.metaRow}>
                        <Ionicons name="location-outline" size={13} color="#64748B" />
                        <Text style={styles.metaText}>{item.city || 'Location N/A'}</Text>
                    </View>
                    <View style={styles.metaRow}>
                        <Ionicons name="pricetag-outline" size={13} color="#64748B" />
                        <Text style={styles.metaText}>{item.category || 'General'}</Text>
                    </View>
                </View>

                {/* --- CLICKABLE DOCUMENTATION LINK --- */}
                <TouchableOpacity 
                    style={styles.docLink} 
                    onPress={(e) => {
                        e.stopPropagation(); // Prevents double push
                        goToDetails();
                    }}
                >
                    <Feather name="file-text" size={14} color="#0C1559" />
                    <Text style={styles.docLinkText}>See Store Documentation & Legal Assets</Text>
                    <Feather name="chevron-right" size={14} color="#0C1559" />
                </TouchableOpacity>

                <View style={styles.actions}>
                    {isActioning ? (
                        <ActivityIndicator size="small" color="#0C1559" />
                    ) : (
                        <>
                            {item.verification_status === 'pending' && (
                                <>
                                    <TouchableOpacity
                                        style={[styles.actionBtn, styles.approveBtn]}
                                        onPress={(e) => { e.stopPropagation(); handleApprove(actualId!, item.store_name); }}
                                    >
                                        <Text style={styles.actionBtnText}>Quick Approve</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.actionBtn, styles.rejectBtn]}
                                        onPress={(e) => { e.stopPropagation(); openRejectModal(item); }}
                                    >
                                        <Text style={styles.actionBtnText}>Reject</Text>
                                    </TouchableOpacity>
                                </>
                            )}
                            {item.verification_status === 'verified' && (
                                <TouchableOpacity
                                    style={[styles.actionBtn, styles.rejectBtn, { flex: 1 }]}
                                    onPress={(e) => { e.stopPropagation(); openRejectModal(item); }}
                                >
                                    <Text style={styles.actionBtnText}>Revoke Approval</Text>
                                </TouchableOpacity>
                            )}
                            {item.verification_status === 'rejected' && (
                                <TouchableOpacity
                                    style={[styles.actionBtn, styles.approveBtn, { flex: 1 }]}
                                    onPress={(e) => { e.stopPropagation(); handleApprove(actualId!, item.store_name); }}
                                >
                                    <Text style={styles.actionBtnText}>Re-Approve</Text>
                                </TouchableOpacity>
                            )}
                        </>
                    )}
                </View>
            </TouchableOpacity>
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
                        <View style={{ alignItems: 'center' }}>
                            <Text style={styles.headerLabel}>ADMINISTRATION</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={styles.headerTitle}>Store Verifications</Text>
                                {pendingCount > 0 && (
                                    <View style={styles.headerBadge}>
                                        <Text style={styles.headerBadgeText}>{pendingCount}</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                        <View style={{ width: 40 }} />
                    </View>
                </SafeAreaView>
            </LinearGradient>

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
            </View>

            <View style={styles.tabs}>
                {FILTER_TABS.map(tab => (
                    <TouchableOpacity
                        key={tab.key}
                        style={[styles.tab, filter === tab.key && styles.tabActive]}
                        onPress={() => setFilter(tab.key)}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={[styles.tabText, filter === tab.key && styles.tabTextActive]}>
                                {tab.label}
                            </Text>
                            {tab.key === 'pending' && pendingCount > 0 && (
                                <View style={[styles.tabIndicator, filter === 'pending' && styles.tabIndicatorActive]}>
                                    <Text style={[styles.tabIndicatorText, filter === 'pending' && styles.tabIndicatorTextActive]}>
                                        {pendingCount}
                                    </Text>
                                </View>
                            )}
                        </View>
                    </TouchableOpacity>
                ))}
            </View>

            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" color="#0C1559" /></View>
            ) : (
                <FlatList
                    data={stores}
                    keyExtractor={(item, index) => (item.id || item._id || index).toString()}
                    renderItem={({ item }) => <StoreCard item={item} />}
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadStores(true)} tintColor="#0C1559" />}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Ionicons name="storefront-outline" size={52} color="#CBD5E1" />
                            <Text style={styles.emptyTitle}>No Stores Found</Text>
                            <Text style={styles.emptySubtitle}>No {filter} stores at this time.</Text>
                        </View>
                    }
                />
            )}

            <Modal visible={rejectModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Reject Application</Text>
                        <Text style={styles.modalSubtitle}>Reason for <Text style={{fontWeight: 'bold'}}>{rejectTarget?.store_name}</Text>:</Text>
                        <TextInput
                            style={styles.reasonInput}
                            placeholder="Type rejection reason..."
                            multiline
                            value={rejectReason}
                            onChangeText={setRejectReason}
                            textAlignVertical="top"
                        />
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={[styles.modalBtn, styles.modalCancelBtn]} onPress={() => setRejectModal(false)}>
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalBtn, styles.modalConfirmBtn]} onPress={handleReject}>
                                <Text style={styles.modalConfirmText}>Confirm</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { paddingBottom: 25, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10 },
    backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
    headerLabel: { color: '#A3E635', fontSize: 10, fontFamily: 'Montserrat-Bold', letterSpacing: 2 },
    headerTitle: { color: '#FFF', fontSize: 18, fontFamily: 'Montserrat-Bold' },
    headerBadge: { backgroundColor: '#EF4444', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 8, minWidth: 20, alignItems: 'center' },
    headerBadgeText: { color: '#FFF', fontSize: 10, fontFamily: 'Montserrat-Bold' },
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', marginHorizontal: 16, marginTop: 20, borderRadius: 16, paddingHorizontal: 15, height: 50, elevation: 2 },
    searchIcon: { marginRight: 10 },
    searchInput: { flex: 1, fontSize: 14, fontFamily: 'Montserrat-Medium' },
    tabs: { flexDirection: 'row', marginHorizontal: 16, marginTop: 15, backgroundColor: '#E2E8F0', borderRadius: 14, padding: 4 },
    tab: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
    tabActive: { backgroundColor: '#0C1559', elevation: 3 },
    tabText: { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: '#64748B' },
    tabTextActive: { color: '#FFF' },
    tabIndicator: { backgroundColor: '#CBD5E1', borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1, marginLeft: 5 },
    tabIndicatorActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
    tabIndicatorText: { fontSize: 9, fontFamily: 'Montserrat-Bold', color: '#64748B' },
    tabIndicatorTextActive: { color: '#FFF' },
    listContent: { padding: 16, paddingBottom: 40 },
    card: { backgroundColor: '#FFF', borderRadius: 24, padding: 20, marginBottom: 16, elevation: 4, shadowColor: '#0C1559', shadowOpacity: 0.05 },
    cardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
    storeAvatar: { width: 50, height: 50, borderRadius: 15, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    storeAvatarText: { fontSize: 22, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
    storeInfo: { flex: 1 },
    storeName: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
    storeOwner: { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: '#64748B', marginTop: 2 },
    storeEmail: { fontSize: 10, color: '#94A3B8' },
    statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, gap: 4 },
    statusText: { fontSize: 10, fontFamily: 'Montserrat-Bold' },
    cardMeta: { flexDirection: 'row', marginTop: 12, gap: 15 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    metaText: { fontSize: 12, color: '#64748B', fontFamily: 'Montserrat-Medium' },
    docLink: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 12, borderRadius: 15, marginTop: 15, borderWidth: 1, borderColor: '#E2E8F0', gap: 10 },
    docLinkText: { flex: 1, fontSize: 11, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
    actions: { flexDirection: 'row', marginTop: 15, gap: 10 },
    actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 14 },
    approveBtn: { backgroundColor: '#10B981' },
    rejectBtn: { backgroundColor: '#EF4444' },
    actionBtnText: { color: '#FFF', fontSize: 12, fontFamily: 'Montserrat-Bold' },
    emptyState: { alignItems: 'center', marginTop: 50 },
    emptyTitle: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#334155', marginTop: 15 },
    emptySubtitle: { fontSize: 13, color: '#94A3B8', marginTop: 5 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    modalCard: { backgroundColor: '#FFF', borderRadius: 24, padding: 25 },
    modalTitle: { fontSize: 20, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
    modalSubtitle: { fontSize: 14, color: '#64748B', marginVertical: 10 },
    reasonInput: { backgroundColor: '#F8FAFC', borderRadius: 15, padding: 15, height: 100, borderWidth: 1, borderColor: '#E2E8F0' },
    modalActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
    modalBtn: { flex: 1, padding: 15, borderRadius: 15, alignItems: 'center' },
    modalCancelBtn: { backgroundColor: '#F1F5F9' },
    modalConfirmBtn: { backgroundColor: '#EF4444' },
    modalCancelText: { color: '#64748B', fontFamily: 'Montserrat-Bold' },
    modalConfirmText: { color: '#FFF', fontFamily: 'Montserrat-Bold' }
});