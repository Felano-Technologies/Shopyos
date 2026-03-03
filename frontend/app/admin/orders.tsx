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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';

const { width, height } = Dimensions.get('window');
const STATUS_OPTIONS = ['Pending', 'Processing', 'Delivered', 'Cancelled'];

export default function AdminOrders() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeStatus, setActiveStatus] = useState('All');
    
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
                        <TouchableOpacity onPress={() => router.push('/admin/audit-logs' as any)}><Ionicons name="list" size={22} color="#FFF" /></TouchableOpacity>
                    </View>
                    <View style={styles.searchContainer}>
                        <View style={styles.searchBar}>
                            <Feather name="search" size={18} color="#94A3B8" />
                            <TextInput placeholder="Search Order ID..." style={styles.searchInput} value={searchQuery} onChangeText={setSearchQuery} placeholderTextColor="#94A3B8" />
                        </View>
                    </View>
                </SafeAreaView>
            </LinearGradient>

            <View style={styles.filterSection}>
                <FlatList
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    data={['All', ...STATUS_OPTIONS]}
                    contentContainerStyle={styles.filterList}
                    renderItem={({ item }) => (
                        <TouchableOpacity 
                            style={[styles.filterChip, activeStatus === item && styles.filterChipActive]}
                            onPress={() => setActiveStatus(item)}
                        >
                            <Text style={[styles.filterText, activeStatus === item && styles.filterTextActive]}>{item}</Text>
                        </TouchableOpacity>
                    )}
                />
            </View>

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
                                    </View>

                                    <TouchableOpacity style={styles.statusCancelBtn} onPress={() => setStatusModalVisible(false)}>
                                        <Text style={styles.statusCancelText}>Dismiss</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </Modal>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    watermarkContainer: { position: 'absolute', bottom: -50, left: -50, opacity: 0.04 },
    fadedLogo: { width: 300, height: 300, resizeMode: 'contain' },
    header: { paddingBottom: 25, borderBottomLeftRadius: 35, borderBottomRightRadius: 35 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10 },
    backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
    headerTitleContainer: { alignItems: 'center' },
    headerLabel: { color: '#A3E635', fontSize: 10, fontFamily: 'Montserrat-Bold', letterSpacing: 1.5 },
    headerTitle: { color: '#FFF', fontSize: 18, fontFamily: 'Montserrat-Bold' },
    searchContainer: { paddingHorizontal: 20, marginTop: 20 },
    searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 15, height: 50, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    searchInput: { flex: 1, marginLeft: 10, fontFamily: 'Montserrat-Medium', color: '#FFF' },
    filterSection: { marginTop: 20 },
    filterList: { paddingLeft: 20, paddingBottom: 10 },
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
});