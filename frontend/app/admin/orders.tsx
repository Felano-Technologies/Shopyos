<<<<<<< HEAD
import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    TextInput, ActivityIndicator, Image, Dimensions, RefreshControl
=======
import React, { useState } from 'react';
import { 
    View, 
    Text, 
    StyleSheet, 
    FlatList, 
    TouchableOpacity, 
    TextInput, 
    Image, 
    Dimensions,
    Modal,
    ScrollView,
    Alert
>>>>>>> c47eaa06d4a14b2a34217c7af5f5fbe497ab5c1d
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import Toast from 'react-native-toast-message';
import { getAdminOrders } from '@/services/api';

<<<<<<< HEAD
const { width } = Dimensions.get('window');
const STATUS_FILTERS = ['All', 'pending', 'processing', 'delivered', 'cancelled'];

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
    delivered:  { color: '#15803D', bg: '#DCFCE7', icon: 'checkmark-circle' },
    processing: { color: '#1E40AF', bg: '#DBEAFE', icon: 'sync' },
    pending:    { color: '#B45309', bg: '#FEF3C7', icon: 'time' },
    cancelled:  { color: '#B91C1C', bg: '#FEE2E2', icon: 'close-circle' },
};
=======
const { width, height } = Dimensions.get('window');
const STATUS_OPTIONS = ['Pending', 'Processing', 'Delivered', 'Cancelled'];
>>>>>>> c47eaa06d4a14b2a34217c7af5f5fbe497ab5c1d

export default function AdminOrders() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeStatus, setActiveStatus] = useState('All');
<<<<<<< HEAD
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
            Toast.show({ type: 'error', text1: 'Error', text2: err.message || 'Failed to load orders' });
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

