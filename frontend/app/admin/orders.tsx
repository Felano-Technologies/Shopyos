import React, { useState } from 'react';
import { 
    View, 
    Text, 
    StyleSheet, 
    FlatList, 
    TouchableOpacity, 
    TextInput, 
    Image, 
    Dimensions 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';

const { width } = Dimensions.get('window');
const STATUS_FILTERS = ['All', 'Pending', 'Processing', 'Delivered', 'Cancelled'];

export default function AdminOrders() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeStatus, setActiveStatus] = useState('All');

    // Mock Data
    const orders = [
        { id: '7721', store: 'Fresh Grocery', total: '450.00', status: 'Processing', time: '2 mins ago', items: 4 },
        { id: '8812', store: 'Electronics Hub', total: '1,200.00', status: 'Pending', time: '15 mins ago', items: 1 },
        { id: '9901', store: 'Fashion Central', total: '85.00', status: 'Delivered', time: '1 hour ago', items: 2 },
        { id: '6542', store: 'Urban Eats', total: '120.00', status: 'Cancelled', time: '3 hours ago', items: 3 },
    ];

    const filteredOrders = orders.filter(order => {
        const matchesSearch = order.id.includes(searchQuery) || order.store.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = activeStatus === 'All' || order.status === activeStatus;
        return matchesSearch && matchesStatus;
    });

    const getStatusConfig = (status: string) => {
        switch (status) {
            case 'Delivered': return { color: '#15803D', bg: '#DCFCE7', icon: 'checkmark-circle' };
            case 'Processing': return { color: '#1E40AF', bg: '#DBEAFE', icon: 'sync' };
            case 'Pending': return { color: '#B45309', bg: '#FEF3C7', icon: 'time' };
            case 'Cancelled': return { color: '#B91C1C', bg: '#FEE2E2', icon: 'close-circle' };
            default: return { color: '#64748B', bg: '#F1F5F9', icon: 'help-circle' };
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar style="light" />

            {/* --- BACKGROUND WATERMARK --- */}
            <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
                <View style={styles.watermarkContainer}>
                    <Image source={require('../../assets/images/splash-icon.png')} style={styles.fadedLogo} />
                </View>
            </View>

            {/* --- HEADER --- */}
            <LinearGradient colors={['#0C1559', '#1e3a8a']} style={styles.header}>
                <SafeAreaView edges={['top', 'left', 'right']}>
                    <View style={styles.headerRow}>
                        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                            <Ionicons name="arrow-back" size={24} color="#FFF" />
                        </TouchableOpacity>
                        <View style={styles.headerTitleContainer}>
                            <Text style={styles.headerLabel}>ADMINISTRATION</Text>
                            <Text style={styles.headerTitle}>Order Management</Text>
                        </View>
                        <TouchableOpacity style={styles.headerIconBtn}>
                            <Feather name="download" size={20} color="#FFF" />
                        </TouchableOpacity>
                    </View>

                    {/* Search Bar inside Header Area */}
                    <View style={styles.searchContainer}>
                        <View style={styles.searchBar}>
                            <Feather name="search" size={18} color="#94A3B8" />
                            <TextInput 
                                placeholder="Search by Order ID or Store..." 
                                style={styles.searchInput}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                placeholderTextColor="#94A3B8"
                            />
                        </View>
                    </View>
                </SafeAreaView>
            </LinearGradient>

            {/* --- STATUS FILTERS --- */}
            <View style={styles.filterSection}>
                <FlatList
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    data={STATUS_FILTERS}
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

            {/* --- ORDERS LIST --- */}
            <FlatList
                data={filteredOrders}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => {
                    const config = getStatusConfig(item.status);
                    return (
                        <TouchableOpacity 
                            style={styles.orderCard}
                            onPress={() => router.push(`/order/${item.id}` as any)}
                        >
                            <View style={styles.cardHeader}>
                                <View>
                                    <Text style={styles.orderIdText}>#ORD-{item.id}</Text>
                                    <Text style={styles.timeText}>{item.time}</Text>
                                </View>
                                <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
                                    <Ionicons name={config.icon as any} size={12} color={config.color} />
                                    <Text style={[styles.statusText, { color: config.color }]}>{item.status}</Text>
                                </View>
                            </View>

                            <View style={styles.cardBody}>
                                <View style={styles.storeRow}>
                                    <View style={styles.storeIconBg}>
                                        <MaterialCommunityIcons name="storefront-outline" size={18} color="#0C1559" />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <Text style={styles.storeName}>{item.store}</Text>
                                        <Text style={styles.itemCount}>{item.items} {item.items === 1 ? 'item' : 'items'} in package</Text>
                                    </View>
                                    <View style={styles.priceContainer}>
                                        <Text style={styles.priceLabel}>Total Amount</Text>
                                        <Text style={styles.priceValue}>₵{item.total}</Text>
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
                    <View style={styles.emptyState}>
                        <MaterialCommunityIcons name="cart-off" size={60} color="#CBD5E1" />
                        <Text style={styles.emptyText}>No orders found matching your search.</Text>
                    </View>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    
    // Watermark
    watermarkContainer: { position: 'absolute', bottom: -50, left: -50, opacity: 0.04 },
    fadedLogo: { width: 300, height: 300, resizeMode: 'contain' },

    // Header
    header: { paddingBottom: 25, borderBottomLeftRadius: 35, borderBottomRightRadius: 35, elevation: 10 },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10 },
    backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
    headerTitleContainer: { alignItems: 'center' },
    headerLabel: { color: '#A3E635', fontSize: 10, fontFamily: 'Montserrat-Bold', letterSpacing: 1.5 },
    headerTitle: { color: '#FFF', fontSize: 18, fontFamily: 'Montserrat-Bold', marginTop: 2 },
    headerIconBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    
    // Search
    searchContainer: { paddingHorizontal: 20, marginTop: 20 },
    searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 15, height: 50, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    searchInput: { flex: 1, marginLeft: 10, fontFamily: 'Montserrat-Medium', color: '#FFF' },

    // Filters
    filterSection: { marginTop: 20 },
    filterList: { paddingLeft: 20, paddingBottom: 10 },
    filterChip: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 18, backgroundColor: '#FFF', marginRight: 10, borderWidth: 1, borderColor: '#E2E8F0', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05 },
    filterChipActive: { backgroundColor: '#0C1559', borderColor: '#0C1559' },
    filterText: { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: '#64748B' },
    filterTextActive: { color: '#FFF' },

    // List & Cards
    listContent: { padding: 20, paddingBottom: 50 },
    orderCard: { backgroundColor: '#FFF', borderRadius: 24, padding: 20, marginBottom: 18, elevation: 4, shadowColor: '#0C1559', shadowOpacity: 0.08, shadowRadius: 10, borderLeftWidth: 5, borderLeftColor: '#0C1559' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 },
    orderIdText: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
    timeText: { fontSize: 11, fontFamily: 'Montserrat-Medium', color: '#94A3B8', marginTop: 2 },
    statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, gap: 5 },
    statusText: { fontSize: 10, fontFamily: 'Montserrat-Bold', textTransform: 'uppercase' },

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

    emptyState: { alignItems: 'center', marginTop: 60 },
    emptyText: { marginTop: 15, color: '#94A3B8', fontFamily: 'Montserrat-Medium', textAlign: 'center', paddingHorizontal: 40 }
});