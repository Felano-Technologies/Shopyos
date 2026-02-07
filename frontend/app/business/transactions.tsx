import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';

// --- MOCK API ---
const fetchTransactions = async () => {
  return new Promise<{ data: any[] }>((resolve) => {
    setTimeout(() => {
      
      // --- 🎚️ TOGGLE THIS VALUE TO SEE EMPTY VS ACTIVE STATE ---
      const SHOW_EMPTY_STATE = true; 

      if (SHOW_EMPTY_STATE) {
        resolve({ data: [] });
      } else {
        const mockData = [
          { id: '1', title: 'Order #2034 Payment', type: 'sale', amount: 450.00, date: 'Feb 07, 2026', time: '10:45 AM', status: 'Success' },
          { id: '2', title: 'Weekly Payout', type: 'payout', amount: -1200.00, date: 'Feb 01, 2026', time: '09:00 AM', status: 'Success' },
          { id: '3', title: 'Order #2033 Payment', type: 'sale', amount: 85.50, date: 'Jan 30, 2026', time: '02:15 PM', status: 'Success' },
          { id: '4', title: 'Refund: Order #2010', type: 'refund', amount: -120.00, date: 'Jan 28, 2026', time: '11:30 AM', status: 'Completed' },
          { id: '5', title: 'Order #2032 Payment', type: 'sale', amount: 210.00, date: 'Jan 28, 2026', time: '09:10 AM', status: 'Success' },
        ];
        resolve({ data: mockData });
      }
    }, 1000);
  });
};

