import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    TextInput, ActivityIndicator, RefreshControl,
} from 'react-native';
import AppImage from '@/components/AppImage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getAdminAuditLogsFiltered } from '@/services/admin';
import { CustomInAppToast } from "@/components/InAppToastHost";
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { exportAdminData } from '@/utils/adminExport';

const ROLE_FILTERS = ['All', 'admin', 'seller', 'driver', 'buyer'];
const STATUS_FILTERS = ['All', 'success', 'failed'];
const PAGE_SIZE = 100;

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
    admin:  { bg: '#0C1559', text: '#FFFFFF' },
    seller: { bg: '#DBEAFE', text: '#1E40AF' },
    driver: { bg: '#FEF3C7', text: '#B45309' },
    buyer:  { bg: '#DCFCE7', text: '#15803D' },
};

export default function AdminAuditLogs() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const offsetRef = useRef(0);

    // Filters
    const [roleFilter, setRoleFilter] = useState('All');
    const [statusFilter, setStatusFilter] = useState('All');

    const buildParams = useCallback((offset: number) => {
        const p: Record<string, any> = { limit: PAGE_SIZE, offset };
        if (roleFilter !== 'All') p.role = roleFilter;
        if (statusFilter !== 'All') p.status = statusFilter;
        if (searchQuery.trim()) p.action = searchQuery.trim();
        return p;
    }, [roleFilter, statusFilter, searchQuery]);

    const loadLogs = useCallback(async (isRefresh = false) => {
        try {
            if (isRefresh) {
                setRefreshing(true);
                offsetRef.current = 0;
            } else {
                setLoading(true);
            }

            const res = await getAdminAuditLogsFiltered(buildParams(0));
            const data = Array.isArray(res?.logs) ? res.logs : (Array.isArray(res) ? res : []);
            offsetRef.current = data.length;
            setHasMore(data.length === PAGE_SIZE);
            setLogs(data);
        } catch (err: any) {
            CustomInAppToast.show({ type: 'error', title: 'Error', message: err.message || 'Failed to load logs' });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [buildParams]);

    const loadMore = useCallback(async () => {
        if (loadingMore || !hasMore) return;
        try {
            setLoadingMore(true);
            const res = await getAdminAuditLogsFiltered(buildParams(offsetRef.current));
            const data = Array.isArray(res?.logs) ? res.logs : (Array.isArray(res) ? res : []);
            offsetRef.current += data.length;
            setHasMore(data.length === PAGE_SIZE);
            setLogs(prev => [...prev, ...data]);
        } catch (err: any) {
            CustomInAppToast.show({ type: 'error', title: 'Error', message: err.message || 'Failed to load more' });
        } finally {
            setLoadingMore(false);
        }
    }, [loadingMore, hasMore, buildParams]);

    useEffect(() => { loadLogs(); }, [loadLogs]);

    const handleExport = async () => {
        setIsExporting(true);
        try {
            const filters: Record<string, string> = {};
            if (roleFilter !== 'All') filters.role = roleFilter;
            if (statusFilter !== 'All') filters.status = statusFilter;
            await exportAdminData('audit-logs', filters);
        } catch (err: any) {
            CustomInAppToast.show({ type: 'error', title: 'Export Failed', message: err.message });
        } finally {
            setIsExporting(false);
        }
    };

    const getActionTheme = (action: string) => {
        const a = (action || '').toLowerCase();
        if (a.includes('verif') || a.includes('approv') || a.includes('complet'))
            return { color: '#10b981', bg: '#DCFCE7', icon: 'check-circle' };
        if (a.includes('reject') || a.includes('deactiv') || a.includes('ban') || a.includes('delet'))
            return { color: '#ef4444', bg: '#FEE2E2', icon: 'alert-circle' };
        if (a.includes('update') || a.includes('edit') || a.includes('change'))
            return { color: '#3b82f6', bg: '#DBEAFE', icon: 'edit' };
        return { color: '#6366f1', bg: '#EEF2FF', icon: 'info' };
    };

    const formatDate = (ts: string) => {
        try { return new Date(ts).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
        catch { return ts; }
    };

    const getActorName = (log: any) =>
        log.actor?.full_name || log.user?.full_name || log.user?.email || 'System';

    const getActorRole = (log: any): string =>
        (log.actor?.role || log.actor_role || '').toLowerCase();

    return (
        <View style={styles.container}>
            <StatusBar style="light" />

            <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
                <View style={styles.watermarkContainer}>
                    <AppImage source={require('../../assets/images/splash-icon.png')} style={styles.fadedLogo} />
                </View>
            </View>

            {/* Header */}
            <LinearGradient colors={['#0C1559', '#1e3a8a']} style={styles.header}>
                <SafeAreaView edges={['top', 'left', 'right']}>
                    <View style={styles.headerRow}>
                        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                            <Ionicons name="arrow-back" size={24} color="#FFF" />
                        </TouchableOpacity>
                        <View style={styles.headerTitleContainer}>
                            <Text style={styles.headerLabel}>SECURITY CENTER</Text>
                            <Text style={styles.headerTitle}>System Audit Logs</Text>
                        </View>
                        <TouchableOpacity style={styles.headerIconBtn} onPress={handleExport} disabled={isExporting}>
                            {isExporting
                                ? <ActivityIndicator size="small" color="#FFF" />
                                : <Feather name="download" size={22} color="#FFF" />}
                        </TouchableOpacity>
                    </View>

                    {/* Search */}
                    <View style={styles.searchContainer}>
                        <View style={styles.searchBar}>
                            <Feather name="search" size={18} color="#94A3B8" />
                            <TextInput
                                placeholder="Search action..."
                                style={styles.searchInput}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                onSubmitEditing={() => loadLogs()}
                                placeholderTextColor="#94A3B8"
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => setSearchQuery('')}>
                                    <Ionicons name="close-circle" size={18} color="#94A3B8" />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    {/* Role filter chips */}
                    <View style={styles.filterRow}>
                        {ROLE_FILTERS.map(r => (
                            <TouchableOpacity
                                key={r}
                                style={[styles.filterChip, roleFilter === r && styles.filterChipActive]}
                                onPress={() => setRoleFilter(r)}
                            >
                                <Text style={[styles.filterChipText, roleFilter === r && styles.filterChipTextActive]}>
                                    {r.charAt(0).toUpperCase() + r.slice(1)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Status filter chips */}
                    <View style={[styles.filterRow, { marginBottom: 6 }]}>
                        {STATUS_FILTERS.map(s => (
                            <TouchableOpacity
                                key={s}
                                style={[
                                    styles.filterChip,
                                    statusFilter === s && (s === 'failed' ? styles.filterChipFailed : styles.filterChipActive),
                                ]}
                                onPress={() => setStatusFilter(s)}
                            >
                                <Text style={[
                                    styles.filterChipText,
                                    statusFilter === s && styles.filterChipTextActive,
                                ]}>
                                    {s.charAt(0).toUpperCase() + s.slice(1)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </SafeAreaView>
            </LinearGradient>

            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" color="#0C1559" /></View>
            ) : (
                <FlatList
                    data={logs}
                    keyExtractor={(item, index) => item.id || index.toString()}
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadLogs(true)} tintColor="#0C1559" />}
                    onEndReached={loadMore}
                    onEndReachedThreshold={0.3}
                    ListFooterComponent={
                        loadingMore
                            ? <ActivityIndicator style={{ marginVertical: 16 }} color="#0C1559" />
                            : hasMore && logs.length >= PAGE_SIZE
                                ? <TouchableOpacity style={styles.loadMoreBtn} onPress={loadMore}>
                                    <Text style={styles.loadMoreText}>Load More</Text>
                                </TouchableOpacity>
                                : null
                    }
                    renderItem={({ item, index }) => {
                        const theme = getActionTheme(item.action);
                        const actorRole = getActorRole(item);
                        const roleStyle = ROLE_COLORS[actorRole] || { bg: '#E2E8F0', text: '#475569' };
                        const isFailed = item.status === 'failed';

                        return (
                            <View style={styles.logWrapper}>
                                <View style={styles.timelineContainer}>
                                    <View style={[styles.timelineDot, { backgroundColor: isFailed ? '#ef4444' : theme.color }]} />
                                    {index !== logs.length - 1 && <View style={styles.timelineLine} />}
                                </View>

                                <View style={styles.logCard}>
                                    <View style={styles.logCardHeader}>
                                        <View style={[styles.actionBadge, { backgroundColor: theme.bg }]}>
                                            <Feather name={theme.icon as any} size={12} color={theme.color} />
                                            <Text style={[styles.actionTag, { color: theme.color }]}>
                                                {(item.action || '').replaceAll('_', ' ').toUpperCase()}
                                            </Text>
                                        </View>
                                        {isFailed ? (
                                            <View style={styles.failedBadge}>
                                                <Text style={styles.failedBadgeText}>FAILED</Text>
                                            </View>
                                        ) : (
                                            <View style={styles.successBadge}>
                                                <Text style={styles.successBadgeText}>OK</Text>
                                            </View>
                                        )}
                                    </View>

                                    <Text style={styles.logTarget}>
                                        <Text style={styles.entityLabel}>Entity: </Text>
                                        {item.entity_type || 'Platform'}
                                        {item.entity_id ? ` · ${String(item.entity_id).slice(0, 8)}` : ''}
                                    </Text>

                                    {isFailed && item.failure_reason && (
                                        <View style={styles.failureBox}>
                                            <Text style={styles.failureText}>{item.failure_reason}</Text>
                                        </View>
                                    )}

                                    {item.metadata && Object.keys(item.metadata).length > 0 && (
                                        <View style={styles.metadataBox}>
                                            <Text style={styles.logNote} numberOfLines={2}>
                                                {Object.entries(item.metadata)
                                                    .filter(([, v]) => v !== null && v !== undefined && v !== '')
                                                    .map(([k, v]) => `${k}: ${v}`)
                                                    .join(' · ')}
                                            </Text>
                                        </View>
                                    )}

                                    <View style={styles.footerRow}>
                                        <View style={styles.actorContainer}>
                                            <View style={styles.actorAvatar}>
                                                <Text style={styles.actorInitial}>{getActorName(item).charAt(0).toUpperCase()}</Text>
                                            </View>
                                            <Text style={styles.adminName}>{getActorName(item)}</Text>
                                            {actorRole ? (
                                                <View style={[styles.roleBadge, { backgroundColor: roleStyle.bg }]}>
                                                    <Text style={[styles.roleText, { color: roleStyle.text }]}>{actorRole}</Text>
                                                </View>
                                            ) : null}
                                        </View>
                                        <Text style={styles.logDate}>{formatDate(item.timestamp || item.created_at)}</Text>
                                    </View>
                                </View>
                            </View>
                        );
                    }}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <MaterialCommunityIcons name="clipboard-text-search-outline" size={60} color="#CBD5E1" />
                            <Text style={styles.emptyTitle}>No Records Found</Text>
                            <Text style={styles.emptySubtitle}>Adjust your filters to find specific logs.</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    watermarkContainer: { position: 'absolute', bottom: -50, right: -50, opacity: 0.03 },
    fadedLogo: { width: 300, height: 300, resizeMode: 'contain' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    header: { paddingBottom: 14, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, elevation: 12 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10 },
    backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
    headerTitleContainer: { alignItems: 'center' },
    headerLabel: { color: '#A3E635', fontSize: 10, fontFamily: 'Montserrat-Bold', letterSpacing: 1.5 },
    headerTitle: { color: '#FFF', fontSize: 18, fontFamily: 'Montserrat-Bold' },
    headerIconBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },

    searchContainer: { paddingHorizontal: 20, marginTop: 14 },
    searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingHorizontal: 16, height: 46, borderRadius: 14, elevation: 3 },
    searchInput: { flex: 1, marginLeft: 10, fontFamily: 'Montserrat-Medium', color: '#0F172A', fontSize: 14 },

    filterRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, marginTop: 10, flexWrap: 'wrap' },
    filterChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)' },
    filterChipActive: { backgroundColor: '#A3E635' },
    filterChipFailed: { backgroundColor: '#ef4444' },
    filterChipText: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontFamily: 'Montserrat-SemiBold' },
    filterChipTextActive: { color: '#0C1559' },

    listContent: { padding: 16, paddingTop: 10, paddingBottom: 80 },

    logWrapper: { flexDirection: 'row', marginBottom: 16 },
    timelineContainer: { width: 26, alignItems: 'center' },
    timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 22, zIndex: 2, borderWidth: 2, borderColor: '#FFF' },
    timelineLine: { width: 2, flex: 1, backgroundColor: '#E2E8F0', marginTop: 4 },

    logCard: { flex: 1, backgroundColor: '#FFF', padding: 14, borderRadius: 20, elevation: 2, shadowColor: '#000', shadowOpacity: 0.03, borderWidth: 1, borderColor: '#F1F5F9' },
    logCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    actionBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, gap: 4, flex: 1, marginRight: 8 },
    actionTag: { fontSize: 9, fontFamily: 'Montserrat-Bold', flexShrink: 1 },

    failedBadge: { backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    failedBadgeText: { color: '#ef4444', fontSize: 9, fontFamily: 'Montserrat-Bold' },
    successBadge: { backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    successBadgeText: { color: '#15803D', fontSize: 9, fontFamily: 'Montserrat-Bold' },

    logTarget: { fontSize: 13, fontFamily: 'Montserrat-SemiBold', color: '#0F172A', marginBottom: 6 },
    entityLabel: { color: '#94A3B8', fontFamily: 'Montserrat-Medium' },

    failureBox: { backgroundColor: '#FEF2F2', padding: 10, borderRadius: 10, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: '#ef4444' },
    failureText: { fontSize: 11, color: '#ef4444', fontFamily: 'Montserrat-Medium', fontStyle: 'italic' },

    metadataBox: { backgroundColor: '#F8FAFC', padding: 10, borderRadius: 10, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: '#E2E8F0' },
    logNote: { fontSize: 11, color: '#64748B', fontFamily: 'Montserrat-Medium', lineHeight: 16 },

    footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 10 },
    actorContainer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    actorAvatar: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#0C1559', justifyContent: 'center', alignItems: 'center' },
    actorInitial: { color: '#FFF', fontSize: 10, fontFamily: 'Montserrat-Bold' },
    adminName: { fontSize: 11, color: '#0C1559', fontFamily: 'Montserrat-Bold' },
    roleBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
    roleText: { fontSize: 9, fontFamily: 'Montserrat-Bold', textTransform: 'uppercase' },
    logDate: { fontSize: 10, color: '#94A3B8', fontFamily: 'Montserrat-Medium' },

    loadMoreBtn: { alignSelf: 'center', paddingHorizontal: 24, paddingVertical: 10, backgroundColor: '#0C1559', borderRadius: 20, marginTop: 8 },
    loadMoreText: { color: '#FFF', fontFamily: 'Montserrat-SemiBold', fontSize: 13 },

    emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 80 },
    emptyTitle: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#334155', marginTop: 15 },
    emptySubtitle: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: '#94A3B8', marginTop: 5, textAlign: 'center' },
});
