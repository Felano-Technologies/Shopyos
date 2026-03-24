import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getAdminRevenue, getAdminDashboard } from '@/services/api';
import { CustomInAppToast } from "@/components/InAppToastHost";

export default function AdminRevenue() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [totalRevenue, setTotalRevenue] = useState(0);
    const [transactions, setTransactions] = useState<any[]>([]);

    const loadData = async (isRefresh = false) => {
        try {
            isRefresh ? setRefreshing(true) : setLoading(true);
            const [dashRes, revRes] = await Promise.all([
                getAdminDashboard(),
                getAdminRevenue({ limit: 50 })
            ]);
            if (dashRes?.stats?.totalRevenue !== undefined) setTotalRevenue(dashRes.stats.totalRevenue);
            const txs = Array.isArray(revRes?.transactions) ? revRes.transactions : [];
            setTransactions(txs);
        } catch (err: any) {
            CustomInAppToast.show({ type: 'error', title: 'Error', message: err.message || 'Failed to load revenue' });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    const formatDate = (ts: string) => {
        try { return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
        catch { return ts; }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#0C1559" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Platform Revenue</Text>
                <TouchableOpacity style={styles.backBtn} onPress={() => loadData(true)}>
                    <Feather name="refresh-cw" size={20} color="#0C1559" />
                </TouchableOpacity>
            </View>

            <View style={styles.balanceCard}>
                <Text style={styles.balanceLabel}>Total Commission Earned</Text>
                {loading ? (
                    <ActivityIndicator color="#FFF" style={{ marginTop: 10 }} />
                ) : (
                    <Text style={styles.balanceValue}>₵{totalRevenue.toLocaleString('en-GH', { minimumFractionDigits: 2 })}</Text>
                )}
                <Text style={styles.balanceSub}>{transactions.length} completed payments</Text>
            </View>

            <Text style={styles.sectionTitle}>Recent Transactions</Text>

            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" color="#0C1559" /></View>
            ) : (
                <FlatList
                    data={transactions}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor="#0C1559" />}
                    renderItem={({ item }) => (
                        <View style={styles.itemRow}>
                            <View style={styles.iconBg}>
                                <Ionicons name="trending-up" size={20} color="#10b981" />
                            </View>
                            <View style={{ flex: 1, marginLeft: 15 }}>
                                <Text style={styles.itemMain}>
                                    {item.order?.order_number ? `Order #${item.order.order_number}` : 'Payment'} — {item.order?.store?.store_name || 'Store'}
                                </Text>
                                <Text style={styles.itemSub}>{formatDate(item.created_at)}</Text>
                            </View>
                            <Text style={styles.itemPrice}>+₵{parseFloat(item.amount || 0).toFixed(2)}</Text>
                        </View>
                    )}
                    ListEmptyComponent={
                        <View style={styles.center}>
                            <Ionicons name="bar-chart-outline" size={50} color="#CBD5E1" />
                            <Text style={styles.emptyText}>No transactions yet</Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    center: { alignItems: 'center', paddingTop: 40 },
    emptyText: { marginTop: 12, color: '#94A3B8', fontFamily: 'Montserrat-Medium' },
    header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center' },
    backBtn: { padding: 8, backgroundColor: '#FFF', borderRadius: 12, elevation: 1 },
    headerTitle: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
    balanceCard: { margin: 20, backgroundColor: '#0C1559', padding: 30, borderRadius: 25 },
    balanceLabel: { color: 'rgba(255,255,255,0.7)', fontFamily: 'Montserrat-Medium' },
    balanceValue: { color: '#FFF', fontSize: 32, fontFamily: 'Montserrat-Bold', marginTop: 10 },
    balanceSub: { color: 'rgba(255,255,255,0.5)', fontFamily: 'Montserrat-Medium', fontSize: 12, marginTop: 6 },
    sectionTitle: { marginLeft: 20, marginBottom: 4, fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#64748B', textTransform: 'uppercase' },
    itemRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 15, borderRadius: 15, marginBottom: 10 },
    iconBg: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#DCFCE7', justifyContent: 'center', alignItems: 'center' },
    itemMain: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
    itemSub: { fontSize: 12, color: '#94A3B8' },
    itemPrice: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#10b981' }
});
           
