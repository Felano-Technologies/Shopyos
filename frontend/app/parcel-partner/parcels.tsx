import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getHubParcels } from '@/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';

const SELECTED_HUB_KEY = '@shopyos_parcel_partner_hub_id';

export default function ParcelsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  // Status filter state
  const [selectedFilter, setSelectedFilter] = useState<string>('ready_for_pickup');
  const [hubId, setHubId] = useState<string | null>(null);
  const [parcels, setParcels] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (params.filter) {
      setSelectedFilter(params.filter as string);
    }
  }, [params.filter]);

  const loadSavedHub = async () => {
    const savedHubId = await AsyncStorage.getItem(SELECTED_HUB_KEY);
    setHubId(savedHubId);
  };

  const fetchParcels = async () => {
    if (!hubId) return;
    try {
      setLoading(true);
      const res = await getHubParcels(hubId, selectedFilter);
      if (res.success) {
        setParcels(res.data);
      }
    } catch (err) {
      console.error('Error fetching hub parcels:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchParcels();
    setRefreshing(false);
  };

  useEffect(() => {
    loadSavedHub();
  }, []);

  useEffect(() => {
    if (hubId) {
      fetchParcels();
    }
  }, [hubId, selectedFilter]);

  const filteredParcels = parcels.filter(p => {
    const query = searchQuery.toLowerCase();
    return (
      p.order_number.toLowerCase().includes(query) ||
      (p.parcel_tracking_number && p.parcel_tracking_number.toLowerCase().includes(query)) ||
      (p.store_name && p.store_name.toLowerCase().includes(query))
    );
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready_for_pickup': return { bg: '#EFF6FF', text: '#2563EB' };
      case 'at_origin_hub': return { bg: '#F0FDF4', text: '#16A34A' };
      case 'in_transit_regional': return { bg: '#FEF3C7', text: '#D97706' };
      case 'at_destination_hub': return { bg: '#FAF5FF', text: '#7C3AED' };
      default: return { bg: '#F1F5F9', text: '#64748B' };
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ready_for_pickup': return 'Awaiting Check-in';
      case 'at_origin_hub': return 'Checked In';
      case 'in_transit_regional': return 'In Transit';
      case 'at_destination_hub': return 'Arrived at Dest';
      default: return status.replace('_', ' ');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor={colors.headerGradient[0]} />
      <LinearGradient colors={colors.headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
      <SafeAreaView edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Hub Parcels</Text>
        <TouchableOpacity style={styles.scanHeaderBtn} onPress={() => router.push('/parcel-partner/scan')}>
          <Feather name="camera" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>
      </SafeAreaView>
      </LinearGradient>

      <View style={{ flex: 1, backgroundColor: colors.backgroundAlt }}>
      {/* Search Input */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Feather name="search" size={18} color={colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by Order # or Tracking #"
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Segment Tabs */}
      <View style={styles.tabsContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[
            { id: 'ready_for_pickup', label: 'Awaiting Check-in' },
            { id: 'at_origin_hub', label: 'Checked In' },
            { id: 'in_transit_regional', label: 'In Transit' },
            { id: 'at_destination_hub', label: 'Arrived at Dest' },
          ]}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.tab, selectedFilter === item.id && styles.tabActive]}
              onPress={() => setSelectedFilter(item.id)}
            >
              <Text style={[styles.tabText, selectedFilter === item.id && styles.tabTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.tabsList}
        />
      </View>

      {/* Parcels List */}
      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : filteredParcels.length === 0 ? (
        <View style={styles.centerContainer}>
          <Feather name="package" size={48} color={colors.textMuted} />
          <Text style={styles.emptyText}>No matching parcels found.</Text>
        </View>
      ) : (
        <FlatList
          data={filteredParcels}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />
          }
          renderItem={({ item }) => {
            const statusTheme = getStatusColor(item.status);
            return (
              <TouchableOpacity
                style={styles.parcelCard}
                onPress={() => router.push({ pathname: '/parcel-partner/parcel-detail', params: { orderId: item.id } })}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.orderNumber}>#{item.order_number}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusTheme.bg }]}>
                    <Text style={[styles.statusText, { color: statusTheme.text }]}>
                      {getStatusLabel(item.status)}
                    </Text>
                  </View>
                </View>

                {item.parcel_tracking_number && (
                  <Text style={styles.trackingNumber}>Track: {item.parcel_tracking_number}</Text>
                )}

                <View style={styles.divider} />

                <View style={styles.routeRow}>
                  <View style={styles.routeStep}>
                    <Text style={styles.routeLabel}>Origin</Text>
                    <Text style={styles.routeValue}>{item.origin_region || 'Store Region'}</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={16} color={colors.textMuted} />
                  <View style={styles.routeStep}>
                    <Text style={styles.routeLabel}>Destination</Text>
                    <Text style={styles.routeValue}>{item.destination_region || 'Buyer Region'}</Text>
                  </View>
                </View>

                <View style={styles.cardFooter}>
                  <View style={styles.storeContainer}>
                    <Feather name="shopping-bag" size={14} color={colors.textSecondary} style={{ marginRight: 5 }} />
                    <Text style={styles.storeName}>{item.store_name || 'Vendor Store'}</Text>
                  </View>
                  <Text style={styles.dateText}>
                    {new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
      </View>
      <SafeAreaView edges={['bottom']} style={{ backgroundColor: colors.backgroundAlt }} />
    </View>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.headerGradient[0],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat-Bold',
    color: '#FFF',
  },
  scanHeaderBtn: {
    padding: 4,
  },
  searchContainer: {
    padding: 16,
    backgroundColor: colors.surface,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Montserrat-Regular',
    color: colors.text,
    padding: 0, // Reset default Android text input padding
  },
  tabsContainer: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderStrong,
    paddingBottom: 8,
  },
  tabsList: {
    paddingHorizontal: 16,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.border,
    marginRight: 8,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 12,
    fontFamily: 'Montserrat-SemiBold',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.textInverse,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    fontFamily: 'Montserrat-Medium',
    color: colors.textMuted,
  },
  listContent: {
    padding: 16,
    paddingBottom: 120,
  },
  parcelCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.01,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderNumber: {
    fontSize: 15,
    fontFamily: 'Montserrat-Bold',
    color: colors.primary,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontFamily: 'Montserrat-Bold',
  },
  trackingNumber: {
    fontSize: 12,
    fontFamily: 'Montserrat-SemiBold',
    color: colors.textSecondary,
    marginTop: 6,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  routeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  routeStep: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 10,
    fontFamily: 'Montserrat-Regular',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  routeValue: {
    fontSize: 13,
    fontFamily: 'Montserrat-SemiBold',
    color: colors.text,
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  storeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  storeName: {
    fontSize: 12,
    fontFamily: 'Montserrat-Medium',
    color: colors.textSecondary,
  },
  dateText: {
    fontSize: 11,
    fontFamily: 'Montserrat-Medium',
    color: colors.textMuted,
  },
});
