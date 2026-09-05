import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { Ionicons, Feather, MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { getMyDeliveries } from '@/services/api';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';
import { formatCurrency } from '@/utils/formatCurrency';

export default function DriverHistory() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      const res = await getMyDeliveries();
      if (res.success && res.deliveries) {
        setHistory(res.deliveries.map((d: any) => ({
          id: d.id || d._id,
          date: new Date(d.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
          time: new Date(d.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false }),
          restaurant: d.order?.store?.store_name || d.pickup_address || 'Unknown Store',
          earnings: d.status === 'delivered' ? Number(d.delivery_fee || 15) : 0,
          status: d.status.charAt(0).toUpperCase() + d.status.slice(1).replace('_', ' '),
          orderId: `#${d.order?.order_number || 'N/A'}`
        })));
      }
    } catch (e) {
      console.error('Failed to fetch history', e);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchHistory(true);
    } finally {
      setRefreshing(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const isCancelled = item.status.toLowerCase().includes('cancel') || item.status.toLowerCase().includes('fail');
    const isCompleted = item.status.toLowerCase() === 'delivered' || item.status.toLowerCase() === 'completed';

    let badgeStyle: object;
    if (isCompleted) {
      badgeStyle = styles.statusCompleted;
    } else if (isCancelled) {
      badgeStyle = styles.statusCancelled;
    } else {
      badgeStyle = { backgroundColor: colors.border };
    }
    let textStyle: object;
    if (isCompleted) {
      textStyle = styles.textCompleted;
    } else if (isCancelled) {
      textStyle = styles.textCancelled;
    } else {
      textStyle = { color: colors.textSecondary };
    }
    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.7}>
        {/* Top Row: Icon + Restaurant + Price */}
        <View style={styles.cardTop}>
            <View style={styles.iconBox}>
                <MaterialIcons
                    name={isCancelled ? "cancel" : "restaurant"}
                    size={20}
                    color={isCancelled ? colors.error : colors.primary}
                />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={styles.restaurant}>{item.restaurant}</Text>
                <Text style={styles.orderId}>Order {item.orderId}</Text>
            </View>
            <Text style={[styles.earnings, isCancelled && styles.earningsCancelled]}>
                {isCancelled ? formatCurrency(0) : formatCurrency(item.earnings)}
            </Text>
        </View>

        {/* Divider line */}
        <View style={styles.divider} />

        {/* Bottom Row: Date + Status Badge */}
        <View style={styles.cardBottom}>
            <View style={styles.dateTimeContainer}>
                <Feather name="calendar" size={12} color={colors.textSecondary} style={{ marginRight: 4 }} />
                <Text style={styles.timestamp}>{item.date} • {item.time}</Text>
            </View>

            <View style={[styles.statusBadge, badgeStyle]}>
                <Text style={[styles.statusText, textStyle]}>
                    {item.status}
                </Text>
            </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.headerGradient[0]} />
      <Stack.Screen options={{ headerShown: false }} />

      {/* --- Header --- */}
      <View style={styles.header}>
        <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeHeader}>
            <View style={styles.navBar}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={colors.accent} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Trip History</Text>
                <View style={{ width: 40 }} />
            </View>
        </SafeAreaView>
      </View>

      {/* --- Content --- */}
      <View style={styles.contentContainer}>
        {loading ? (
          <View style={styles.emptyContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.emptyText, { marginTop: 10 }]}>Loading history...</Text>
          </View>
        ) : (
          <FlatList
            data={history}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No trip history found.</Text>
              </View>
            }
          />
        )}
      </View>
    </View>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundAlt
  },

  // Header
  header: {
    backgroundColor: colors.headerGradient[0],
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

  // List
  contentContainer: { flex: 1 },
  list: { padding: 20, paddingBottom: 120 },

  // Card
  card: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'transparent',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },

  // Card Top
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  restaurant: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: colors.text },
  orderId: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: colors.textSecondary },
  earnings: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: colors.success },
  earningsCancelled: { color: colors.textMuted, textDecorationLine: 'line-through' },

  // Divider
  divider: { height: 1, backgroundColor: colors.border, marginBottom: 12 },

  // Card Bottom
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateTimeContainer: { flexDirection: 'row', alignItems: 'center' },
  timestamp: { fontSize: 12, color: colors.textSecondary, fontFamily: 'Montserrat-Medium' },

  // Badges
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusCompleted: { backgroundColor: '#DCFCE7' },
  statusCancelled: { backgroundColor: '#FEE2E2' },

  statusText: { fontSize: 11, fontFamily: 'Montserrat-Bold' },
  textCompleted: { color: colors.success },
  textCancelled: { color: colors.error },

  // Empty State
  emptyContainer: { alignItems: 'center', marginTop: 50 },
  emptyText: { color: colors.textMuted, fontFamily: 'Montserrat-Medium' },
});
