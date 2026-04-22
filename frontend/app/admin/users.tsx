import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    TextInput, ActivityIndicator, Alert, RefreshControl, Dimensions, KeyboardAvoidingView, Platform
} from 'react-native';
import {  useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { CustomInAppToast } from "@/components/InAppToastHost";
import { getAdminUsers, adminUpdateUserStatus } from '@/services/api';
const ROLE_FILTERS = ['All', 'buyer', 'seller', 'driver', 'admin'];
const STATUS_CONFIG: Record<string, { color: string; bg: string; dot: string }> = {
    active:    { color: '#059669', bg: '#D1FAE5', dot: '#10B981' },
    suspended: { color: '#B45309', bg: '#FEF3C7', dot: '#F59E0B' },
    banned:    { color: '#B91C1C', bg: '#FEE2E2', dot: '#EF4444' },
};
const ROLE_CONFIG: Record<string, { color: string; bg: string }> = {
    buyer:  { color: '#3B82F6', bg: '#EFF6FF' },
    seller: { color: '#7C3AED', bg: '#F5F3FF' },
    driver: { color: '#0C1559', bg: '#EEF2FF' },
    admin:  { color: '#BE185D', bg: '#FDF2F8' },
};
export default function AdminUsers() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('All');
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const loadUsers = useCallback(async (isRefresh = false) => {
        try {
            if (isRefresh) setRefreshing(true);
            else setLoading(true);
            const params: Record<string, string> = {};
            if (roleFilter !== 'All') params.role = roleFilter;
            if (searchQuery.trim()) params.search = searchQuery.trim();
            
            const res = await getAdminUsers(params);
            const data = Array.isArray(res?.users) ? res.users : (Array.isArray(res) ? res : []);
            setUsers(data);
        } catch (err: any) {
            CustomInAppToast.show({ type: 'error', title: 'Error', message: err.message || 'Failed to load users' });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [roleFilter, searchQuery]);
    useEffect(() => { loadUsers(); }, [loadUsers]);
    const handleStatusChange = (user: any) => {
        const isActive = (user.account_status || 'active') === 'active';
        
        Alert.alert(
            isActive ? 'Suspend Account' : 'Reactivate Account',
            isActive
                ? `Are you sure you want to suspend ${user.full_name || user.email}? They will lose access to the platform.`
                : `Are you sure you want to reactivate ${user.full_name || user.email}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: isActive ? 'Suspend' : 'Reactivate',
                    style: isActive ? 'destructive' : 'default',
                    onPress: async () => {
                        try {
                            setActionLoading(user.id);
                            await adminUpdateUserStatus(user.id, isActive ? 'suspended' : 'active');
                            CustomInAppToast.show({ 
                              type: 'success', 
                              title: isActive ? 'User Suspended' : 'User Reactivated',
                              message: `Account status updated successfully.`
                            });
                            loadUsers();
                        } catch (e: any) {
                            CustomInAppToast.show({ type: 'error', title: 'Action Failed', message: e.message });
                        } finally {
                            setActionLoading(null);
                        }
                    }
                }
            ]
        );
    };
    const getInitials = (name?: string, email?: string) => {
        if (name) return name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
        return (email || '?')[0].toUpperCase();
    };
    const UserCard = ({ item }: { item: any }) => {
        const status = item.account_status || 'active';
        const role = item.role || 'buyer';
        
        const sc = STATUS_CONFIG[status] || STATUS_CONFIG.active;
        const rc = ROLE_CONFIG[role] || ROLE_CONFIG.buyer;
        const isActive = status === 'active';
        return (
            <View style={styles.userCard}>
                <View style={styles.cardHeader}>
                    <View style={styles.avatarWrap}>
                        <View style={styles.userAvatar}>
                            <Text style={styles.avatarTxt}>{getInitials(item.full_name, item.email)}</Text>
                        </View>
                        <View style={[styles.statusDot, { backgroundColor: sc.dot }]} />
                    </View>
                    
                    <View style={styles.userInfo}>
                        <Text style={styles.userName} numberOfLines={1}>{item.full_name || 'Unnamed User'}</Text>
                        <Text style={styles.userEmail} numberOfLines={1}>{item.email || item.phone || 'No contact info'}</Text>
                        
                        <View style={styles.badgeRow}>
                            <View style={[styles.badge, { backgroundColor: rc.bg }]}>
                                <Text style={[styles.badgeText, { color: rc.color }]}>{role}</Text>
                            </View>
                            <View style={[styles.badge, { backgroundColor: sc.bg }]}>
                                <Text style={[styles.badgeText, { color: sc.color }]}>{status}</Text>
                            </View>
                        </View>
                    </View>
                </View>
                <View style={styles.cardFooter}>
                    <Text style={styles.dateText}>Joined: {new Date(item.created_at || Date.now()).toLocaleDateString()}</Text>
                    
                    <TouchableOpacity 
                        style={[styles.actionBtn, isActive ? styles.btnSuspend : styles.btnActivate]}
                        onPress={() => handleStatusChange(item)}
                        disabled={actionLoading === item.id}
                    >
                        {actionLoading === item.id ? (
                            <ActivityIndicator size="small" color={isActive ? '#DC2626' : '#059669'} />
                        ) : (
                            <>
                                <Feather name={isActive ? 'slash' : 'check-circle'} size={14} color={isActive ? '#DC2626' : '#059669'} />
                                <Text style={[styles.actionBtnText, { color: isActive ? '#DC2626' : '#059669' }]}>
                                    {isActive ? 'Suspend' : 'Activate'}
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        );
    };
    return (
        <View style={styles.container}>
            <StatusBar style="light" />
            {/* --- Premium Header --- */}
            <LinearGradient colors={['#0C1559', '#1e3a8a']} style={[styles.header, { paddingTop: insets.top + 10 }]}>
                <View style={styles.headerRow}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="chevron-back" size={26} color="#FFF" />
                    </TouchableOpacity>
                    <View style={styles.headerTextWrap}>
                        <Text style={styles.headerLabel}>ADMINISTRATION</Text>
                        <Text style={styles.headerTitle}>User Management</Text>
                    </View>
                    <TouchableOpacity onPress={() => loadUsers(true)} style={styles.refreshBtn}>
                        <Ionicons name="refresh" size={22} color="#FFF" />
                    </TouchableOpacity>
                </View>
            </LinearGradient>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                
                {/* --- Search & Filters --- */}
                <View style={styles.controlsSection}>
                    <View style={styles.searchBar}>
                        <Feather name="search" size={18} color="#94A3B8" />
                        <TextInput
                            placeholder="Search users by name or email..."
                            placeholderTextColor="#94A3B8"
                            style={styles.searchInput}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            onSubmitEditing={() => loadUsers()}
                            returnKeyType="search"
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => { setSearchQuery(''); loadUsers(); }}>
                                <Ionicons name="close-circle" size={18} color="#94A3B8" />
                            </TouchableOpacity>
                        )}
                    </View>
                    <FlatList
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        data={ROLE_FILTERS}
                        keyExtractor={i => i}
                        contentContainerStyle={styles.filterList}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={[styles.filterChip, roleFilter === item && styles.filterChipActive]}
                                onPress={() => setRoleFilter(item)}
                            >
                                <Text style={[styles.filterText, roleFilter === item && styles.filterTextActive]}>
                                    {item.charAt(0).toUpperCase() + item.slice(1)}
                                </Text>
                            </TouchableOpacity>
                        )}
                    />
                </View>
                {/* --- User List --- */}
                {loading ? (
                    <View style={styles.center}><ActivityIndicator size="large" color="#0C1559" /></View>
                ) : (
                    <FlatList
                        data={users}
                        keyExtractor={(item, index) => item.id || index.toString()}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadUsers(true)} tintColor="#0C1559" />}
                        renderItem={({ item }) => <UserCard item={item} />}
                        ListEmptyComponent={
                            <View style={styles.emptyState}>
                                <View style={styles.emptyIconCircle}>
                                    <Ionicons name="people-outline" size={40} color="#94A3B8" />
                                </View>
                                <Text style={styles.emptyTitle}>No Users Found</Text>
                                <Text style={styles.emptySubtitle}>Adjust your search or filter criteria.</Text>
                            </View>
                        }
                    />
                )}
            </KeyboardAvoidingView>
        </View>
    );
}
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    
    // Header
    header: { paddingBottom: 25, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, elevation: 10, zIndex: 10 },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
    backBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12 },
    refreshBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12 },
    headerTextWrap: { alignItems: 'center', flex: 1 },
    headerLabel: { color: '#A3E635', fontSize: 10, fontFamily: 'Montserrat-Bold', letterSpacing: 2, marginBottom: 2 },
    headerTitle: { color: '#FFF', fontSize: 18, fontFamily: 'Montserrat-Bold' },
    // Controls (Search/Filter)
    controlsSection: { paddingTop: 20, zIndex: 5 },
    searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingHorizontal: 15, marginHorizontal: 20, height: 50, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 5, elevation: 2 },
    searchInput: { flex: 1, marginLeft: 10, fontFamily: 'Montserrat-Medium', fontSize: 14, color: '#0F172A' },
    
    filterList: { paddingHorizontal: 20, paddingTop: 15, paddingBottom: 5, gap: 10 },
    filterChip: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0' },
    filterChipActive: { backgroundColor: '#0C1559', borderColor: '#0C1559' },
    filterText: { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: '#64748B' },
    filterTextActive: { color: '#FFF' },
    // List & Cards
    listContent: { padding: 20, paddingBottom: 80 },
    userCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 16, marginBottom: 15, borderWidth: 1, borderColor: '#F1F5F9', elevation: 2, shadowColor: '#0C1559', shadowOpacity: 0.04, shadowRadius: 8 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
    
    avatarWrap: { position: 'relative', marginRight: 15 },
    userAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFF' },
    avatarTxt: { color: '#0C1559', fontFamily: 'Montserrat-Bold', fontSize: 16 },
    statusDot: { width: 12, height: 12, borderRadius: 6, position: 'absolute', bottom: 0, right: 0, borderWidth: 2, borderColor: '#FFF' },
    
    userInfo: { flex: 1 },
    userName: { fontFamily: 'Montserrat-Bold', color: '#0F172A', fontSize: 15, marginBottom: 2 },
    userEmail: { fontSize: 12, color: '#64748B', fontFamily: 'Montserrat-Medium', marginBottom: 8 },
    
    badgeRow: { flexDirection: 'row', gap: 8 },
    badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    badgeText: { fontSize: 10, fontFamily: 'Montserrat-Bold', textTransform: 'uppercase' },
    
    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 15, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
    dateText: { fontSize: 11, fontFamily: 'Montserrat-Medium', color: '#94A3B8' },
    
    // Action Buttons
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
    btnSuspend: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
    btnActivate: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
    actionBtnText: { fontSize: 12, fontFamily: 'Montserrat-Bold' },
    // Empty State
    emptyState: { alignItems: 'center', marginTop: 50 },
    emptyIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
    emptyTitle: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginBottom: 5 },
    emptySubtitle: { fontSize: 13, color: '#94A3B8', fontFamily: 'Montserrat-Medium', textAlign: 'center' },
});