=======
    
    const [modalVisible, setModalVisible] = useState(false);
    const [statusModalVisible, setStatusModalVisible] = useState(false); 
    const [selectedOrder, setSelectedOrder] = useState<any>(null);

    const [orders, setOrders] = useState([
        { 
            id: '7721', 
            store: 'Fresh Grocery', 
            total: '450.00', 
            status: 'Processing', 
            time: 'March 03, 10:20 AM', 
            items: [{ name: 'Fresh Tomatoes', qty: 2, price: '50.00' }, { name: 'Yam Tubers', qty: 5, price: '350.00' }],
            customer: { name: 'Williams Boampong', phone: '024 123 4567', address: 'Plot 12, Kumasi' }
        },
        { 
            id: '8812', 
            store: 'Electronics Hub', 
            total: '1,200.00', 
            status: 'Pending', 
            time: 'March 03, 09:15 AM',
            items: [{ name: 'Samsung 24" Monitor', qty: 1, price: '1200.00' }],
            customer: { name: 'Ernest Appiah', phone: '055 999 8888', address: 'East Legon, Accra' }
        },
    ]);

    const recordAuditLog = (orderId: string, newStatus: string) => {
        console.log(`[AUDIT LOG]: Order #ORD-${orderId} status changed to ${newStatus} by Admin_Williams`);
    };

    const getStatusConfig = (status: string) => {
        switch (status) {
            case 'Delivered': return { color: '#15803D', bg: '#DCFCE7', icon: 'checkmark-circle-outline' };
            case 'Processing': return { color: '#1E40AF', bg: '#DBEAFE', icon: 'sync-outline' };
            case 'Pending': return { color: '#B45309', bg: '#FEF3C7', icon: 'time-outline' };
            case 'Cancelled': return { color: '#B91C1C', bg: '#FEE2E2', icon: 'close-circle-outline' };
            default: return { color: '#64748B', bg: '#F1F5F9', icon: 'help-circle-outline' };
        }
    };

    const updateStatusAction = (newStatus: string) => {
        const updatedOrders = orders.map(o => o.id === selectedOrder.id ? { ...o, status: newStatus } : o);
        setOrders(updatedOrders);
        setSelectedOrder({ ...selectedOrder, status: newStatus });
        recordAuditLog(selectedOrder.id, newStatus);
        setStatusModalVisible(false);
    };

    const filteredOrders = orders.filter(order => {
        const matchesSearch = order.id.includes(searchQuery) || order.store.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = activeStatus === 'All' || order.status === activeStatus;
        return matchesSearch && matchesStatus;
    });

    return (
        <View style={styles.container}>
            <StatusBar style="light" />
            
>>>>>>> c47eaa06d4a14b2a34217c7af5f5fbe497ab5c1d
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
<<<<<<< HEAD
                        <TouchableOpacity style={styles.headerIconBtn} onPress={() => loadOrders(true)}>
                            <Feather name="refresh-cw" size={20} color="#FFF" />
                        </TouchableOpacity>
=======
                        <TouchableOpacity onPress={() => router.push('/admin/audit-logs' as any)}><Ionicons name="list" size={22} color="#FFF" /></TouchableOpacity>
>>>>>>> c47eaa06d4a14b2a34217c7af5f5fbe497ab5c1d
                    </View>
                    <View style={styles.searchContainer}>
                        <View style={styles.searchBar}>
                            <Feather name="search" size={18} color="#94A3B8" />
<<<<<<< HEAD
                            <TextInput
                                placeholder="Search by order number..."
                                style={styles.searchInput}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                onSubmitEditing={() => loadOrders()}
                                returnKeyType="search"
                                placeholderTextColor="#94A3B8"
                            />
=======
                            <TextInput placeholder="Search Order ID..." style={styles.searchInput} value={searchQuery} onChangeText={setSearchQuery} placeholderTextColor="#94A3B8" />
>>>>>>> c47eaa06d4a14b2a34217c7af5f5fbe497ab5c1d
                        </View>
                    </View>
                </SafeAreaView>
            </LinearGradient>

            <View style={styles.filterSection}>
                <FlatList
                    horizontal
                    showsHorizontalScrollIndicator={false}
<<<<<<< HEAD
                    data={STATUS_FILTERS}
                    keyExtractor={i => i}
=======
                    data={['All', ...STATUS_OPTIONS]}
>>>>>>> c47eaa06d4a14b2a34217c7af5f5fbe497ab5c1d
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

<<<<<<< HEAD
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
=======
            <FlatList
                data={filteredOrders}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => (
                    <TouchableOpacity style={styles.orderCard} onPress={() => { setSelectedOrder(item); setModalVisible(true); }}>
                        <View style={styles.cardHeader}>
                            <Text style={styles.orderIdText}>#ORD-{item.id}</Text>
                            <View style={[styles.statusBadge, { backgroundColor: getStatusConfig(item.status).bg }]}>
                                <Text style={[styles.statusText, { color: getStatusConfig(item.status).color }]}>{item.status}</Text>
                            </View>
                        </View>
                        <Text style={styles.storeName}>{item.store}</Text>
                        <View style={styles.cardFooter}>
                            <Text style={styles.priceValue}>₵{item.total}</Text>
                            <Text style={styles.viewDetailsText}>Details <Feather name="chevron-right" size={12} /></Text>
                        </View>
                    </TouchableOpacity>
                )}
            />

            {/* --- MAIN DETAILS MODAL --- */}
            <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalId}>Order #ORD-{selectedOrder?.id}</Text>
                                <Text style={styles.modalDate}>{selectedOrder?.time}</Text>
                            </View>
                            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}><Ionicons name="close" size={24} color="#0C1559" /></TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <View style={styles.modalSection}>
                                <Text style={styles.sectionLabel}>Customer Information</Text>
                                <View style={styles.infoBox}>
                                    <Text style={styles.infoTitle}>{selectedOrder?.customer?.name}</Text>
                                    <Text style={styles.infoSub}>{selectedOrder?.customer?.phone}</Text>
                                    <Text style={styles.infoSub}>{selectedOrder?.customer?.address}</Text>
                                </View>
                            </View>

                            <View style={styles.modalSection}>
                                <Text style={styles.sectionLabel}>Items ordered</Text>
                                {selectedOrder?.items.map((item: any, idx: number) => (
                                    <View key={idx} style={styles.modalItemRow}>
                                        <Text style={styles.modalItemName}>{item.qty}x {item.name}</Text>
                                        <Text style={styles.modalItemPrice}>₵{item.price}</Text>
                                    </View>
                                ))}
                            </View>

                            <View style={styles.modalTotalContainer}>
                                <Text style={styles.modalTotalLabel}>Grand Total</Text>
                                <Text style={styles.modalTotalValue}>₵{selectedOrder?.total}</Text>
                            </View>

                            <View style={styles.actionRow}>
                                <TouchableOpacity style={styles.statusUpdateBtn} onPress={() => setStatusModalVisible(true)}>
                                    <Ionicons name="git-network-outline" size={20} color="#0C1559" />
                                    <Text style={styles.statusUpdateText}>Update Status</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.printBtn} onPress={() => Alert.alert("Success", "Report ready.")}>
                                    <Feather name="shield" size={18} color="#FFF" />
                                    <Text style={styles.printBtnText}>Audit</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>

                        {/* --- NESTED UPDATE STATUS MODAL (The Fix) --- */}
                        <Modal visible={statusModalVisible} animationType="fade" transparent onRequestClose={() => setStatusModalVisible(false)}>
                            <View style={styles.statusModalOverlay}>
                                <View style={styles.statusModalContent}>
                                    <LinearGradient colors={['#0C1559', '#1e3a8a']} style={styles.statusModalHeader}>
                                        <Text style={styles.statusModalTitle}>Update Order State</Text>
                                        <Text style={styles.statusModalSub}>Select progress for #ORD-{selectedOrder?.id}</Text>
                                    </LinearGradient>

                                    <View style={styles.statusOptionsList}>
                                        {STATUS_OPTIONS.map((status) => {
                                            const config = getStatusConfig(status);
                                            const isActive = selectedOrder?.status === status;
                                            return (
                                                <TouchableOpacity 
                                                    key={status} 
                                                    style={[styles.statusOptionItem, isActive && { borderColor: config.color, backgroundColor: config.bg }]}
                                                    onPress={() => updateStatusAction(status)}
                                                >
                                                    <View style={[styles.statusIconCircle, { backgroundColor: isActive ? '#FFF' : '#F1F5F9' }]}>
                                                        <Ionicons name={config.icon as any} size={20} color={config.color} />
                                                    </View>
                                                    <Text style={[styles.statusOptionLabel, isActive && { color: config.color }]}>{status}</Text>
                                                    {isActive && <Ionicons name="checkmark-circle" size={20} color={config.color} />}
                                                </TouchableOpacity>
                                            );
                                        })}
