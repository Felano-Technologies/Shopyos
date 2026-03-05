import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    TextInput, ActivityIndicator, RefreshControl, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getAdminAuditLogs } from '@/services/api';
import Toast from 'react-native-toast-message';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';

export default function AdminAuditLogs() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    const loadLogs = useCallback(async (isRefresh = false) => {
        try {
            isRefresh ? setRefreshing(true) : setLoading(true);
            const res = await getAdminAuditLogs({ limit: 100 });
            const data = Array.isArray(res?.logs) ? res.logs : (Array.isArray(res) ? res : []);
            setLogs(data);
        } catch (err: any) {
            Toast.show({ type: 'error', text1: 'Error', text2: err.message || 'Failed to load logs' });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { loadLogs(); }, [loadLogs]);

    const filteredLogs = logs.filter(log =>
        !searchQuery.trim() ||
        (log.action || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.entity_type || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.user?.full_name || log.user?.email || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getActionTheme = (action: string) => {
        const a = (action || '').toLowerCase();
        if (a.includes('verif') || a.includes('approv') || a.includes('complet')) 
            return { color: '#10b981', bg: '#DCFCE7', icon: 'check-circle' };
        if (a.includes('reject') || a.includes('deactiv') || a.includes('ban') || a.includes('suspend') || a.includes('delet')) 
            return { color: '#ef4444', bg: '#FEE2E2', icon: 'alert-circle' };
        if (a.includes('update') || a.includes('edit') || a.includes('change')) 
            return { color: '#3b82f6', bg: '#DBEAFE', icon: 'edit' };
        return { color: '#6366f1', bg: '#EEF2FF', icon: 'info' };
    };

    const formatDate = (ts: string) => {
        try { return new Date(ts).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
        catch { return ts; }
    };

    const getActorName = (log: any) => {
        return log.user?.full_name || log.user?.email || 'System';
    };

    const handleExport = () => {
        setIsExporting(true);
        // Simulation of export logic
        setTimeout(() => {
            setIsExporting(false);
            Toast.show({ type: 'success', text1: 'Export Ready', text2: 'Log report has been generated.' });
        }, 1500);
    };

    return (
        <View style={styles.container}>
            <StatusBar style="light" />

            {/* --- BACKGROUND WATERMARK --- */}
            <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
                <View style={styles.watermarkContainer}>
                    <Image source={require('../../assets/images/splash-icon.png')} style={styles.fadedLogo} />
                </View>
            </View>

            {/* --- HEADER --- */}
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
                            {isExporting ? <ActivityIndicator size="small" color="#FFF" /> : <Feather name="download" size={22} color="#FFF" />}
                        </TouchableOpacity>
                    </View>

                    {/* Floating Search Bar */}
                    <View style={styles.searchContainer}>
                        <View style={styles.searchBar}>
                            <Feather name="search" size={18} color="#94A3B8" />
                            <TextInput
                                placeholder="Search action, entity or user..."
                                style={styles.searchInput}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                placeholderTextColor="#94A3B8"
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => setSearchQuery('')}>
                                    <Ionicons name="close-circle" size={18} color="#94A3B8" />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </SafeAreaView>
            </LinearGradient>

            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" color="#0C1559" /></View>
            ) : (
                <FlatList
                    data={filteredLogs}
                    keyExtractor={(item, index) => item.id || index.toString()}
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadLogs(true)} tintColor="#0C1559" />}
                    renderItem={({ item, index }) => {
                        const theme = getActionTheme(item.action);
                        return (
                            <View style={styles.logWrapper}>
                                {/* Timeline Graphics */}
                                <View style={styles.timelineContainer}>
                                    <View style={[styles.timelineDot, { backgroundColor: theme.color }]} />
                                    {index !== filteredLogs.length - 1 && <View style={styles.timelineLine} />}
                                </View>

                                <View style={styles.logCard}>
                                    <View style={styles.logCardHeader}>
                                        <View style={[styles.actionBadge, { backgroundColor: theme.bg }]}>
                                            <Feather name={theme.icon as any} size={12} color={theme.color} />
                                            <Text style={[styles.actionTag, { color: theme.color }]}>
                                                {(item.action || '').replace(/_/g, ' ').toUpperCase()}
                                            </Text>
                                        </View>
                                        <Text style={styles.logDate}>{formatDate(item.timestamp || item.created_at)}</Text>
                                    </View>

                                    <Text style={styles.logTarget}>
                                        <Text style={styles.entityLabel}>Entity: </Text>
                                        {item.entity_type || 'Platform'}
                                    </Text>

                                    {item.metadata && (
                                        <View style={styles.metadataBox}>
                                            <Text style={styles.logNote} numberOfLines={2}>
                                                {Object.entries(item.metadata).map(([k, v]) => `${k}: ${v}`).join(' • ')}
                                            </Text>
                                        </View>
                                    )}

                                    <View style={styles.footerRow}>
                                        <View style={styles.actorContainer}>
                                            <View style={styles.actorAvatar}>
                                                <Text style={styles.actorInitial}>{getActorName(item).charAt(0).toUpperCase()}</Text>
                                            </View>
                                            <Text style={styles.adminName}>By {getActorName(item)}</Text>
                                        </View>
                                        <TouchableOpacity style={styles.detailBtn}>
                                            <Feather name="more-horizontal" size={16} color="#94A3B8" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        );
                    }}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <MaterialCommunityIcons name="clipboard-text-search-outline" size={60} color="#CBD5E1" />
                            <Text style={styles.emptyTitle}>No Records Found</Text>
                            <Text style={styles.emptySubtitle}>Adjust your search to find specific logs.</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    watermarkContainer: { position: 'absolute', bottom: -50, right: -50, opacity: 0.04 },
    fadedLogo: { width: 300, height: 300, resizeMode: 'contain' },
    
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    header: { paddingBottom: 35, borderBottomLeftRadius: 35, borderBottomRightRadius: 35, elevation: 12 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10 },
    backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
    headerTitleContainer: { alignItems: 'center' },
    headerLabel: { color: '#A3E635', fontSize: 10, fontFamily: 'Montserrat-Bold', letterSpacing: 1.5 },
    headerTitle: { color: '#FFF', fontSize: 18, fontFamily: 'Montserrat-Bold' },
    headerIconBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },

    searchContainer: { paddingHorizontal: 20, marginTop: 25 },
    searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingHorizontal: 15, height: 52, borderRadius: 16, elevation: 5, shadowColor: '#0C1559', shadowOpacity: 0.1, shadowRadius: 10 },
    searchInput: { flex: 1, marginLeft: 10, fontFamily: 'Montserrat-Medium', color: '#0F172A', fontSize: 14 },

    listContent: { padding: 20, paddingTop: 10, paddingBottom: 60 },
    
    logWrapper: { flexDirection: 'row' },
    timelineContainer: { width: 30, alignItems: 'center' },
    timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 25, zIndex: 2, borderWidth: 2, borderColor: '#FFF' },
    timelineLine: { width: 2, flex: 1, backgroundColor: '#E2E8F0', marginVertical: -10 },

    logCard: { flex: 1, backgroundColor: '#FFF', padding: 18, borderRadius: 24, marginBottom: 20, elevation: 2, shadowColor: '#000', shadowOpacity: 0.03, borderWidth: 1, borderColor: '#F1F5F9' },
    logCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    actionBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, gap: 5 },
    actionTag: { fontSize: 9, fontFamily: 'Montserrat-Bold' },
    logDate: { fontSize: 11, color: '#94A3B8', fontFamily: 'Montserrat-Medium' },

    logTarget: { fontSize: 15, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginBottom: 8 },
    entityLabel: { color: '#94A3B8', fontSize: 13, fontFamily: 'Montserrat-Medium' },

    metadataBox: { backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12, marginBottom: 15, borderLeftWidth: 3, borderLeftColor: '#E2E8F0' },
    logNote: { fontSize: 12, color: '#64748B', fontFamily: 'Montserrat-Medium', lineHeight: 18 },

    footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 12 },
    actorContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    actorAvatar: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#0C1559', justifyContent: 'center', alignItems: 'center' },
    actorInitial: { color: '#FFF', fontSize: 10, fontFamily: 'Montserrat-Bold' },
    adminName: { fontSize: 11, color: '#0C1559', fontFamily: 'Montserrat-Bold' },
    detailBtn: { padding: 5 },

    emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 80 },
    emptyTitle: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#334155', marginTop: 15 },
    emptySubtitle: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: '#94A3B8', marginTop: 5, textAlign: 'center' }
});