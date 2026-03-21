import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    TextInput, ActivityIndicator, Image, Dimensions, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { CustomInAppToast } from "@/components/InAppToastHost";
import { getAdminOrders } from '@/services/api';

const { width } = Dimensions.get('window');
const STATUS_FILTERS = ['All', 'pending', 'processing', 'delivered', 'cancelled'];

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
    delivered:  { color: '#15803D', bg: '#DCFCE7', icon: 'checkmark-circle' },
    processing: { color: '#1E40AF', bg: '#DBEAFE', icon: 'sync' },
    pending:    { color: '#B45309', bg: '#FEF3C7', icon: 'time' },
    cancelled:  { color: '#B91C1C', bg: '#FEE2E2', icon: 'close-circle' },
};

export default function AdminOrders() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeStatus, setActiveStatus] = useState('All');
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadOrders = useCallback(async (isRefresh = false) => {
        try {
            isRefresh ? setRefreshing(true) : setLoading(true);
            const params: Record<string, string> = {};
            if (activeStatus !== 'All') params.status = activeStatus;
            if (searchQuery.trim()) params.search = searchQuery.trim();
            const res = await getAdminOrders(params);
            const data = Array.isArray(res?.orders) ? res.orders : (Array.isArray(res) ? res : []);
            setOrders(data);
        } catch (err: any) {
            CustomInAppCustomInAppToast.show({ type: 'error', title: 'Error', message: err.message || 'Failed to load orders' });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [activeStatus, searchQuery]);

    useEffect(() => { loadOrders(); }, [loadOrders]);

    const formatTime = (ts: string) => {
        const diff = Date.now() - new Date(ts).getTime();
        const m = Math.floor(diff / 60000);
        if (m < 1) return 'Just now';
        if (m < 60) return `${m} min ago`;
        const h = Math.floor(m / 60);
        if (h < 24) return `${h}h ago`;
        return `${Math.floor(h / 24)}d ago`;
    };

    return (
        <View style={styles.container}>
            <StatusBar style="light" />

            <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
                <View style={styles.watermarkContainer}>
                    <Image source={require('../../assets/images/splash-icon.png')} style={styles.fadedLogo} />
                </View>
            </View>

            <LinearGradient colors={['#0C1559', '#1e3a8a']} style={styles.header}>
                <SafeAreaView edges={['top', 'left', 'right']}>
                    <View style={styles.headerRow}>
                        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Ionicons name="arrow-back" size={24} color="#FFF" /></TouchableOpacity>
                        <View style={styles.headerTitleContainer}>
                            <Text style={styles.headerLabel}>ADMINISTRATION</Text>
                            <Text style={styles.headerTitle}>Order Logs</Text>
                        </View>
                        <TouchableOpacity style={styles.headerIconBtn} onPress={() => loadOrders(true)}>
                            <Feather name="refresh-cw" size={20} color="#FFF" />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.searchContainer}>
                        <View style={styles.searchBar}>
                            <Feather name="search" size={18} color="#94A3B8" />
                            <TextInput
                                placeholder="Search by order number..."
                                style={styles.searchInput}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                onSubmitEditing={() => loadOrders()}
                                returnKeyType="search"
                                placeholderTextColor="#94A3B8"
                            />
                        </View>
                    </View>
                </SafeAreaView>
            </LinearGradient>

            <View style={styles.filterSection}>
                <FlatList
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    data={STATUS_FILTERS}
                    keyExtractor={i => i}
                    contentContainerStyle={styles.filterList}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={[styles.filterChip, activeStatus === item && styles.filterChipActive]}
                            onPress={() => setActiveStatus(item)}
                        >
                            <Text style={[styles.filterText, activeStatus === item && styles.filterTextActive]}>
                                {item.charAt(0).toUpperCase() + item.slice(1)}
                            </Text>
                        </TouchableOpacity>
                    )}
                />
            </View>

            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" color="#0C1559" /></View>
            ) : (
                <FlatList
                    data={orders}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadOrders(true)} tintColor="#0C1559" />}
                    renderItem={({ item }) => {
                        const status = (item.status || 'pending').toLowerCase();
                        const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
                        const storeName = item.store?.store_name || 'Unknown Store';
                        const itemsCount = item.items_count ?? item.order_items?.[0]?.count ?? 0;
                        return (
                            <TouchableOpacity
                                style={styles.orderCard}
                                onPress={() => router.push(`/order/${item.id}` as any)}
                            >
                                <View style={styles.cardHeader}>
                                    <View>
                                        <Text style={styles.orderIdText}>{item.order_number ? `#${item.order_number}` : `#${item.id.slice(0, 8).toUpperCase()}`}</Text>
                                        <Text style={styles.timeText}>{formatTime(item.created_at)}</Text>
                                    </View>
                                    <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
                                        <Ionicons name={cfg.icon as any} size={12} color={cfg.color} />
                                        <Text style={[styles.statusText, { color: cfg.color }]}>{status.toUpperCase()}</Text>
                                    </View>
                                </View>
                                <View style={styles.cardBody}>
                                    <View style={styles.storeRow}>
                                        <View style={styles.storeIconBg}>
                                            <MaterialCommunityIcons name="storefront-outline" size={18} color="#0C1559" />
                                        </View>
                                        <View style={{ flex: 1, marginLeft: 12 }}>
                                            <Text style={styles.storeName}>{storeName}</Text>
                                            <Text style={styles.itemCount}>{itemsCount} {itemsCount === 1 ? 'item' : 'items'} in package</Text>
                                        </View>
                                        <View style={styles.priceContainer}>
                                            <Text style={styles.priceLabel}>Total Amount</Text>
                                            <Text style={styles.priceValue}>₵{parseFloat(item.total_amount || 0).toFixed(2)}</Text>
                                        </View>
                                    </View>
                                </View>
                                <View style={styles.cardFooter}>
                                    <Text style={styles.viewDetailsText}>View Full Details</Text>
                                    <Feather name="chevron-right" size={16} color="#0C1559" />
                                </View>
                            </TouchableOpacity>
                        );
                    }}
                    ListEmptyComponent={
                        <View style={styles.center}>
                            <MaterialCommunityIcons name="cart-off" size={60} color="#CBD5E1" />
                            <Text style={styles.emptyText}>No orders found.</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    center: { alignItems: 'center', paddingTop: 60 },
    emptyText: { marginTop: 15, color: '#94A3B8', fontFamily: 'Montserrat-Medium', textAlign: 'center' },
    watermarkContainer: { position: 'absolute', bottom: -50, left: -50, opacity: 0.04 },
    fadedLogo: { width: 300, height: 300, resizeMode: 'contain' },
    header: { paddingBottom: 25, borderBottomLeftRadius: 35, borderBottomRightRadius: 35, elevation: 10 },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10 },
    backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
    headerTitleContainer: { alignItems: 'center' },
    headerLabel: { color: '#A3E635', fontSize: 10, fontFamily: 'Montserrat-Bold', letterSpacing: 1.5 },
    headerTitle: { color: '#FFF', fontSize: 18, fontFamily: 'Montserrat-Bold', marginTop: 2 },
    headerIconBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    searchContainer: { paddingHorizontal: 20, marginTop: 20 },
    searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 15, height: 50, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    searchInput: { flex: 1, marginLeft: 10, fontFamily: 'Montserrat-Medium', color: '#FFF' },
    filterSection: { marginTop: 20 },
    filterList: { paddingLeft: 20, paddingBottom: 10 },
    filterChip: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 18, backgroundColor: '#FFF', marginRight: 10, borderWidth: 1, borderColor: '#E2E8F0', elevation: 2 },
    filterChipActive: { backgroundColor: '#0C1559', borderColor: '#0C1559' },
    filterText: { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: '#64748B' },
    filterTextActive: { color: '#FFF' },
    listContent: { padding: 20, paddingBottom: 50 },
    orderCard: { backgroundColor: '#FFF', borderRadius: 24, padding: 20, marginBottom: 18, elevation: 4, shadowColor: '#0C1559', shadowOpacity: 0.08, shadowRadius: 10, borderLeftWidth: 5, borderLeftColor: '#0C1559' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 },
    orderIdText: { fontSize: 12, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
    timeText: { fontSize: 11, fontFamily: 'Montserrat-Medium', color: '#94A3B8', marginTop: 2 },
    statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, gap: 5 },
    statusText: { fontSize: 10, fontFamily: 'Montserrat-Bold' },
    cardBody: { paddingVertical: 15, borderTopWidth: 1, borderTopColor: '#F8FAFC', borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
    storeRow: { flexDirection: 'row', alignItems: 'center' },
    storeIconBg: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
    storeName: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
    itemCount: { fontSize: 11, fontFamily: 'Montserrat-Medium', color: '#64748B', marginTop: 2 },
    priceContainer: { alignItems: 'flex-end' },
    priceLabel: { fontSize: 9, fontFamily: 'Montserrat-SemiBold', color: '#94A3B8', textTransform: 'uppercase' },
    priceValue: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0C1559', marginTop: 2 },
    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15 },
    viewDetailsText: { fontSize: 12, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
    statusCancelBtn: { padding: 8 },
    statusCancelText: { fontSize: 12, fontFamily: 'Montserrat-Bold', color: '#64748B' },
});