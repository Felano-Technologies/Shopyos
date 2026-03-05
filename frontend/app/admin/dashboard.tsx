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
import { getAdminDashboard, getAdminPayouts, updateAdminPayoutStatus, getAdminAuditLogs } from '@/services/api';

const { width } = Dimensions.get('window');

const chartData = [
    { month: 'Jan', value: 80 },
    { month: 'Feb', value: 100 },
    { month: 'Mar', value: 90 },
    { month: 'Apr', value: 120 },
    { month: 'May', value: 110 },
    { month: 'Jun', value: 140 },
];

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
    const [activityFeed, setActivityFeed] = useState<any[]>([]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [dashboardRes, payoutsRes, activityRes] = await Promise.all([
                getAdminDashboard(),
                getAdminPayouts('pending'),
                getAdminAuditLogs({ limit: 10 }).catch(() => ({ logs: [], data: [] }))
            ]);
            if (dashboardRes.success) setStats(dashboardRes.stats);
            if (payoutsRes.success) setPendingPayouts(payoutsRes.data);
            const logs = Array.isArray(activityRes?.logs) ? activityRes.logs
                : Array.isArray(activityRes?.data) ? activityRes.data
                : Array.isArray(activityRes) ? activityRes : [];
            setActivityFeed(logs);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => { loadData(); }, []);

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
                    <Image source={require('../../assets/images/splash-icon.png')} style={styles.fadedLogo} />
                </View>
            </View>

            {/* --- HEADER & REVENUE HERO --- */}
            <LinearGradient colors={['#0C1559', '#1e3a8a']} style={styles.header}>
                <SafeAreaView edges={['top', 'left', 'right']}>
                    <View style={styles.headerRow}>
                        <View>
                            <Text style={styles.headerLabel}>ADMINISTRATOR</Text>
                            <Text style={styles.headerTitle}>System Hub</Text>
                        </View>
                        <View style={styles.avatarBorder}>
                            <Image source={{ uri: 'https://api.dicebear.com/7.x/avataaars/png?seed=Admin' }} style={styles.avatar} />
                        </View>
                    </View>

                    <TouchableOpacity style={styles.revenueHero} onPress={() => router.push('/admin/revenue')}>
                        <View>
                            <Text style={styles.heroLabel}>Platform Revenue</Text>
                            <Text style={styles.heroValue}>₵{stats.totalRevenue?.toLocaleString()}</Text>
                        </View>
                        <View style={styles.heroIconCircle}><Feather name="trending-up" size={24} color="#84cc16" /></View>
                    </TouchableOpacity>
                </SafeAreaView>
            </LinearGradient>

            <ScrollView
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor="#0C1559" />}
                contentContainerStyle={styles.scrollContent}
            >
                {/* --- REVENUE GROWTH CHART --- */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Revenue Growth</Text>
                    <View style={styles.chartContainer}>
                        <View style={styles.chartBarsRow}>
                            {chartData.map((item, index) => (
                                <View key={index} style={styles.barWrapper}>
                                    <View style={[styles.bar, { height: item.value }]} />
                                    <Text style={styles.barMonth}>{item.month}</Text>
                                </View>
                            ))}
                        </View>
                        <View style={styles.chartInfo}>
                            <Text style={styles.chartGrowthText}>+24% from last month</Text>
                            <Ionicons name="caret-up" size={14} color="#84cc16" />
                        </View>
                    </View>
                </View>

                {/* --- QUICK STATS --- */}
                <View style={styles.statsGrid}>
                    <TouchableOpacity style={styles.statCard} onPress={() => router.push('/admin/orders')}>
                        <View style={[styles.statIconBg, { backgroundColor: '#DBEAFE' }]}><Feather name="shopping-bag" size={20} color="#1E40AF" /></View>
                        <Text style={styles.statValue}>{stats.totalOrders}</Text>
                        <Text style={styles.statLabel}>Orders</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.statCard} onPress={() => router.push('/admin/stores' as any)}>
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
                        {activityFeed.length === 0 ? (
                            <Text style={[styles.activityDesc, { textAlign: 'center', paddingVertical: 20 }]}>No recent activity</Text>
                        ) : activityFeed.slice(0, 8).map((item, index) => {
                            const iconMap: Record<string, string> = {
                                store_verified: 'shield-checkmark', store_rejected: 'close-circle',
                                user_updated: 'person', payout_approved: 'cash', payout_rejected: 'close',
                                order_status_changed: 'cart', report_resolved: 'flag',
                            };
                            const colorMap = ['#DBEAFE', '#F3E8FF', '#DCFCE7', '#FEF3C7', '#FCE7F3'];
                            const icon = iconMap[item.action] || 'notifications';
                            const actorName = item.user?.full_name || item.user?.email || 'System';
                            const timeAgo = (() => {
                                const diff = Date.now() - new Date(item.timestamp).getTime();
                                const m = Math.floor(diff / 60000);
                                if (m < 1) return 'just now';
                                if (m < 60) return `${m}m ago`;
                                const h = Math.floor(m / 60);
                                if (h < 24) return `${h}h ago`;
                                return `${Math.floor(h / 24)}d ago`;
                            })();
                            return (
                                <View key={item.id} style={styles.activityItem}>
                                    <View style={[styles.activityIconBg, { backgroundColor: colorMap[index % colorMap.length] }]}>
                                        <Ionicons name={icon as any} size={18} color="#0C1559" />
                                    </View>
                                    <View style={styles.activityText}>
                                        <Text style={styles.activityTitle}>{(item.action || '').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}</Text>
                                        <Text style={styles.activityDesc} numberOfLines={1}>{actorName} • {item.entity_type || ''}</Text>
                                    </View>
                                    <Text style={styles.activityTime}>{timeAgo}</Text>
                                </View>
                            );
                        })}
                    </View>
                </View>

                {/* --- CONTROLS --- */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Platform Management</Text>
                    <View style={styles.controlsGrid}>
                        <TouchableOpacity style={styles.controlItem} onPress={() => router.push('/admin/stores' as any)}>
                            <View style={styles.controlIcon}><Ionicons name="shield-checkmark" size={22} color="#0C1559" /></View>
                            <Text style={styles.controlLabel}>Verification</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.controlItem} onPress={() => router.push('/admin/audit-logs')}>
                            <View style={styles.controlIcon}><Ionicons name="list" size={22} color="#0C1559" /></View>
                            <Text style={styles.controlLabel}>Audit Logs</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.controlItem} onPress={() =>router.push('/admin/settings')}>
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
    watermarkContainer: { position: 'absolute', bottom: -50, right: -50, opacity: 0.05 },
    fadedLogo: { width: 300, height: 300, resizeMode: 'contain' },
    header: { paddingBottom: 25, borderBottomLeftRadius: 35, borderBottomRightRadius: 35, elevation: 12 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 25, paddingTop: 10 },
    headerLabel: { color: '#A3E635', fontSize: 10, fontFamily: 'Montserrat-Bold', letterSpacing: 2 },
    headerTitle: { color: '#FFF', fontSize: 24, fontFamily: 'Montserrat-Bold' },
    avatarBorder: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', padding: 2 },
    avatar: { width: '100%', height: '100%', borderRadius: 20 },
    revenueHero: { backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 25, marginTop: 20, borderRadius: 24, padding: 22, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
    heroLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontFamily: 'Montserrat-Medium' },
    heroValue: { color: '#FFF', fontSize: 28, fontFamily: 'Montserrat-Bold', marginTop: 4 },
    heroIconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
    scrollContent: { paddingHorizontal: 25, paddingTop: 25, paddingBottom: 110 },
    
    // Chart Styles
    chartContainer: { backgroundColor: '#FFF', borderRadius: 24, padding: 20, elevation: 3, shadowColor: '#000', shadowOpacity: 0.05, marginBottom: 25 },
    chartBarsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 150, paddingBottom: 10 },
    barWrapper: { alignItems: 'center' },
    bar: { width: 14, backgroundColor: '#84cc16', borderRadius: 10 },
    barMonth: { fontSize: 10, color: '#94A3B8', fontFamily: 'Montserrat-Medium', marginTop: 10 },
    chartInfo: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
    chartGrowthText: { fontSize: 12, fontFamily: 'Montserrat-Bold', color: '#84cc16' },

    section: { marginBottom: 30 },
    sectionTitle: { fontSize: 15, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginBottom: 15 },
    statsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
    statCard: { width: (width - 75) / 3, backgroundColor: '#FFF', padding: 15, borderRadius: 24, alignItems: 'center', elevation: 2 },
    statIconBg: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
    statValue: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
    statLabel: { fontSize: 10, fontFamily: 'Montserrat-SemiBold', color: '#94A3B8', marginTop: 2 },
    activityContainer: { backgroundColor: '#FFF', borderRadius: 24, padding: 15, elevation: 2 },
    activityItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
    activityIconBg: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
    activityText: { flex: 1, marginLeft: 15 },
    activityTitle: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
    activityDesc: { fontSize: 11, fontFamily: 'Montserrat-Medium', color: '#64748B' },
    activityTime: { fontSize: 10, color: '#94A3B8' },
    controlsGrid: { flexDirection: 'row', justifyContent: 'space-between' },
    controlItem: { width: (width - 75) / 3, backgroundColor: '#FFF', paddingVertical: 20, borderRadius: 24, alignItems: 'center', elevation: 2 },
    controlIcon: { width: 48, height: 48, borderRadius: 15, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
    controlLabel: { fontSize: 11, fontFamily: 'Montserrat-Bold', color: '#0C1559' }
});