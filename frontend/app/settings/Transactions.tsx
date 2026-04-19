import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  StatusBar
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { getMyOrders } from '@/services/api';
// --- Types ---
interface Transaction {
  id: string;
  title: string;
  type: 'order' | 'refund' | 'topup' | 'withdrawal';
  amount: number;
  date: string;
  status: 'completed' | 'pending' | 'failed';
  paymentMethod: string;
}
export default function SettingsTransactionsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  useEffect(() => {
    fetchTransactions();
  }, []);
  const fetchTransactions = async () => {
    try {
      const response = await getMyOrders();
      if (response && response.success) {
        const mappedData: Transaction[] = response.orders.map((order: any) => ({
          id: order.id,
          title: `Order #${order.order_number}`,
          type: 'order',
          amount: parseFloat(order.total_amount),
          date: order.created_at,
          status: order.status === 'paid' || order.status === 'completed' ? 'completed' :
            order.status === 'cancelled' ? 'failed' : 'pending',
          paymentMethod: order.payments?.[0]?.payment_method || 'Other'
        }));
        setTransactions(mappedData);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };
  // Helper to format currency
  const formatCurrency = (amount: number) => {
    return `₵${Math.abs(amount).toFixed(2)}`;
  };
  // Helper to format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  // Render Single Transaction Item
  const renderItem = ({ item }: { item: Transaction }) => {
    const isCredit = item.type === 'topup' || item.type === 'refund';
    // Icon Logic
    let iconName: any = 'shopping-bag';
    let iconColor = '#0C1559';
    let iconBg = '#E0E7FF';
    if (item.type === 'topup') { iconName = 'wallet'; iconColor = '#16A34A'; iconBg = '#DCFCE7'; }
    if (item.type === 'refund') { iconName = 'refresh-cw'; iconColor = '#EA580C'; iconBg = '#FFEDD5'; }
    if (item.status === 'failed') { iconName = 'alert-circle'; iconColor = '#DC2626'; iconBg = '#FEE2E2'; }
    return (
      <View style={styles.card}>
        {/* Icon */}
        <View style={[styles.iconContainer, { backgroundColor: iconBg }]}>
          <Feather name={iconName} size={20} color={iconColor} />
        </View>
        {/* Details */}
        <View style={styles.detailsContainer}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.cardDate}>{formatDate(item.date)} • {item.paymentMethod}</Text>
        </View>
        {/* Amount & Status */}
        <View style={styles.rightContainer}>
          <Text style={[
            styles.amountText,
            { color: isCredit ? '#16A34A' : '#0F172A' }
          ]}>
            {isCredit ? '+' : '-'} {formatCurrency(item.amount)}
          </Text>
          <View style={[
            styles.statusBadge,
            item.status === 'completed' ? styles.statusSuccess :
              item.status === 'pending' ? styles.statusPending : styles.statusFailed
          ]}>
            <Text style={[
              styles.statusText,
              item.status === 'completed' ? styles.textSuccess :
                item.status === 'pending' ? styles.textPending : styles.textFailed
            ]}>
              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </Text>
          </View>
        </View>
      </View>
    );
  };
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C1559" />
      <Stack.Screen options={{ headerShown: false }} />
      {/* --- Header --- */}
      <View style={styles.header}>
        <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeHeader}>
          <View style={styles.navBar}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color="#A3E635" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Transactions</Text>
            <View style={{ width: 40 }} />
          </View>
        </SafeAreaView>
      </View>
      {/* --- Content --- */}
      <View style={styles.contentContainer}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0C1559" />
            <Text style={styles.loadingText}>Loading history...</Text>
          </View>
        ) : (
          <FlatList
            data={transactions}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Image
                  source={require('../../assets/images/icon.png')}
                  style={{ width: 80, height: 80, opacity: 0.3, marginBottom: 15 }}
                  resizeMode="contain"
                />
                <Text style={styles.emptyText}>No transactions yet</Text>
              </View>
            }
          />
        )}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  // Header
  header: {
    backgroundColor: '#0C1559',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    paddingBottom: 20,
    zIndex: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  safeHeader: { width: '100%' },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 10,
  },
  backBtn: { padding: 8 },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Montserrat-Bold',
    color: '#FFF',
  },
  // Content
  contentContainer: {
    flex: 1,
  },
  listContent: {
    padding: 20,
    paddingBottom: 50,
  },
  // Card
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  detailsContainer: {
    flex: 1,
    marginRight: 10,
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: 'Montserrat-Bold',
    color: '#0F172A',
    marginBottom: 4,
  },
  cardDate: {
    fontSize: 12,
    fontFamily: 'Montserrat-Medium',
    color: '#64748B',
  },
  rightContainer: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 16,
    fontFamily: 'Montserrat-Bold',
    marginBottom: 6,
  },
  // Status Badges
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusSuccess: { backgroundColor: '#DCFCE7' },
  statusPending: { backgroundColor: '#FEF3C7' },
  statusFailed: { backgroundColor: '#FEE2E2' },
  statusText: { fontSize: 10, fontFamily: 'Montserrat-Bold' },
  textSuccess: { color: '#16A34A' },
  textPending: { color: '#D97706' },
  textFailed: { color: '#DC2626' },
  // States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#64748B',
    fontFamily: 'Montserrat-Medium',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#94A3B8',
    fontFamily: 'Montserrat-Medium',
  },
});