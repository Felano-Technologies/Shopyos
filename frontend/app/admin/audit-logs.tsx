import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    TextInput, ActivityIndicator, RefreshControl,
} from 'react-native';
import AppImage from '@/components/AppImage';
import { SafeAreaView } from 'react-native-safe-area-context';
import AdminScreenSkeleton from '@/components/admin/AdminSkeleton';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getAdminAuditLogsFiltered } from '@/services/admin';
import { CustomInAppToast } from "@/components/InAppToastHost";
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { exportAdminData } from '@/utils/adminExport';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';

// Fixed dark navy/green admin header gradient (3-stop), intentionally not theme-tied — no matching token shape.
const DARK_GRADIENT = ['#01217B', '#0C2E8A', '#0E5E1A'] as const;

const ROLE_FILTERS = ['All', 'admin', 'seller', 'driver', 'buyer'];
const STATUS_FILTERS = ['All', 'success', 'failed'];
const PAGE_SIZE = 100;

// Fixed categorical role-badge colors (paired bg/text), intentionally not theme-tied — no bg tokens exist for these roles.
const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
    admin:  { bg: '#0C1559', text: '#FFFFFF' },
    seller: { bg: '#DBEAFE', text: '#1E40AF' },
    driver: { bg: '#FEF3C7', text: '#B45309' },
    buyer:  { bg: '#DCFCE7', text: '#15803D' },
};

export default function AdminAuditLogs() {
    const router = useRouter();
    const colors = useThemeColors();
    const styles = useMemo(() => getStyles(colors), [colors]);
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

    // Fixed categorical action-type colors (paired color/bg), intentionally not theme-tied — no success/info bg tokens exist.
    const getActionTheme = (action: string) => {
        const a = (action || '').toLowerCase();
        if (a.includes('verif') || a.includes('approv') || a.includes('complet'))
            return { color: '#10b981', bg: '#DCFCE7', icon: 'checkmark-circle-outline' as const };
        if (a.includes('reject') || a.includes('deactiv') || a.includes('ban') || a.includes('delet'))
            return { color: colors.error, bg: colors.errorBg, icon: 'alert-circle-outline' as const };
        if (a.includes('update') || a.includes('edit') || a.includes('change'))
            return { color: '#3b82f6', bg: '#DBEAFE', icon: 'create-outline' as const };
        return { color: '#6366f1', bg: '#EEF2FF', icon: 'information-circle-outline' as const };
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
            <LinearGradient colors={DARK_GRADIENT} end={{ x: 1, y: 1 }} style={styles.header}>
                <SafeAreaView edges={['top', 'left', 'right']}>
                    {/* Header row/icons sit on the fixed DARK_GRADIENT chrome above — intentionally fixed white, not theme-tied */}
                    <View style={styles.headerRow}>
                        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                            <Ionicons name="arrow-back" size={22} color="#FFF" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Audit Logs</Text>
                        <TouchableOpacity style={styles.headerIconBtn} onPress={handleExport} disabled={isExporting}>
                            {isExporting
                                ? <ActivityIndicator size="small" color="#FFF" />
                                : <Feather name="download" size={20} color="#FFF" />}
                        </TouchableOpacity>
                    </View>

                    {/* Search */}
                    <View style={styles.searchBar}>
                        <Feather name="search" size={16} color={colors.textMuted} />
                        <TextInput
                            placeholder="Search action..."
                            style={styles.searchInput}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            onSubmitEditing={() => loadLogs()}
                            placeholderTextColor={colors.textMuted}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                            </TouchableOpacity>
                        )}
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
                    <View style={[styles.filterRow, { marginBottom: 8 }]}>
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

            {/* Desktop canvas */}
            <View style={styles.desktopCanvas}>
                {loading && !refreshing ? (
                    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
                        <AdminScreenSkeleton metrics={4} rows={4} />
                    </SafeAreaView>
                ) : (
                    <FlatList
                        data={logs}
                        keyExtractor={(item, index) => item.id || index.toString()}
                        contentContainerStyle={styles.listContent}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadLogs(true)} tintColor={colors.primary} />}
                        onEndReached={loadMore}
                        onEndReachedThreshold={0.3}
                        ListFooterComponent={
                            loadingMore
                                ? <ActivityIndicator style={{ marginVertical: 16 }} color={colors.primary} />
                                : hasMore && logs.length >= PAGE_SIZE
                                    ? <TouchableOpacity style={styles.loadMoreBtn} onPress={loadMore}>
                                        <Text style={styles.loadMoreText}>Load more</Text>
                                    </TouchableOpacity>
                                    : null
                        }
                        renderItem={({ item }) => {
                            const theme = getActionTheme(item.action);
                            const actorRole = getActorRole(item);
                            const roleStyle = ROLE_COLORS[actorRole] || { bg: colors.border, text: colors.textSecondary };
                            const isFailed = item.status === 'failed';

                            return (
                                <View style={styles.logRow}>
                                    <View style={[styles.logIcon, { backgroundColor: theme.bg }]}>
                                        <Ionicons name={theme.icon} size={14} color={theme.color} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <Text style={styles.logActor}>{getActorName(item)}</Text>
                                            {actorRole ? (
                                                <View style={[styles.roleBadge, { backgroundColor: roleStyle.bg }]}>
                                                    <Text style={[styles.roleBadgeText, { color: roleStyle.text }]}>{actorRole}</Text>
                                                </View>
                                            ) : null}
                                        </View>
                                        <Text style={styles.logAction}>{item.action?.replace(/_/g, ' ')}</Text>
                                        {item.entity_type ? (
                                            <Text style={styles.logMeta}>
                                                {item.entity_type}{item.entity_id ? ` · ${String(item.entity_id).slice(0, 16)}` : ''}
                                            </Text>
                                        ) : null}
                                        {isFailed && item.failure_reason ? (
                                            <View style={styles.failureBox}>
                                                <Text style={styles.failureText}>{item.failure_reason}</Text>
                                            </View>
                                        ) : null}
                                        {item.metadata && Object.keys(item.metadata).length > 0 ? (
                                            <Text style={styles.logMeta} numberOfLines={1}>
                                                {Object.entries(item.metadata)
                                                    .filter(([, v]) => v !== null && v !== undefined && v !== '')
                                                    .map(([k, v]) => `${k}: ${v}`)
                                                    .join(' · ')}
                                            </Text>
                                        ) : null}
                                    </View>
                                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                                        <View style={[styles.statusDot, { backgroundColor: isFailed ? colors.error : colors.success }]} />
                                        <Text style={styles.logTime}>{formatDate(item.timestamp || item.created_at)}</Text>
                                    </View>
                                </View>
                            );
                        }}
                        ListEmptyComponent={
                            <View style={styles.emptyState}>
                                <MaterialCommunityIcons name="clipboard-text-search-outline" size={60} color={colors.textMuted} />
                                <Text style={styles.emptyTitle}>No Records Found</Text>
                                <Text style={styles.emptySubtitle}>Adjust your filters to find specific logs.</Text>
                            </View>
                        }
                    />
                )}
            </View>
        </View>
    );
}