>>>>>>> c47eaa06d4a14b2a34217c7af5f5fbe497ab5c1d
                                    </View>

                                    <TouchableOpacity style={styles.statusCancelBtn} onPress={() => setStatusModalVisible(false)}>
                                        <Text style={styles.statusCancelText}>Dismiss</Text>
                                    </TouchableOpacity>
                                </View>
<<<<<<< HEAD
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
=======
                            </View>
                        </Modal>
                    </View>
                </View>
            </Modal>
>>>>>>> c47eaa06d4a14b2a34217c7af5f5fbe497ab5c1d
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
<<<<<<< HEAD
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
=======
    watermarkContainer: { position: 'absolute', bottom: -50, left: -50, opacity: 0.04 },
    fadedLogo: { width: 300, height: 300, resizeMode: 'contain' },
    header: { paddingBottom: 25, borderBottomLeftRadius: 35, borderBottomRightRadius: 35 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10 },
    backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
    headerTitleContainer: { alignItems: 'center' },
    headerLabel: { color: '#A3E635', fontSize: 10, fontFamily: 'Montserrat-Bold', letterSpacing: 1.5 },
    headerTitle: { color: '#FFF', fontSize: 18, fontFamily: 'Montserrat-Bold' },
>>>>>>> c47eaa06d4a14b2a34217c7af5f5fbe497ab5c1d
    searchContainer: { paddingHorizontal: 20, marginTop: 20 },
    searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 15, height: 50, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    searchInput: { flex: 1, marginLeft: 10, fontFamily: 'Montserrat-Medium', color: '#FFF' },
    filterSection: { marginTop: 20 },
    filterList: { paddingLeft: 20, paddingBottom: 10 },