export default function TransactionsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [filter, setFilter] = useState('All');
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchTransactions();
      setTransactions(res.data);
    } finally {
      setLoading(false);
    }
  };

  // --- Filtering Logic ---
  const getFilteredData = () => {
    let data = transactions;

    // 1. Filter by Type
    if (filter === 'Sales') data = data.filter(t => t.type === 'sale');
    if (filter === 'Payouts') data = data.filter(t => t.type === 'payout');

    // 2. Search
    if (searchText) {
      data = data.filter(t => t.title.toLowerCase().includes(searchText.toLowerCase()));
    }

    return data;
  };

  const filteredData = getFilteredData();

  // --- Render Item ---
  const renderItem = ({ item }: { item: any }) => {
    const isPositive = item.type === 'sale';
    const isPayout = item.type === 'payout';
    
    let iconName = 'arrow-down-circle';
    let iconColor = '#16A34A'; // Green for sales
    let bgColor = '#DCFCE7';

    if (isPayout) {
        iconName = 'arrow-up-circle';
        iconColor = '#0C1559'; // Blue for payout
        bgColor = '#E0E7FF';
    } else if (item.type === 'refund') {
        iconName = 'refresh-circle';
        iconColor = '#EF4444'; // Red for refund
        bgColor = '#FEE2E2';
    }

    return (
      <View style={styles.card}>
        <View style={[styles.iconBox, { backgroundColor: bgColor }]}>
            <Ionicons name={iconName as any} size={24} color={iconColor} />
        </View>
        <View style={styles.cardInfo}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardDate}>{item.date} • {item.time}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
            <Text style={[
                styles.amount, 
                { color: isPositive ? '#16A34A' : '#0F172A' } // Green for money in, Dark for money out
            ]}>
                {isPositive ? '+' : ''}₵{Math.abs(item.amount).toFixed(2)}
            </Text>
            <Text style={styles.status}>{item.status}</Text>
        </View>
      </View>
    );
  };

  // --- Render Empty State ---
  const renderEmptyComponent = () => (
    <View style={styles.emptyState}>
        <View style={styles.emptyIconCircle}>
            <MaterialCommunityIcons name="receipt" size={60} color="#CBD5E1" />
        </View>
        <Text style={styles.emptyTitle}>No Transactions Yet</Text>
        <Text style={styles.emptyText}>
            When you make sales or receive payouts, they will appear here.
        </Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={loadData}>
            <Text style={styles.refreshText}>Refresh Data</Text>
        </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.mainContainer}>
      <StatusBar style="light" />
      
      {/* Background Watermark */}
      <View style={StyleSheet.absoluteFillObject}>
        <View style={styles.bottomLogos}>
          <Image source={require('../../assets/images/splash-icon.png')} style={styles.fadedLogo} />
        </View>
      </View>

      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        
        {/* --- Header --- */}
        <LinearGradient
            colors={['#0C1559', '#1e3a8a']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.headerContainer}
        >
            <SafeAreaView edges={['top']} style={{ width: '100%' }}>
                <View style={styles.headerContent}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={24} color="#FFF" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Transactions</Text>
                    <View style={{ width: 40 }} /> 
                </View>
            </SafeAreaView>
        </LinearGradient>

        <View style={styles.contentContainer}>
            
            {/* Search Bar */}
            <View style={styles.searchBar}>
                <Ionicons name="search" size={20} color="#94A3B8" />
                <TextInput 
                    placeholder="Search transactions..." 
                    placeholderTextColor="#94A3B8"
                    style={styles.searchInput}
                    value={searchText}
                    onChangeText={setSearchText}
                />
            </View>

            {/* Filters */}
            <View style={styles.filterRow}>
                {['All', 'Sales', 'Payouts'].map((tab) => (
                    <TouchableOpacity 
                        key={tab} 
                        style={[styles.filterChip, filter === tab && styles.filterChipActive]}
                        onPress={() => setFilter(tab)}
                    >
                        <Text style={[styles.filterText, filter === tab && styles.filterTextActive]}>{tab}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* List */}
            {loading ? (
                <View style={{ marginTop: 50 }}>
                    <ActivityIndicator size="large" color="#0C1559" />
                </View>
            ) : (
                <FlatList 
                    data={filteredData}
                    keyExtractor={item => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={[
                        styles.listContent,
                        filteredData.length === 0 && { flex: 1, justifyContent: 'center' }
                    ]}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={renderEmptyComponent}
                />
            )}
        </View>

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#F8FAFC' },
  safeArea: { flex: 1 },

  // Background
  bottomLogos: { position: 'absolute', bottom: 20, left: -20 },
  fadedLogo: { width: 150, height: 150, resizeMode: 'contain', opacity: 0.08 },

  // Header
  headerContainer: {
    paddingBottom: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    marginBottom: 10,
    shadowColor: "#0C1559",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Montserrat-Bold',
    color: '#FFF',
  },

  // Content
  contentContainer: { flex: 1 },
  
  // Search
  searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FFF',
      marginHorizontal: 20,
      marginTop: 10,
      borderRadius: 12,
      paddingHorizontal: 12,
      height: 45,
      borderWidth: 1,
      borderColor: '#E2E8F0',
  },
  searchInput: {
      flex: 1,
      marginLeft: 10,
      fontFamily: 'Montserrat-Medium',
      fontSize: 14,
      color: '#0F172A',
  },

  // Filter Chips
  filterRow: {
      flexDirection: 'row',
      paddingHorizontal: 20,
      marginTop: 15,
      marginBottom: 10,
      gap: 10,
  },
  filterChip: {
      paddingVertical: 6,
      paddingHorizontal: 16,
      borderRadius: 20,
      backgroundColor: '#FFF',
      borderWidth: 1,
      borderColor: '#E2E8F0',
  },
  filterChipActive: {
      backgroundColor: '#0C1559',
      borderColor: '#0C1559',
  },
  filterText: {
      fontSize: 12,
      fontFamily: 'Montserrat-Medium',
      color: '#64748B',
  },
  filterTextActive: {
      color: '#FFF',
      fontFamily: 'Montserrat-Bold',
  },

  // List
  listContent: {
      paddingHorizontal: 20,
      paddingBottom: 40,
  },
  card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FFF',
      borderRadius: 16,
      padding: 15,
      marginBottom: 12,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
  },
  iconBox: {
      width: 45,
      height: 45,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 15,
  },
  cardInfo: { flex: 1 },
  cardTitle: {
      fontSize: 14,
      fontFamily: 'Montserrat-Bold',
      color: '#0F172A',
      marginBottom: 4,
  },
  cardDate: {
      fontSize: 11,
      fontFamily: 'Montserrat-Regular',
      color: '#94A3B8',
  },
  amount: {
      fontSize: 14,
      fontFamily: 'Montserrat-Bold',
      marginBottom: 4,
  },
  status: {
      fontSize: 10,
      fontFamily: 'Montserrat-Medium',
      color: '#64748B',
  },

  // Empty State
  emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 40,
      paddingHorizontal: 40,
  },
  emptyIconCircle: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: '#F1F5F9',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 20,
  },
  emptyTitle: {
      fontSize: 18,
      fontFamily: 'Montserrat-Bold',
      color: '#0F172A',
      marginBottom: 8,
  },
  emptyText: {
      fontSize: 14,
      fontFamily: 'Montserrat-Regular',
      color: '#64748B',
      textAlign: 'center',
      marginBottom: 20,
  },
  refreshBtn: {
      backgroundColor: '#E0E7FF',
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 12,
  },
  refreshText: {
      color: '#0C1559',
      fontFamily: 'Montserrat-Bold',
      fontSize: 14,
  },
});