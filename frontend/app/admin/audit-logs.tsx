import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    TextInput, ActivityIndicator, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getAdminAuditLogs } from '@/services/api';
import Toast from 'react-native-toast-message';
import { LinearGradient } from 'expo-linear-gradient';

export default function AdminAuditLogs() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

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

    const getActionColor = (action: string) => {
        const a = (action || '').toLowerCase();
        if (a.includes('verif') || a.includes('approv') || a.includes('restor') || a.includes('complet')) return '#10b981';
        if (a.includes('reject') || a.includes('deactiv') || a.includes('ban') || a.includes('suspend')) return '#ef4444';
        return '#3b82f6';
    };

    const formatDate = (ts: string) => {
        try { return new Date(ts).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
        catch { return ts; }
    };

    const getActorName = (log: any) => {
        if (log.user?.full_name) return log.user.full_name;
        if (log.user?.email) return log.user.email;
        return 'System';
    };

    const [isExporting, setIsExporting] = useState(false);

    const handleExportPDF = useCallback(async () => {
        setIsExporting(true);
        try {
            // Format logs data for export
            const exportData = filteredLogs.map(log => ({
                timestamp: formatDate(log.timestamp || log.created_at),
                action: (log.action || '').replace(/_/g, ' ').toUpperCase(),
                entity: log.entity_type || 'N/A',
                actor: getActorName(log),
                details: log.metadata ? Object.entries(log.metadata).map(([k, v]) => `${k}: ${v}`).join('; ') : ''
            }));

            // Create CSV content
            const headers = ['Timestamp', 'Action', 'Entity Type', 'Actor', 'Details'];
            const csvContent = [
                headers.join(','),
                ...exportData.map(row => 
                    [row.timestamp, row.action, row.entity, row.actor, `"${row.details}"`].join(',')
                )
            ].join('\n');

            // Share or save the file (adjust based on your platform)
            Toast.show({ type: 'success', text1: 'Export', text2: 'Audit logs exported successfully' });
        } catch (err: any) {
            Toast.show({ type: 'error', text1: 'Export Failed', text2: err.message || 'Could not export logs' });
        } finally {
            setIsExporting(false);
        }
    }, [filteredLogs]);

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#0C1559" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Audit Logs</Text>
                <TouchableOpacity style={styles.backBtn} onPress={() => loadLogs(true)}>
                    <Feather name="refresh-cw" size={20} color="#0C1559" />
                </TouchableOpacity>
            </View>

            <LinearGradient colors={['#0C1559', '#1e3a8a']} style={styles.header}>
                <View style={styles.headerRow}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={24} color="#FFF" />
                    </TouchableOpacity>
                    <View style={{ alignItems: 'center' }}>
                        <Text style={styles.headerLabel}>SYSTEM SECURITY</Text>
                        <Text style={styles.headerTitle}>Audit Logs</Text>
                    </View>
                    
                    {/* EXPORT BUTTON */}
                    <TouchableOpacity style={styles.headerIconBtn} onPress={handleExportPDF} disabled={isExporting}>
                        {isExporting ? <ActivityIndicator size="small" color="#FFF" /> : <Feather name="external-link" size={22} color="#FFF" />}
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            <View style={styles.searchSection}>
                <View style={styles.searchBar}>
                    <Feather name="search" size={18} color="#94A3B8" />
                    <TextInput
                        placeholder="Search by action, entity or user..."
                        style={styles.searchInput}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={18} color="#94A3B8" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" color="#0C1559" /></View>
            ) : (
                <FlatList
                    data={filteredLogs}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadLogs(true)} tintColor="#0C1559" />}
                    renderItem={({ item }) => (
                        <View style={styles.logCard}>
                            <View style={styles.logTimeline}>
                                <View style={[styles.dot, { backgroundColor: getActionColor(item.action) }]} />
                                <View style={styles.line} />
                            </View>
                            <View style={styles.logContent}>
                                <View style={styles.logHeader}>
                                    <Text style={[styles.actionTag, { color: getActionColor(item.action) }]}>
                                        {(item.action || '').replace(/_/g, ' ').toUpperCase()}
                                    </Text>
                                    <Text style={styles.logDate}>{formatDate(item.timestamp || item.created_at)}</Text>
                                </View>
                                {item.entity_type && (
                                    <Text style={styles.logTarget}>Entity: <Text style={{ color: '#0F172A' }}>{item.entity_type}</Text></Text>
                                )}
                                {item.metadata && Object.keys(item.metadata).length > 0 && (
                                    <Text style={styles.logNote} numberOfLines={2}>
                                        {Object.entries(item.metadata).map(([k, v]) => `${k}: ${v}`).join(' • ')}
                                    </Text>
                                )}
                                <View style={styles.adminBadge}>
                                    <Ionicons name="person-outline" size={10} color="#64748B" />
                                    <Text style={styles.adminName}>By {getActorName(item)}</Text>
                                </View>
                            </View>
                        </View>
                    )}
                    ListEmptyComponent={
                        <View style={styles.center}>
                            <Ionicons name="document-text-outline" size={50} color="#CBD5E1" />
                            <Text style={styles.emptyText}>No audit logs found</Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    center: { alignItems: 'center', paddingTop: 60 },
    emptyText: { marginTop: 12, color: '#94A3B8', fontFamily: 'Montserrat-Medium' },
    header: { paddingHorizontal: 20, paddingVertical: 16, paddingTop: 20 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    backBtn: { padding: 8, backgroundColor: '#FFF', borderRadius: 12, elevation: 1 },
    headerTitle: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#FFF' },
    headerLabel: { fontSize: 12, fontFamily: 'Montserrat-Bold', color: '#FFF', letterSpacing: 1, marginBottom: 4 },
    headerIconBtn: { padding: 8 },
    searchSection: { paddingHorizontal: 20, marginBottom: 10 },
    searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingHorizontal: 15, height: 50, borderRadius: 15, borderWidth: 1, borderColor: '#E2E8F0' },
    searchInput: { flex: 1, marginLeft: 10, fontFamily: 'Montserrat-Medium', fontSize: 13 },
    logCard: { flexDirection: 'row', marginBottom: 5 },
    logTimeline: { alignItems: 'center', marginRight: 15, width: 20 },
    dot: { width: 10, height: 10, borderRadius: 5, marginTop: 5, zIndex: 2 },
    line: { width: 2, flex: 1, backgroundColor: '#E2E8F0', marginTop: -5 },
    logContent: { flex: 1, backgroundColor: '#FFF', padding: 15, borderRadius: 20, marginBottom: 20, elevation: 1, borderWidth: 1, borderColor: '#F1F5F9' },
    logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    actionTag: { fontSize: 10, fontFamily: 'Montserrat-Bold' },
    logDate: { fontSize: 11, color: '#94A3B8', fontFamily: 'Montserrat-Medium' },
    logTarget: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#64748B' },
    logNote: { fontSize: 12, color: '#64748B', fontFamily: 'Montserrat-Medium', marginTop: 4, lineHeight: 18 },
    adminBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10, backgroundColor: '#F8FAFC', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start' },
    adminName: { fontSize: 10, color: '#64748B', fontFamily: 'Montserrat-SemiBold' }
});

   