const getStyles = (c: ThemeColors) => StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    watermarkContainer: { position: 'absolute', bottom: -50, right: -50, opacity: 0.03 },
    fadedLogo: { width: 300, height: 300, resizeMode: 'contain' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    desktopCanvas: { maxWidth: 1200, alignSelf: 'center', width: '100%', flex: 1 },

    // Header (sits on the fixed DARK_GRADIENT chrome — colors below are intentionally fixed, not theme-tied)
    header: { paddingBottom: 4, elevation: 8 },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        gap: 10,
    },
    backBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: 'rgba(255,255,255,0.18)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        flex: 1,
        color: '#FFFFFF',
        fontSize: 17,
        fontFamily: 'Montserrat-Bold',
    },
    headerIconBtn: { width: 34, height: 34, justifyContent: 'center', alignItems: 'center' },

    // Search bar (a content card resting on the header, so it follows the theme)
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: c.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: c.borderStrong,
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 8,
        marginHorizontal: 12,
        marginBottom: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        fontFamily: 'Montserrat-Regular',
        color: c.text,
    },

    // Filter chips (rest on the fixed header chrome, intentionally fixed white/translucent)
    filterRow: {
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap',
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    filterChip: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.18)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.25)',
    },
    filterChipActive: {
        backgroundColor: '#FFFFFF',
        borderColor: '#FFFFFF',
    },
    filterChipFailed: {
        backgroundColor: c.errorBg,
        borderColor: c.errorBg,
    },
    filterChipText: {
        fontSize: 12,
        fontFamily: 'Montserrat-SemiBold',
        color: 'rgba(255,255,255,0.85)',
    },
    filterChipTextActive: {
        color: c.primary,
    },

    listContent: { padding: 12, paddingBottom: 40 },

    // Log row
    logRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: 10,
        gap: 10,
        borderBottomWidth: 1,
        borderBottomColor: c.border,
    },
    logIcon: {
        width: 32,
        height: 32,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    logActor: {
        color: c.text,
        fontSize: 13,
        fontFamily: 'Montserrat-SemiBold',
    },
    logAction: {
        color: c.textSecondary,
        fontSize: 12,
        fontFamily: 'Montserrat-Regular',
        textTransform: 'capitalize',
        marginTop: 2,
    },
    logMeta: {
        color: c.textMuted,
        fontSize: 11,
        fontFamily: 'Montserrat-Regular',
        marginTop: 2,
    },
    logTime: {
        color: c.textMuted,
        fontSize: 11,
        fontFamily: 'Montserrat-Regular',
    },
    roleBadge: {
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 10,
    },
    roleBadgeText: {
        fontSize: 10,
        fontFamily: 'Montserrat-SemiBold',
        textTransform: 'capitalize',
    },
    statusDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
    },

    failureBox: {
        backgroundColor: c.errorBg,
        padding: 8,
        borderRadius: 8,
        marginTop: 4,
        borderLeftWidth: 3,
        borderLeftColor: c.error,
    },
    failureText: {
        fontSize: 11,
        color: c.error,
        fontFamily: 'Montserrat-Regular',
        fontStyle: 'italic',
    },

    // Load more
    loadMoreBtn: {
        margin: 12,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.borderStrong,
        alignItems: 'center',
    },
    loadMoreText: {
        color: c.primary,
        fontSize: 14,
        fontFamily: 'Montserrat-SemiBold',
    },

    // Empty
    emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 80 },
    emptyTitle: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: c.text, marginTop: 15 },
    emptySubtitle: { fontSize: 13, fontFamily: 'Montserrat-Regular', color: c.textMuted, marginTop: 5, textAlign: 'center' },
});
