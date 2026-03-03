import React, { useState } from 'react';
import { 
    View, 
    Text, 
    StyleSheet, 
    FlatList, 
    TouchableOpacity, 
    TextInput 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';

export default function AdminAuditLogs() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');

    // Mock Audit Data
    const logs = [
        { id: '1', action: 'VERIFIED', target: 'Electronics Hub', admin: 'Admin_Williams', date: new Date(), notes: 'All documents valid.' },
        { id: '2', action: 'DEACTIVATED', target: 'Urban Fashion', admin: 'Admin_Williams', date: new Date(Date.now() - 3600000), notes: 'Prohibited items listed.' },
        { id: '3', action: 'PAYOUT_APPROVED', target: 'Fresh Grocery', admin: 'System', date: new Date(Date.now() - 86400000), notes: '₵450.00 processed.' },
        { id: '4', action: 'RESTORED', target: 'Gadget World', admin: 'Admin_Williams', date: new Date(Date.now() - 172800000), notes: 'Re-verified after policy update.' },
    ];

    const filteredLogs = logs.filter(log => 
        log.target.toLowerCase().includes(searchQuery.toLowerCase()) || 
        log.action.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getActionColor = (action: string) => {
        if (action.includes('VERIFIED') || action.includes('RESTORED') || action.includes('APPROVED')) return '#10b981';
        if (action.includes('DEACTIVATED')) return '#ef4444';
        return '#3b82f6';
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#0C1559" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Audit Logs</Text>
                <TouchableOpacity><Feather name="filter" size={20} color="#0C1559" /></TouchableOpacity>
            </View>

            <View style={styles.searchSection}>
                <View style={styles.searchBar}>
                    <Feather name="search" size={18} color="#94A3B8" />
                    <TextInput 
                        placeholder="Search logs by store or action..." 
                        style={styles.searchInput}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>
            </View>

            <FlatList
                data={filteredLogs}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: 20 }}
                renderItem={({ item }) => (
                    <View style={styles.logCard}>
                        <View style={styles.logTimeline}>
                            <View style={[styles.dot, { backgroundColor: getActionColor(item.action) }]} />
                            <View style={styles.line} />
                        </View>
                        
                        <View style={styles.logContent}>
                            <View style={styles.logHeader}>
                                <Text style={[styles.actionTag, { color: getActionColor(item.action) }]}>
                                    {item.action}
                                </Text>
                                <Text style={styles.logDate}>{format(item.date, 'MMM dd, HH:mm')}</Text>
                            </View>
                            
                            <Text style={styles.logTarget}>Target: <Text style={{ color: '#0F172A' }}>{item.target}</Text></Text>
                            <Text style={styles.logNote}>{item.notes}</Text>
                            
                            <View style={styles.adminBadge}>
                                <Ionicons name="person-outline" size={10} color="#64748B" />
                                <Text style={styles.adminName}>By {item.admin}</Text>
                            </View>
                        </View>
                    </View>
                )}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center' },
    backBtn: { padding: 8, backgroundColor: '#FFF', borderRadius: 12, elevation: 1 },
    headerTitle: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
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