import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    TextInput, ActivityIndicator, Alert, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { CustomInAppToast } from "@/components/InAppToastHost";
import { getAdminUsers, adminUpdateUserStatus } from '@/services/api';

const ROLE_FILTERS = ['All', 'buyer', 'seller', 'driver', 'admin'];

const STATUS_CONFIG: Record<string, { color: string; bg: string }> = {
    active:    { color: '#065F46', bg: '#D1FAE5' },
    suspended: { color: '#92400E', bg: '#FEF3C7' },
    banned:    { color: '#991B1B', bg: '#FEE2E2' },
};

export default function AdminUsers() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('All');
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadUsers = useCallback(async (isRefresh = false) => {
        try {
            isRefresh ? setRefreshing(true) : setLoading(true);
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
            isActive ? 'Suspend User' : 'Reactivate User',
            isActive
                ? `Suspend ${user.full_name || user.email}?`
                : `Reactivate ${user.full_name || user.email}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: isActive ? 'Suspend' : 'Reactivate',
                    style: isActive ? 'destructive' : 'default',
                    onPress: async () => {
                        try {
                            await adminUpdateUserStatus(user.id, isActive ? 'suspended' : 'active');
                            CustomInAppToast.show({ 
                              type: 'success', 
                              title: isActive ? 'User Suspended' : 'User Reactivated',
                              message: `User status has been updated successfully.`
                            });
                            loadUsers();
                        } catch (e: any) {
                            CustomInAppToast.show({ type: 'error', title: 'Error', message: e.message });
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

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#0C1559" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>User Accounts</Text>
                <TouchableOpacity onPress={() => loadUsers(true)} style={styles.backBtn}>
                    <Ionicons name="refresh" size={22} color="#0C1559" />
                </TouchableOpacity>
            </View>

            <View style={styles.searchSection}>
                <View style={styles.searchBar}>
                    <Feather name="search" size={18} color="#94A3B8" />
                    <TextInput
                        placeholder="Search by name or email..."
                        style={styles.searchInput}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        onSubmitEditing={() => loadUsers()}
                        returnKeyType="search"
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={18} color="#94A3B8" />
                        </TouchableOpacity>
                    )}
                </View>
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
                        <Text style={[styles.filterText, roleFilter === item && styles.filterTextActive]}>{item}</Text>
                    </TouchableOpacity>
                )}
            />

            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" color="#0C1559" /></View>
            ) : (
                <FlatList
                    data={users}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadUsers(true)} tintColor="#0C1559" />}
                    renderItem={({ item }) => {
                        const status = item.account_status || 'active';
                        const sc = STATUS_CONFIG[status] || STATUS_CONFIG.active;
                        return (
                            <View style={styles.userRow}>
                                <View style={styles.userAvatar}>
                                    <Text style={styles.avatarTxt}>{getInitials(item.full_name, item.email)}</Text>
                                </View>
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <Text style={styles.userName}>{item.full_name || 'Unknown'}</Text>
                                    <Text style={styles.userEmail} numberOfLines={1}>{item.email || item.phone || '—'}</Text>
                                    <View style={styles.metaRow}>
                                        <View style={[styles.badge, { backgroundColor: '#EEF2FF' }]}>
                                            <Text style={[styles.badgeText, { color: '#3730A3' }]}>{item.role || 'buyer'}</Text>
                                        </View>
                                        <View style={[styles.badge, { backgroundColor: sc.bg }]}>
                                            <Text style={[styles.badgeText, { color: sc.color }]}>{status}</Text>
                                        </View>
                                    </View>
                                </View>
                                <TouchableOpacity onPress={() => handleStatusChange(item)}>
                                    <Ionicons
                                        name={status === 'active' ? 'pause-circle-outline' : 'play-circle-outline'}
                                        size={26}
                                        color={status === 'active' ? '#EF4444' : '#10B981'}
                                    />
                                </TouchableOpacity>
                            </View>
                        );
                    }}
                    ListEmptyComponent={
                        <View style={styles.center}>
                            <Ionicons name="people-outline" size={50} color="#CBD5E1" />
                            <Text style={styles.emptyText}>No users found</Text>
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
    header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center' },
    backBtn: { padding: 8, backgroundColor: '#FFF', borderRadius: 12, elevation: 1 },
    headerTitle: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
    searchSection: { paddingHorizontal: 20, marginBottom: 10 },
    searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingHorizontal: 15, height: 50, borderRadius: 15, borderWidth: 1, borderColor: '#E2E8F0' },
    searchInput: { flex: 1, marginLeft: 10, fontFamily: 'Montserrat-Medium' },
    filterList: { paddingHorizontal: 20, paddingBottom: 12, gap: 8 },
    filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0' },
    filterChipActive: { backgroundColor: '#0C1559', borderColor: '#0C1559' },
    filterText: { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: '#64748B' },
    filterTextActive: { color: '#FFF' },
    userRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, backgroundColor: '#FFF', padding: 14, borderRadius: 18, elevation: 1 },
    userAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#0C1559', justifyContent: 'center', alignItems: 'center' },
    avatarTxt: { color: '#FFF', fontFamily: 'Montserrat-Bold', fontSize: 14 },
    userName: { fontFamily: 'Montserrat-Bold', color: '#0F172A', fontSize: 14 },
    userEmail: { fontSize: 12, color: '#64748B', marginTop: 2 },
    metaRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
    badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    badgeText: { fontSize: 10, fontFamily: 'Montserrat-Bold', textTransform: 'uppercase' },
});