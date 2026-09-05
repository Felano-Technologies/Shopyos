import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Dimensions,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { getHubs, getDashboardStats, getHubParcels } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { useAllUnreadCount } from '@/hooks/useChat';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CustomInAppToast } from '@/components/InAppToastHost';
import WelcomeCard from '@/components/WelcomeCard';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';
import { formatCurrency } from '@/utils/formatCurrency';

const { width: SW } = Dimensions.get('window');
const SELECTED_HUB_KEY = '@shopyos_parcel_partner_hub_id';

export default function ParcelPartnerDashboard() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const switchToBuyerMode = useAuthStore((s) => s.switchToBuyerMode);
  const { data: chatUnreadCount = 0 } = useAllUnreadCount();

  const [hubs, setHubs] = useState<any[]>([]);
  const [selectedHub, setSelectedHub] = useState<any | null>(null);
  const [stats, setStats] = useState({ awaitingCheckIn: 0, checkedIn: 0, inTransit: 0, arrived: 0 });
  const [pendingParcels, setPendingParcels] = useState<any[]>([]);

  const [loadingHubs, setLoadingHubs] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showHubPicker, setShowHubPicker] = useState(false);

  // Fetch initial hubs list
  const fetchHubs = async () => {
    try {
      setLoadingHubs(true);
      const res = await getHubs();
      if (res.success && res.data.length > 0) {
        setHubs(res.data);

        // Check if there was a previously saved hub selection
        const savedHubId = await AsyncStorage.getItem(SELECTED_HUB_KEY);
        const match = res.data.find(h => h.id === savedHubId);
        if (match) {
          setSelectedHub(match);
        } else {
          setSelectedHub(res.data[0]);
        }
      } else {
        CustomInAppToast.show({
          type: 'error',
          title: 'Configuration Error',
          message: 'No active parcel partner hubs found on the platform.'
        });
      }
    } catch (err: any) {
      console.error('Error fetching hubs:', err);
      CustomInAppToast.show({
        type: 'error',
        title: 'Error',
        message: err.message || 'Failed to load hubs list.'
      });
    } finally {
      setLoadingHubs(false);
    }
  };

  // Fetch stats and pending packages for the selected hub
  const fetchHubData = async (hubId: string) => {
    if (!hubId) return;
    try {
      setLoadingData(true);
      const [statsRes, parcelsRes] = await Promise.all([
        getDashboardStats(hubId),
        getHubParcels(hubId, 'ready_for_pickup') // Pending check-ins
      ]);

      if (statsRes.success) {
        setStats(statsRes.data);
      }
      if (parcelsRes.success) {
        setPendingParcels(parcelsRes.data.slice(0, 5)); // Limit to top 5 on dashboard
      }
    } catch (err: any) {
      console.error('Error fetching hub data:', err);
    } finally {
      setLoadingData(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    if (selectedHub) {
      await fetchHubData(selectedHub.id);
    } else {
      await fetchHubs();
    }
    setRefreshing(false);
  };

  useEffect(() => {
    fetchHubs();
  }, []);

  useEffect(() => {
    if (selectedHub) {
      AsyncStorage.setItem(SELECTED_HUB_KEY, selectedHub.id);
      fetchHubData(selectedHub.id);
    }
  }, [selectedHub]);

  const changeHub = (hub: any) => {
    setSelectedHub(hub);
    setShowHubPicker(false);
  };

  const handleReturnToShopping = () => {
    switchToBuyerMode('parcel_partner');
    router.replace('/home');
  };

  if (loadingHubs) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading Hub Details...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor={colors.headerGradient[0]} />
      <LinearGradient colors={colors.headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
      <SafeAreaView edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>Logistics Portal</Text>
          <TouchableOpacity
            style={styles.hubSelector}
            onPress={() => setShowHubPicker(!showHubPicker)}
          >
            <Text style={styles.hubSelectorText}>{selectedHub?.hub_name || 'Select Hub'}</Text>
            <Ionicons name="chevron-down" size={16} color="rgba(255,255,255,0.8)" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={() => router.push('/parcel-partner/notifications' as any)}>
          <Feather name="bell" size={16} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>
      </View>
      </SafeAreaView>
      </LinearGradient>

      <View style={{ flex: 1, backgroundColor: colors.backgroundAlt }}>
      {showHubPicker && (
        <View style={styles.pickerDropdown}>
          <Text style={styles.pickerTitle}>Switch Hub</Text>
          {hubs.map((hub) => (
            <TouchableOpacity
              key={hub.id}
              style={[styles.pickerItem, selectedHub?.id === hub.id && styles.pickerItemActive]}
              onPress={() => changeHub(hub)}
            >
              <Text style={[styles.pickerItemText, selectedHub?.id === hub.id && styles.pickerItemTextActive]}>
                {hub.hub_name} ({hub.partner_name})
              </Text>
              {selectedHub?.id === hub.id && (
                <Ionicons name="checkmark-circle" size={18} color="#84cc16" />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />
        }
      >
        {/* Hub balance — credited when a parcel arrives at this hub (its share
            of the transit fee) */}
        {selectedHub && (
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Hub Balance</Text>
            <Text style={styles.balanceValue}>{formatCurrency(selectedHub.current_balance)}</Text>
          </View>
        )}

        {/* Hub drop-off code — read this to first-mile drivers to confirm handoff */}
        {selectedHub?.handoff_code && (
          <View style={styles.codeBanner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.codeBannerLabel}>Drop-off Code</Text>
              <Text style={styles.codeBannerHint}>Give this to drivers dropping parcels here</Text>
            </View>
            <Text style={styles.codeBannerValue}>{selectedHub.handoff_code}</Text>
          </View>
        )}

        {/* Statistics Grid */}
        <Text style={styles.sectionTitle}>Hub Statistics</Text>
        {loadingData ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : (
          <View style={styles.statsGrid}>
            <TouchableOpacity
              style={styles.statCard}
              onPress={() => router.push({ pathname: '/parcel-partner/parcels', params: { filter: 'ready_for_pickup' } })}
            >
              <View style={[styles.statIconWrapper, { backgroundColor: '#EFF6FF' }]}>
                <Feather name="box" size={20} color="#3B82F6" />
              </View>
              <Text style={styles.statValue}>{stats.awaitingCheckIn}</Text>
              <Text style={styles.statLabel}>Awaiting Check-in</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.statCard}
              onPress={() => router.push({ pathname: '/parcel-partner/parcels', params: { filter: 'at_origin_hub' } })}
            >
              <View style={[styles.statIconWrapper, { backgroundColor: '#F0FDF4' }]}>
                <Feather name="check-square" size={20} color="#10B981" />
              </View>
              <Text style={styles.statValue}>{stats.checkedIn}</Text>
              <Text style={styles.statLabel}>Checked In</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.statCard}
              onPress={() => router.push({ pathname: '/parcel-partner/parcels', params: { filter: 'in_transit_regional' } })}
            >
              <View style={[styles.statIconWrapper, { backgroundColor: '#FEF3C7' }]}>
                <MaterialCommunityIcons name="truck-delivery-outline" size={20} color="#D97706" />
              </View>
              <Text style={styles.statValue}>{stats.inTransit}</Text>
              <Text style={styles.statLabel}>In Transit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.statCard}
              onPress={() => router.push({ pathname: '/parcel-partner/parcels', params: { filter: 'at_destination_hub' } })}
            >
              <View style={[styles.statIconWrapper, { backgroundColor: '#FAF5FF' }]}>
                <Feather name="map-pin" size={20} color="#8B5CF6" />
              </View>
              <Text style={styles.statValue}>{stats.arrived}</Text>
              <Text style={styles.statLabel}>Arrived at Dest</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Action Quick Bar */}
        <View style={styles.quickBar}>
          <TouchableOpacity
            style={styles.quickBtn}
            onPress={() => router.push('/parcel-partner/scan')}
          >
            <LinearGradient
              colors={colors.headerGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.quickGradient}
            >
              <Feather name="camera" size={20} color="#FFF" style={{ marginRight: 8 }} />
              <Text style={styles.quickText}>Scan Parcel QR Code</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Pending Actions List */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Awaiting Check-In</Text>
          <TouchableOpacity onPress={() => router.push('/parcel-partner/parcels')}>
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        {loadingData ? (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 20 }} />
        ) : pendingParcels.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Feather name="package" size={40} color={colors.textMuted} />
            <Text style={styles.emptyText}>No packages pending check-in.</Text>
          </View>
        ) : (
          pendingParcels.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.parcelCard}
              onPress={() => router.push({ pathname: '/parcel-partner/parcel-detail', params: { orderId: item.id } })}
            >
              <View style={styles.parcelInfo}>
                <View style={styles.storeBadge}>
                  <Text style={styles.storeText}>{item.store_name || 'Vendor'}</Text>
                </View>
                <Text style={styles.orderNumber}>Order #{item.order_number}</Text>
                <Text style={styles.routeText}>
                  {item.origin_region} → {item.destination_region}
                </Text>
              </View>
              <View style={styles.parcelActions}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => router.push({ pathname: '/parcel-partner/parcel-detail', params: { orderId: item.id } })}
                >
                  <Text style={styles.actionBtnText}>Check In</Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.textInverse} />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
      </View>
      <TouchableOpacity
        style={styles.chatFab}
        activeOpacity={0.85}
        onPress={() => router.push('/chat' as any)}
      >
        <LinearGradient colors={colors.headerGradient} style={styles.chatFabGrad}>
          <MaterialCommunityIcons name="chat-processing" size={26} color="#fff" />
        </LinearGradient>
        {chatUnreadCount > 0 && (
          <View style={styles.chatFabBadge}>
            <Text style={styles.chatFabBadgeTxt}>{chatUnreadCount > 99 ? '99+' : chatUnreadCount}</Text>
          </View>
        )}
      </TouchableOpacity>
      <SafeAreaView edges={['bottom']} style={{ backgroundColor: colors.backgroundAlt }} />
      <WelcomeCard />
    </View>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.headerGradient[0],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    fontFamily: 'Montserrat-SemiBold',
    color: colors.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  welcomeText: {
    fontSize: 12,
    fontFamily: 'Montserrat-Regular',
    color: 'rgba(255,255,255,0.7)',
  },
  hubSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  hubSelectorText: {
    fontSize: 16,
    fontFamily: 'Montserrat-Bold',
    color: '#FFF',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  logoutText: {
    fontSize: 12,
    fontFamily: 'Montserrat-SemiBold',
    color: '#FFF',
  },
  chatFab: {
    position: 'absolute', bottom: 110, right: 18,
    width: 58, height: 58, borderRadius: 29,
    elevation: 8, shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
    zIndex: 100, overflow: 'visible',
  },
  chatFabGrad: {
    width: '100%', height: '100%', borderRadius: 29,
    justifyContent: 'center', alignItems: 'center',
  },
  chatFabBadge: {
    position: 'absolute', top: -2, right: -2,
    minWidth: 20, height: 20, borderRadius: 10,
    backgroundColor: '#ff0101', borderWidth: 1.5, borderColor: colors.headerGradient[0],
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4,
  },
  chatFabBadgeTxt: { color: '#fff', fontSize: 9, fontFamily: 'Montserrat-Bold' },
  pickerDropdown: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderStrong,
    paddingHorizontal: 20,
    paddingBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 3,
    zIndex: 10,
  },
  pickerTitle: {
    fontSize: 12,
    fontFamily: 'Montserrat-SemiBold',
    color: colors.textMuted,
    marginBottom: 8,
    marginTop: 5,
  },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerItemActive: {
    backgroundColor: colors.backgroundAlt,
  },
  pickerItemText: {
    fontSize: 14,
    fontFamily: 'Montserrat-Regular',
    color: colors.text,
  },
  pickerItemTextActive: {
    fontFamily: 'Montserrat-SemiBold',
    color: colors.primary,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: 'Montserrat-Bold',
    color: colors.primary,
    marginTop: 20,
    marginBottom: 12,
  },
  balanceCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  balanceLabel: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: colors.textSecondary },
  balanceValue: { fontSize: 26, fontFamily: 'Montserrat-Bold', color: colors.primary, marginTop: 4 },
  codeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.headerGradient[0],
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginTop: 16,
  },
  codeBannerLabel: { fontSize: 12, fontFamily: 'Montserrat-Bold', color: '#A3E635', textTransform: 'uppercase', letterSpacing: 0.5 },
  codeBannerHint: { fontSize: 11, fontFamily: 'Montserrat-Medium', color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  codeBannerValue: { fontSize: 28, fontFamily: 'Montserrat-Bold', color: '#FFF', letterSpacing: 4 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 12,
  },
  viewAllText: {
    fontSize: 12,
    fontFamily: 'Montserrat-SemiBold',
    color: '#3B82F6',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    backgroundColor: colors.surface,
    width: (SW - 50) / 2,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 2,
  },
  statIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  statValue: {
    fontSize: 20,
    fontFamily: 'Montserrat-Bold',
    color: colors.primary,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: 'Montserrat-Medium',
    color: colors.textSecondary,
    marginTop: 2,
  },
  loaderContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  quickBar: {
    marginTop: 15,
  },
  quickBtn: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  quickGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
  },
  quickText: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
  },
  emptyContainer: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: 'Montserrat-Medium',
    color: colors.textMuted,
    marginTop: 10,
  },
  parcelCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  parcelInfo: {
    flex: 1,
  },
  storeBadge: {
    backgroundColor: colors.border,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 6,
  },
  storeText: {
    fontSize: 10,
    fontFamily: 'Montserrat-SemiBold',
    color: colors.textSecondary,
  },
  orderNumber: {
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
    color: colors.primary,
  },
  routeText: {
    fontSize: 12,
    fontFamily: 'Montserrat-Medium',
    color: colors.textSecondary,
    marginTop: 4,
  },
  parcelActions: {
    marginLeft: 10,
  },
  actionBtn: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  actionBtnText: {
    color: colors.textInverse,
    fontSize: 12,
    fontFamily: 'Montserrat-Bold',
    marginRight: 4,
  },
});