<<<<<<< HEAD
    filterChip: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 18, backgroundColor: '#FFF', marginRight: 10, borderWidth: 1, borderColor: '#E2E8F0', elevation: 2 },
    filterChipActive: { backgroundColor: '#0C1559', borderColor: '#0C1559' },
    filterText: { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: '#64748B' },
    filterTextActive: { color: '#FFF' },
    listContent: { padding: 20, paddingBottom: 50 },
    orderCard: { backgroundColor: '#FFF', borderRadius: 24, padding: 20, marginBottom: 18, elevation: 4, shadowColor: '#0C1559', shadowOpacity: 0.08, shadowRadius: 10, borderLeftWidth: 5, borderLeftColor: '#0C1559' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 },
    orderIdText: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
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
=======
    filterChip: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 18, backgroundColor: '#FFF', marginRight: 10, borderWidth: 1, borderColor: '#E2E8F0' },
    filterChipActive: { backgroundColor: '#0C1559', borderColor: '#0C1559' },
    filterText: { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: '#64748B' },
    filterTextActive: { color: '#FFF' },
    listContent: { padding: 20 },
    orderCard: { backgroundColor: '#FFF', borderRadius: 24, padding: 20, marginBottom: 15, elevation: 3, borderLeftWidth: 5, borderLeftColor: '#0C1559' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    orderIdText: { fontSize: 15, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    statusText: { fontSize: 9, fontFamily: 'Montserrat-Bold', textTransform: 'uppercase' },
    storeName: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: '#64748B', marginTop: 5 },
    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15, borderTopWidth: 1, borderTopColor: '#F8FAFC', paddingTop: 10 },
    priceValue: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
    viewDetailsText: { fontSize: 11, fontFamily: 'Montserrat-Bold', color: '#0C1559' },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(12, 21, 89, 0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 35, borderTopRightRadius: 35, padding: 25, height: height * 0.75 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
    modalId: { fontSize: 20, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
    modalDate: { fontSize: 12, color: '#94A3B8' },
    closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
    modalSection: { marginBottom: 25 },
    sectionLabel: { fontSize: 12, fontFamily: 'Montserrat-Bold', color: '#94A3B8', textTransform: 'uppercase', marginBottom: 10 },
    infoBox: { backgroundColor: '#F8FAFC', padding: 15, borderRadius: 15, borderWidth: 1, borderColor: '#F1F5F9' },
    infoTitle: { fontSize: 15, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
    infoSub: { fontSize: 13, color: '#64748B', marginTop: 3 },
    modalItemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
    modalItemName: { fontSize: 14, fontFamily: 'Montserrat-SemiBold', color: '#334155' },
    modalItemPrice: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
    modalTotalContainer: { marginTop: 10, padding: 20, backgroundColor: '#0C1559', borderRadius: 20, alignItems: 'center' },
    modalTotalLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
    modalTotalValue: { color: '#FFF', fontSize: 28, fontFamily: 'Montserrat-Bold', marginTop: 5 },
    actionRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
    statusUpdateBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9', padding: 15, borderRadius: 15, gap: 8, borderWidth: 1, borderColor: '#E2E8F0' },
    statusUpdateText: { color: '#0C1559', fontFamily: 'Montserrat-Bold' },
    printBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0C1559', padding: 15, borderRadius: 15, gap: 8 },
    printBtnText: { color: '#FFF', fontFamily: 'Montserrat-Bold' },

    statusModalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'center', alignItems: 'center' },
    statusModalContent: { width: width * 0.85, backgroundColor: '#FFF', borderRadius: 30, overflow: 'hidden', elevation: 20 },
    statusModalHeader: { padding: 25, alignItems: 'center' },
    statusModalTitle: { color: '#FFF', fontSize: 18, fontFamily: 'Montserrat-Bold' },
    statusModalSub: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontFamily: 'Montserrat-Medium', marginTop: 5, textAlign: 'center' },
    statusOptionsList: { padding: 15 },
    statusOptionItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 18, marginBottom: 10, borderWidth: 1, borderColor: '#F1F5F9' },
    statusIconCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    statusOptionLabel: { flex: 1, fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#334155' },
    statusCancelBtn: { padding: 20, borderTopWidth: 1, borderTopColor: '#F1F5F9', alignItems: 'center' },
    statusCancelText: { color: '#94A3B8', fontFamily: 'Montserrat-Bold', fontSize: 13 }
>>>>>>> c47eaa06d4a14b2a34217c7af5f5fbe497ab5c1d
});