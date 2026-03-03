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
    RefreshControl,
    Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { getAdminDashboard, getAdminPayouts, updateAdminPayoutStatus } from '@/services/api';

const { width, height } = Dimensions.get('window');

export default function AdminDashboard() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState<any>({
        totalUsers: 0,
        totalStores: 0,
        totalOrders: 0,
        totalRevenue: 0,
    });
    const [pendingPayouts, setPendingPayouts] = useState<any[]>([]);

    // --- Mock Activity Data ---
    const activityFeed = [
        { id: '1', type: 'user', title: 'New User Signup', desc: 'Kwame Mensah joined.', time: '2m ago', icon: 'person-add' },
        { id: '2', type: 'store', title: 'New Store Request', desc: 'Star Electronics applied.', time: '15m ago', icon: 'storefront' },
        { id: '3', type: 'order', title: 'Large Order Placed', desc: 'Order #8821 - ₵1,200.00', time: '1h ago', icon: 'cart' },
    ];

    const loadData = async () => {
        try {
            setLoading(true);
            const [dashboardRes, payoutsRes] = await Promise.all([
                getAdminDashboard(),
                getAdminPayouts('pending')
            ]);

            if (dashboardRes.success) setStats(dashboardRes.stats);
            if (payoutsRes.success) setPendingPayouts(payoutsRes.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const handlePayout = (id: string, action: 'completed' | 'rejected') => {
        Alert.alert(`${action.toUpperCase()} Payout`, "Confirm this action?", [
            { text: "Cancel", style: "cancel" },
            { text: "Confirm", onPress: async () => {
                try {
                    const res = await updateAdminPayoutStatus(id, action);
                    if (res.success) {
                        Alert.alert("Success", `Payout ${action}`);
                        loadData();
                    }
                } catch (e) { Alert.alert("Error", "Failed to update"); }
            }}
        ]);
    };

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

            {/* --- BACKGROUND WATERMARK --- */}
            <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
                <View style={styles.watermarkContainer}>
                    <Image 
                        source={require('../../assets/images/splash-icon.png')} 
                        style={styles.fadedLogo} 
                    />
                </View>
            </View>

            {/* --- HEADER --- */}
            <LinearGradient colors={['#0C1559', '#1e3a8a']} style={styles.header}>
                <SafeAreaView edges={['top', 'left', 'right']}>
                    <View style={styles.headerRow}>
                        <View>
                            <Text style={styles.headerLabel}>ADMINISTRATOR</Text>
                            <Text style={styles.headerTitle}>System Hub</Text>
                        </View>
                        <TouchableOpacity style={styles.profileBtn}>
                             <View style={styles.avatarBorder}>
                                <Image source={{ uri: 'https://api.dicebear.com/7.x/avataaars/png?seed=Admin' }} style={styles.avatar} />
                             </View>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity style={styles.revenueHero} onPress={() => router.push('/admin/revenue')} activeOpacity={0.9}>
                        <View>
                            <Text style={styles.heroLabel}>Platform Total Revenue</Text>
                            <Text style={styles.heroValue}>₵{stats.totalRevenue?.toLocaleString()}</Text>
                        </View>
                        <View style={styles.heroIconCircle}><Feather name="trending-up" size={24} color="#84cc16" /></View>
                    </TouchableOpacity>
                </SafeAreaView>
            </LinearGradient>

            <ScrollView
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0C1559" />}
                contentContainerStyle={styles.scrollContent}
            >
                {/* --- STATS GRID --- */}
                <View style={styles.statsGrid}>
                    <TouchableOpacity style={styles.statCard} onPress={() => router.push('/admin/orders')}>
                        <View style={[styles.statIconBg, { backgroundColor: '#DBEAFE' }]}><Feather name="shopping-bag" size={20} color="#1E40AF" /></View>
                        <Text style={styles.statValue}>{stats.totalOrders}</Text>
                        <Text style={styles.statLabel}>Orders</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.statCard} onPress={() => router.push('/admin/sellers')}>
                        <View style={[styles.statIconBg, { backgroundColor: '#F3E8FF' }]}><Feather name="home" size={20} color="#7C3AED" /></View>
                        <Text style={styles.statValue}>{stats.totalStores}</Text>
                        <Text style={styles.statLabel}>Stores</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.statCard} onPress={() => router.push('/admin/users')}>
                        <View style={[styles.statIconBg, { backgroundColor: '#DCFCE7' }]}><Feather name="users" size={20} color="#15803D" /></View>
                        <Text style={styles.statValue}>{stats.totalUsers}</Text>
                        <Text style={styles.statLabel}>Users</Text>
                    </TouchableOpacity>
                </View>

                {/* --- LIVE ACTIVITY FEED --- */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Live Activity Feed</Text>
                    <View style={styles.activityContainer}>
                        {activityFeed.map((item, index) => (
                            <View key={item.id} style={styles.activityItem}>
                                <View style={[styles.activityIconBg, { backgroundColor: index === 0 ? '#DBEAFE' : index === 1 ? '#F3E8FF' : '#DCFCE7' }]}>
                                    <Ionicons name={item.icon as any} size={18} color="#0C1559" />
                                </View>
                                <View style={styles.activityText}>
                                    <Text style={styles.activityTitle}>{item.title}</Text>
                                    <Text style={styles.activityDesc}>{item.desc}</Text>
                                </View>
                                <Text style={styles.activityTime}>{item.time}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* --- PENDING PAYOUTS --- */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Pending Payouts</Text>
                        <TouchableOpacity onPress={() => loadData()}><Text style={styles.refreshText}>Refresh</Text></TouchableOpacity>
                    </View>

                    {pendingPayouts.length === 0 ? (
                        <View style={styles.emptyCard}>
                            <MaterialCommunityIcons name="check-circle-outline" size={40} color="#CBD5E1" />
                            <Text style={styles.emptyText}>All caught up!</Text>
                        </View>
                    ) : (
                        pendingPayouts.map(item => (
                            <View key={item.id} style={styles.payoutRow}>
                                <View style={styles.payoutInfo}>
                                    <Text style={styles.payoutStore}>{item.store?.store_name || "Store"}</Text>
                                    <Text style={styles.payoutMethod}>{item.payout_method || "MoMo"}</Text>
                                </View>
                                <View style={styles.payoutActionRow}>
                                    <Text style={styles.payoutAmount}>₵{parseFloat(item.amount).toFixed(2)}</Text>
                                    <View style={styles.payoutButtons}>
                                        <TouchableOpacity style={styles.approveBtn} onPress={() => handlePayout(item.id, 'completed')}>
                                            <Ionicons name="checkmark" size={18} color="#FFF" />
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.rejectBtn} onPress={() => handlePayout(item.id, 'rejected')}>
                                            <Ionicons name="close" size={18} color="#FFF" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        ))
                    )}
                </View>

                {/* --- MARKETPLACE CONTROLS --- */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Platform Management</Text>
                    <View style={styles.controlsGrid}>
                        <TouchableOpacity style={styles.controlItem} onPress={() => router.push('/admin/sellers')}>
                            <View style={styles.controlIcon}><Ionicons name="shield-checkmark" size={22} color="#0C1559" /></View>
                            <Text style={styles.controlLabel}>Verify Stores</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity style={styles.controlItem} onPress={() => router.push('/admin/audit-logs')}>
                            <View style={styles.controlIcon}><Ionicons name="list" size={22} color="#0C1559" /></View>
                            <Text style={styles.controlLabel}>Audit Logs</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.controlItem} onPress={() => Alert.alert("Coming Soon")}>
                            <View style={styles.controlIcon}><Ionicons name="settings-sharp" size={22} color="#0C1559" /></View>
                            <Text style={styles.controlLabel}>Settings</Text>
                        </TouchableOpacity>
                    </View>
                </View>

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    
    // Background Watermark
    watermarkContainer: { position: 'absolute', bottom: -10, left: 1, opacity: 0.05 },
    fadedLogo: { width: 150, height: 150, resizeMode: 'contain' },

    header: { paddingBottom: 25, borderBottomLeftRadius: 35, borderBottomRightRadius: 35, elevation: 12 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 25, paddingTop: 10 },
    headerLabel: { color: '#A3E635', fontSize: 10, fontFamily: 'Montserrat-Bold', letterSpacing: 2 },
    headerTitle: { color: '#FFF', fontSize: 24, fontFamily: 'Montserrat-Bold' },
    profileBtn: { padding: 2 },
    avatarBorder: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', padding: 2 },
    avatar: { width: '100%', height: '100%', borderRadius: 20 },
    
    revenueHero: { backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 25, marginTop: 25, borderRadius: 24, padding: 22, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
    heroLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontFamily: 'Montserrat-Medium', textTransform: 'uppercase' },
    heroValue: { color: '#FFF', fontSize: 30, fontFamily: 'Montserrat-Bold', marginTop: 4 },
    heroIconCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },

    scrollContent: { paddingHorizontal: 25, paddingTop: 25, paddingBottom: 110 },

    statsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
    statCard: { width: (width - 75) / 3, backgroundColor: '#FFF', padding: 15, borderRadius: 24, alignItems: 'center', elevation: 3, shadowColor: '#000', shadowOpacity: 0.05 },
    statIconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
    statValue: { fontSize: 20, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
    statLabel: { fontSize: 10, fontFamily: 'Montserrat-SemiBold', color: '#94A3B8', marginTop: 2, textTransform: 'uppercase' },

    section: { marginBottom: 35 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    sectionTitle: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
    refreshText: { fontSize: 12, color: '#0C1559', fontFamily: 'Montserrat-Bold' },

    // Activity Feed
    activityContainer: { backgroundColor: '#FFF', borderRadius: 24, padding: 15, elevation: 2, shadowColor: '#000', shadowOpacity: 0.03 },
    activityItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
    activityIconBg: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    activityText: { flex: 1, marginLeft: 15 },
    activityTitle: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
    activityDesc: { fontSize: 11, fontFamily: 'Montserrat-Medium', color: '#64748B', marginTop: 2 },
    activityTime: { fontSize: 10, fontFamily: 'Montserrat-Medium', color: '#94A3B8' },

    // Payout
    payoutRow: { backgroundColor: '#FFF', padding: 18, borderRadius: 24, marginBottom: 12, elevation: 2, borderLeftWidth: 5, borderLeftColor: '#84cc16' },
    payoutInfo: { marginBottom: 12 },
    payoutStore: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
    payoutMethod: { fontSize: 12, color: '#94A3B8', fontFamily: 'Montserrat-Medium', marginTop: 2 },
    payoutActionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    payoutAmount: { fontSize: 20, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
    payoutButtons: { flexDirection: 'row', gap: 10 },
    approveBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#10b981', justifyContent: 'center', alignItems: 'center' },
    rejectBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center' },

    emptyCard: { backgroundColor: '#FFF', padding: 40, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: '#CBD5E1' },
    emptyText: { marginTop: 10, color: '#94A3B8', fontFamily: 'Montserrat-Medium' },

    controlsGrid: { flexDirection: 'row', justifyContent: 'space-between' },
    controlItem: { width: (width - 75) / 3, backgroundColor: '#FFF', paddingVertical: 22, borderRadius: 24, alignItems: 'center', elevation: 3 },
    controlIcon: { width: 50, height: 50, borderRadius: 15, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
    controlLabel: { fontSize: 11, fontFamily: 'Montserrat-Bold', color: '#0C1559', textAlign: 'center' }
});