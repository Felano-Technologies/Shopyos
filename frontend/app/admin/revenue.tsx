import React, { useState } from 'react';
import { 
    View, 
    Text, 
    StyleSheet, 
    FlatList, 
    TouchableOpacity, 
    Image, 
    Dimensions,
    TextInput 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { format } from 'date-fns';

const { width } = Dimensions.get('window');

export default function AdminRevenue() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');

    // Mock Financial Data
    const transactions = [
        { id: '1', type: 'Commission', target: 'Order #7721', amount: '15.50', date: new Date(), status: 'Credit' },
        { id: '2', type: 'Platform Fee', target: 'Electronics Hub Hub', amount: '150.00', date: new Date(Date.now() - 3600000), status: 'Credit' },
        { id: '3', type: 'Payout', target: 'Fresh Grocery', amount: '450.00', date: new Date(Date.now() - 86400000), status: 'Debit' },
        { id: '4', type: 'Commission', target: 'Order #8812', amount: '42.20', date: new Date(Date.now() - 172800000), status: 'Credit' },
    ];

    const filteredTransactions = transactions.filter(t => 
        t.target.toLowerCase().includes(searchQuery.toLowerCase()) || 
        t.type.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <View style={styles.container}>
            <StatusBar style="light" />

            {/* --- BACKGROUND WATERMARK --- */}
            <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
                <View style={styles.watermarkContainer}>
                    <Image source={require('../../assets/images/splash-icon.png')} style={styles.fadedLogo} />
                </View>
            </View>

            {/* --- HEADER & BALANCE HERO --- */}
            <LinearGradient colors={['#0C1559', '#1e3a8a']} style={styles.header}>
                <SafeAreaView edges={['top', 'left', 'right']}>
                    <View style={styles.headerRow}>
                        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                            <Ionicons name="arrow-back" size={24} color="#FFF" />
                        </TouchableOpacity>
                        <View style={styles.headerTitleContainer}>
                            <Text style={styles.headerLabel}>FINANCIAL OVERVIEW</Text>
                            <Text style={styles.headerTitle}>Revenue Tracker</Text>
                        </View>
                        <TouchableOpacity style={styles.headerIconBtn}>
                            <Feather name="download" size={20} color="#FFF" />
                        </TouchableOpacity>
                    </View>

                    {/* Balance Hero Section */}
                    <View style={styles.balanceHero}>
                        <View>
                            <Text style={styles.balanceLabel}>Total Platform Earnings</Text>
                            <Text style={styles.balanceValue}>₵45,230.00</Text>
                        </View>
                        <View style={styles.balanceTrend}>
                            <Feather name="trending-up" size={16} color="#A3E635" />
                            <Text style={styles.trendText}>+12.5%</Text>
                        </View>
                    </View>
                </SafeAreaView>
            </LinearGradient>

            {/* --- SEARCH & QUICK STATS --- */}
            <View style={styles.searchSection}>
                <View style={styles.searchBar}>
                    <Feather name="search" size={18} color="#94A3B8" />
                    <TextInput 
                        placeholder="Search transactions..." 
                        style={styles.searchInput}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholderTextColor="#94A3B8"
                    />
                </View>
            </View>

            {/* --- TRANSACTION LIST --- */}
            <View style={styles.listHeader}>
                <Text style={styles.sectionTitle}>Transaction History</Text>
                <TouchableOpacity><Text style={styles.filterText}>Filter</Text></TouchableOpacity>
            </View>

            <FlatList
                data={filteredTransactions}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => (
                    <View style={styles.transCard}>
                        <View style={[styles.iconBg, { backgroundColor: item.status === 'Credit' ? '#DCFCE7' : '#FEE2E2' }]}>
                            <MaterialCommunityIcons 
                                name={item.status === 'Credit' ? "arrow-bottom-left" : "arrow-top-right"} 
                                size={20} 
                                color={item.status === 'Credit' ? "#15803D" : "#B91C1C"} 
                            />
                        </View>
                        
                        <View style={{ flex: 1, marginLeft: 15 }}>
                            <Text style={styles.transTarget}>{item.target}</Text>
                            <Text style={styles.transType}>{item.type} • {format(item.date, 'MMM dd')}</Text>
                        </View>

                        <View style={{ alignItems: 'flex-end' }}>
                            <Text style={[styles.transAmount, { color: item.status === 'Credit' ? '#15803D' : '#0F172A' }]}>
                                {item.status === 'Credit' ? '+' : '-'}₵{item.amount}
                            </Text>
                            <Text style={styles.transStatus}>{item.status}</Text>
                        </View>
                    </View>
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    
    // Watermark
    watermarkContainer: { position: 'absolute', bottom: -50, right: -50, opacity: 0.04 },
    fadedLogo: { width: 300, height: 300, resizeMode: 'contain' },

    // Header & Hero
    header: { paddingBottom: 30, borderBottomLeftRadius: 35, borderBottomRightRadius: 35, elevation: 12 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10 },
    backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
    headerTitleContainer: { alignItems: 'center' },
    headerLabel: { color: '#A3E635', fontSize: 10, fontFamily: 'Montserrat-Bold', letterSpacing: 1.5 },
    headerTitle: { color: '#FFF', fontSize: 18, fontFamily: 'Montserrat-Bold' },
    headerIconBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },

    balanceHero: { marginTop: 30, paddingHorizontal: 30, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
    balanceLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontFamily: 'Montserrat-Medium' },
    balanceValue: { color: '#FFF', fontSize: 36, fontFamily: 'Montserrat-Bold', marginTop: 5 },
    balanceTrend: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(163, 230, 53, 0.15)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, gap: 5, marginBottom: 8 },
    trendText: { color: '#A3E635', fontSize: 12, fontFamily: 'Montserrat-Bold' },

    // Search
    searchSection: { paddingHorizontal: 20, marginTop: -25, zIndex: 10 },
    searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingHorizontal: 15, height: 50, borderRadius: 15, elevation: 5, shadowColor: '#0C1559', shadowOpacity: 0.1, shadowRadius: 10 },
    searchInput: { flex: 1, marginLeft: 10, fontFamily: 'Montserrat-Medium', color: '#0F172A' },

    // List
    listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 25, marginTop: 25, marginBottom: 15 },
    sectionTitle: { fontSize: 15, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
    filterText: { fontSize: 12, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
    
    listContent: { paddingHorizontal: 20, paddingBottom: 40 },
    transCard: { backgroundColor: '#FFF', padding: 16, borderRadius: 22, marginBottom: 12, flexDirection: 'row', alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOpacity: 0.03 },
    iconBg: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    transTarget: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
    transType: { fontSize: 11, color: '#94A3B8', fontFamily: 'Montserrat-Medium', marginTop: 2 },
    transAmount: { fontSize: 15, fontFamily: 'Montserrat-Bold' },
    transStatus: { fontSize: 9, fontFamily: 'Montserrat-Bold', color: '#94A3B8', textTransform: 'uppercase', marginTop: 2 }
});