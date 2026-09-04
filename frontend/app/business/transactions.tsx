import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput
} from 'react-native';
import AppImage from '@/components/AppImage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useSellerGuard } from '@/hooks/useSellerGuard';
import { getSellerTransactions, storage } from '@/services/api';
import { format } from 'date-fns';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';

// Map a balance_logs row to the shape this screen renders
function mapLogToItem(log: any) {
  const amount = Number.parseFloat(log.amount);
  const type =
    log.transaction_type === 'sale' ? 'sale'
    : log.transaction_type === 'withdrawal' || log.transaction_type === 'payout' ? 'payout'
    : log.transaction_type === 'refund' ? 'refund'
    : log.transaction_type;

  let title = 'Balance adjustment';
  if (type === 'sale')   title = log.order_number ? `Order #${log.order_number} Payment` : 'Order payment';
  if (type === 'payout') title = log.payout_method ? `Payout (${log.payout_method})` : 'Payout';
  if (type === 'refund') title = log.order_number ? `Refund: Order #${log.order_number}` : 'Refund';

  const d = new Date(log.created_at);
  return {
    id: log.id,
    title,
    type,
    amount,
    date: Number.isNaN(d.getTime()) ? '' : format(d, 'MMM dd, yyyy'),
    time: Number.isNaN(d.getTime()) ? '' : format(d, 'h:mm a'),
    status: type === 'payout' ? (log.payout_status || 'Processing') : 'Success',
  };
}

export default function TransactionsScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [filter, setFilter] = useState('All');
  const [searchText, setSearchText] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const { isChecking } = useSellerGuard();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const storeId = await storage.getItem('currentBusinessId');
      if (!storeId) {
        setLoadError('No active store selected.');
        return;
      }
      const res = await getSellerTransactions(storeId, { limit: 100 });
      setTransactions((res?.transactions || []).map(mapLogToItem));
    } catch (e: any) {
      setLoadError(e.message || 'Failed to load transactions.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadData();
    } finally {
      setRefreshing(false);
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
    let iconColor = colors.success; // Green for sales
    let bgColor = '#DCFCE7'; // light green tint, no themed "success background" token exists

    if (isPayout) {
        iconName = 'arrow-up-circle';
        iconColor = colors.primary; // Blue for payout
        bgColor = '#E0E7FF'; // light indigo tint, no themed "primary background" token exists
    } else if (item.type === 'refund') {
        iconName = 'refresh-circle';
        iconColor = colors.error; // Red for refund
        bgColor = colors.errorBg;
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
                { color: isPositive ? colors.success : colors.text } // Green for money in, Dark for money out
            ]}>
                {isPositive ? '+' : ''}₵{Math.abs(item.amount).toFixed(2)}
            </Text>
            <Text style={styles.status}>{item.status}</Text>
        </View>
      </View>
    );
  };

  // --- Render Empty / Error State ---
  const renderEmptyComponent = () => (
    <View style={styles.emptyState}>
        <View style={styles.emptyIconCircle}>
            <MaterialCommunityIcons
              name={loadError ? 'wifi-off' : 'receipt'}
              size={60}
              color={colors.textMuted}
            />
        </View>
        <Text style={styles.emptyTitle}>
          {loadError ? "Couldn't load transactions" : 'No Transactions Yet'}
        </Text>
        <Text style={styles.emptyText}>
          {loadError || 'When you make sales or receive payouts, they will appear here.'}
        </Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={loadData}>
            <Text style={styles.refreshText}>{loadError ? 'Retry' : 'Refresh Data'}</Text>
        </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.mainContainer}>
      <StatusBar style="light" /> {/* header gradient is always dark navy in both themes */}

      {/* Background Watermark */}
      <View style={StyleSheet.absoluteFillObject}>
        <View style={styles.bottomLogos}>
          <AppImage source={require('../../assets/images/splash-icon.png')} style={styles.fadedLogo} />
        </View>
      </View>

      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        
        {/* --- Header --- */}
        <LinearGradient
            colors={colors.headerGradient}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.headerContainer}
        >
            <SafeAreaView edges={['top']} style={{ width: '100%' }}>
                <View style={styles.headerContent}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={24} color="#FFF" />{/* white icon on the fixed dark header gradient */}
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Transactions</Text>
                    <View style={{ width: 40 }} /> 
                </View>
            </SafeAreaView>
        </LinearGradient>

        <View style={styles.contentContainer}>
            
            {/* Search Bar */}
            <View style={styles.searchBar}>
                <Ionicons name="search" size={20} color={colors.textMuted} />
                <TextInput
                    placeholder="Search transactions..."
                    placeholderTextColor={colors.textMuted}
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
            {isChecking || loading ? (
                <View style={{ marginTop: 50 }}>
                    <ActivityIndicator size="large" color={colors.primary} />
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
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                />
            )}
        </View>

      </SafeAreaView>
    </View>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: colors.backgroundAlt },
  safeArea: { flex: 1 },

  // Background
  bottomLogos: { position: 'absolute', bottom: 20, left: -20 },
  fadedLogo: { width: 150, height: 150, resizeMode: 'contain', opacity: 0.03 },

  // Header
  headerContainer: {
    paddingBottom: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    marginBottom: 10,
    shadowColor: colors.primary,
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
      backgroundColor: colors.surface,
      marginHorizontal: 20,
      marginTop: 10,
      borderRadius: 12,
      paddingHorizontal: 12,
      height: 45,
      borderWidth: 1,
      borderColor: colors.borderStrong,
  },
  searchInput: {
      flex: 1,
      marginLeft: 10,
      fontFamily: 'Montserrat-Medium',
      fontSize: 14,
      color: colors.text,
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
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderStrong,
  },
  filterChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
  },
  filterText: {
      fontSize: 12,
      fontFamily: 'Montserrat-Medium',
      color: colors.textSecondary,
  },
  filterTextActive: {
      color: colors.textInverse,
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
      backgroundColor: colors.surface,
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
      color: colors.text,
      marginBottom: 4,
  },
  cardDate: {
      fontSize: 11,
      fontFamily: 'Montserrat-Regular',
      color: colors.textMuted,
  },
  amount: {
      fontSize: 14,
      fontFamily: 'Montserrat-Bold',
      marginBottom: 4,
  },
  status: {
      fontSize: 10,
      fontFamily: 'Montserrat-Medium',
      color: colors.textSecondary,
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
      backgroundColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 20,
  },
  emptyTitle: {
      fontSize: 18,
      fontFamily: 'Montserrat-Bold',
      color: colors.text,
      marginBottom: 8,
  },
  emptyText: {
      fontSize: 14,
      fontFamily: 'Montserrat-Regular',
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 20,
  },
  refreshBtn: {
      backgroundColor: colors.backgroundAlt,
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 12,
  },
  refreshText: {
      color: colors.primary,
      fontFamily: 'Montserrat-Bold',
      fontSize: 14,
  },
});