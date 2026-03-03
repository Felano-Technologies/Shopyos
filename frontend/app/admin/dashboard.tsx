import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Image,
    Dimensions,
    ActivityIndicator,
    FlatList,
    RefreshControl,
    Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { getAdminDashboard, getAdminPayouts, updateAdminPayoutStatus } from '@/services/api';

const { width } = Dimensions.get('window');

export default function AdminDashboard() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState<any>({
        totalUsers: 0,
        totalStores: 0,
        totalOrders: 0,
        totalRevenue: 0,
        pendingPayouts: 0,
        activePromotions: 0
    });
    const [pendingPayouts, setPendingPayouts] = useState<any[]>([]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [dashboardRes, payoutsRes] = await Promise.all([
                getAdminDashboard(),
                getAdminPayouts('pending')
            ]);

            if (dashboardRes.success) {
                setStats(dashboardRes.stats);
            }
            if (payoutsRes.success) {
                setPendingPayouts(payoutsRes.data);
            }
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Failed to load admin data");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const handlePayout = (id: string, action: 'completed' | 'rejected') => {
        Alert.alert(
            `${action === 'completed' ? 'Approve' : 'Reject'} Payout`,
            `Are you sure you want to ${action} this payout request?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: action.toUpperCase(),
                    style: action === 'completed' ? "default" : "destructive",
                    onPress: async () => {
                        try {
                            const res = await updateAdminPayoutStatus(id, action);
                            if (res.success) {
                                Alert.alert("Success", `Payout ${action} successfully`);
                                loadData();
                            }
                        } catch (e: any) {
                            Alert.alert("Error", e.message || "Failed to update payout");
                        }
                    }
                }
            ]
        );
    };

    const StatCard = ({ title, value, icon, colors, subtitle }: any) => (
        <LinearGradient colors={colors} style={styles.statCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <View style={styles.statHeader}>
                <View style={styles.statIconCircle}>
                    <Ionicons name={icon} size={20} color="#FFF" />
                </View>
                <Text style={styles.statTitle}>{title}</Text>
            </View>
            <Text style={styles.statValue}>{value}</Text>
            {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
        </LinearGradient>
    );

    if (loading && !refreshing) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#0C1559" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar style="light" />

            <LinearGradient colors={['#0C1559', '#1e40af']} style={styles.header}>
                <SafeAreaView edges={['top', 'left', 'right']}>
                    <View style={styles.headerRow}>
                        <View>
                            <Text style={styles.headerLabel}>ADMIN PORTAL</Text>
                            <Text style={styles.headerTitle}>Marketplace Overview</Text>
                        </View>
                        <TouchableOpacity style={styles.profileBtn}>
                            <Ionicons name="person-circle-outline" size={32} color="#FFF" />
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </LinearGradient>

            <ScrollView
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0C1559" />}
                contentContainerStyle={styles.scrollContent}
            >
                {/* --- STATS GRID --- */}
                <View style={styles.statsGrid}>
                    <StatCard
                        title="Revenue"
                        value={`₵${stats.totalRevenue?.toLocaleString()}`}
                        icon="cash-outline"
                        colors={['#0C1559', '#3b82f6']}
                        subtitle="Total Platform Sales"
                    />
                    <StatCard
                        title="Orders"
                        value={stats.totalOrders}
                        icon="cart-outline"
                        colors={['#10b981', '#059669']}
                        subtitle="Processed Orders"
                    />
                    <StatCard
                        title="Sellers"
                        value={stats.totalStores}
                        icon="storefront-outline"
                        colors={['#8b5cf6', '#6d28d9']}
                        subtitle="Active Businesses"
                    />
                    <StatCard
                        title="Users"
                        value={stats.totalUsers}
                        icon="people-outline"
                        colors={['#f59e0b', '#d97706']}
                        subtitle="Registered Members"
                    />
                </View>

                {/* --- PENDING PAYOUTS --- */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Pending Payouts</Text>
                        <TouchableOpacity onPress={() => loadData()}>
                            <Text style={styles.seeAll}>Refresh</Text>
                        </TouchableOpacity>
                    </View>

                    {pendingPayouts.length === 0 ? (
                        <View style={styles.emptyCard}>
                            <Feather name="check-circle" size={40} color="#10b981" />
                            <Text style={styles.emptyText}>All payouts processed!</Text>
                        </View>
                    ) : (
                        pendingPayouts.map(item => (
                            <View key={item.id} style={styles.payoutCard}>
                                <View style={styles.payoutInfo}>
                                    <Text style={styles.payoutStore}>{item.store?.store_name || "Unknown Store"}</Text>
                                    <Text style={styles.payoutMethod}>via {item.payout_method || "Mobile Money"}</Text>
                                    <Text style={styles.payoutAmount}>₵{parseFloat(item.amount).toFixed(2)}</Text>
                                </View>
                                <View style={styles.payoutActions}>
                                    <TouchableOpacity
                                        style={[styles.actionBtn, styles.approveBtn]}
                                        onPress={() => handlePayout(item.id, 'completed')}
                                    >
                                        <Ionicons name="checkmark" size={20} color="#FFF" />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.actionBtn, styles.rejectBtn]}
                                        onPress={() => handlePayout(item.id, 'rejected')}
                                    >
                                        <Ionicons name="close" size={20} color="#FFF" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))
                    )}
                </View>

                {/* --- QUICK ACTIONS --- */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Marketplace Controls</Text>
                    <View style={styles.actionGrid}>
                        <TouchableOpacity style={styles.gridAction} onPress={() => router.push('/admin/stores' as any)}>
                            <View style={styles.actionIconBg}><Ionicons name="shield-checkmark-outline" size={24} color="#0C1559" /></View>
                            <Text style={styles.actionLabel}>Verify Stores</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.gridAction} onPress={() => Alert.alert("Coming Soon", "Reports management is currently in audit.")}>
                            <View style={styles.actionIconBg}><Ionicons name="flag-outline" size={24} color="#0C1559" /></View>
                            <Text style={styles.actionLabel}>Moderation</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.gridAction} onPress={() => Alert.alert("Coming Soon", "Global settings are locked for stability.")}>
                            <View style={styles.actionIconBg}><Ionicons name="settings-outline" size={24} color="#0C1559" /></View>
                            <Text style={styles.actionLabel}>Platform Settings</Text>
                        </TouchableOpacity>
                    </View>
                </View>

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F1F5F9' },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { paddingBottom: 30, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10 },
    headerLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontFamily: 'Montserrat-Bold', letterSpacing: 2 },
    headerTitle: { color: '#FFF', fontSize: 24, fontFamily: 'Montserrat-Bold', marginTop: 2 },
    profileBtn: { padding: 4 },
    scrollContent: { padding: 20, paddingBottom: 100 },

    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    statCard: { width: '48%', padding: 16, borderRadius: 20, marginBottom: 15, elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
    statHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    statIconCircle: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginRight: 8 },
    statTitle: { color: '#FFF', fontSize: 12, fontFamily: 'Montserrat-SemiBold' },
    statValue: { color: '#FFF', fontSize: 20, fontFamily: 'Montserrat-Bold' },
    statSubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontFamily: 'Montserrat-Medium', marginTop: 4 },

    section: { marginTop: 10, marginBottom: 25 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    sectionTitle: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
    seeAll: { color: '#0C1559', fontSize: 14, fontFamily: 'Montserrat-Bold' },

    emptyCard: { backgroundColor: '#FFF', padding: 30, borderRadius: 20, alignItems: 'center', justifyContent: 'center', elevation: 2 },
    emptyText: { marginTop: 10, color: '#64748B', fontFamily: 'Montserrat-Medium' },

    payoutCard: { backgroundColor: '#FFF', padding: 16, borderRadius: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, elevation: 2 },
    payoutInfo: { flex: 1 },
    payoutStore: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
    payoutMethod: { fontSize: 12, color: '#64748B', fontFamily: 'Montserrat-Medium', marginTop: 2 },
    payoutAmount: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#16A34A', marginTop: 4 },
    payoutActions: { flexDirection: 'row', gap: 10 },
    actionBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    approveBtn: { backgroundColor: '#10b981' },
    rejectBtn: { backgroundColor: '#ef4444' },

    actionGrid: { flexDirection: 'row', justifyContent: 'space-between' },
    gridAction: { width: '30%', backgroundColor: '#FFF', padding: 15, borderRadius: 20, alignItems: 'center', elevation: 2 },
    actionIconBg: { width: 45, height: 45, borderRadius: 15, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
    actionLabel: { fontSize: 11, fontFamily: 'Montserrat-Bold', color: '#0C1559', textAlign: 'center' }
});
