import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Image,
  FlatList,
  Dimensions,
  ActivityIndicator
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { getDriverProfile, getUserData, CustomInAppToast, updateDriverAvailability } from '@/services/api';
import { useAvailableDeliveries, useActiveDeliveries, useDriverStats, useAssignDriver } from '@/hooks/useDelivery';
import { useDriverGuard } from '@/hooks/useDriverGuard';
import LocationDisclosure from '@/components/ui/LocationDisclosure';
import {
  
  stopDriverLocationTracking,
  requestLocationPermissions,
  setLocationSharingPreference,
} from '@/src/background/controller';

const { width: SW } = Dimensions.get('window');
const SCALE = Math.min(Math.max(SW / 390, 0.85), 1.15);
const rs = (n: number) => Math.round(n * SCALE);
const rf = (n: number) => Math.round(n * Math.min(SCALE, 1.1));

export default function Dashboard() {
  const router = useRouter();
  const { profile: initialProfile, isChecking } = useDriverGuard();
  const [profile, setProfile] = useState<any>(initialProfile);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [showDisclosure, setShowDisclosure] = useState(false);
  const [locationGranted, setLocationGranted] = useState(false);
  const [user, setUser] = useState<any>(null);

  // Verification flags
  const isVerified = profile?.is_verified === true || profile?.is_verified === 1 || profile?.verification_status === 'verified';
  const isPending = !isVerified && !profile?.rejection_reason;
  const isRejected = !!profile?.rejection_reason;

  // DIRECT RE-FETCH ON MOUNT (Bypass Tanstack Cache entirely for this crucial check)
  useEffect(() => {
    const forceFreshProfile = async () => {
      try {
        const response = await getDriverProfile();
        const fresh = response?.profile || response?.data || response;
        if (fresh) {
           console.log('DEBUG [Dashboard] Directly fetched LATEST profile:', fresh.is_verified);
           setProfile(fresh);
        }
      } catch (err) {
        console.warn('Direct profile fetch failed:', err);
      }
    };
    forceFreshProfile();
  }, []);

  useEffect(() => {
    if (initialProfile) setProfile(initialProfile);
  }, [initialProfile]);

  useEffect(() => {
    if (profile) {
      console.log('DEBUG [DriverDashboard] Profile data from backend:', JSON.stringify(profile, null, 2));
      
      // Find the availability status
      const driverObj = profile?.profile || profile?.data || profile;
      if (driverObj && driverObj.is_available !== undefined) {
          setIsOnline(!!driverObj.is_available);
      }
    }
  }, [profile]);

  // --- TanStack Query Hooks ---
  const { data: statsData } = useDriverStats('today');
  const stats = statsData?.stats || { total: 0, completed: 0, inProgress: 0, earnings: 0 };
  
  const { data: activeData, refetch: refetchActive } = useActiveDeliveries({ enabled: isOnline, refetchInterval: isOnline ? 10000 : false });
  const activeDeliveries = activeData?.deliveries || [];
  
  const { 
    data: availableData, 
    refetch: refetchAvailable, 
    isLoading: isLoadingAvailable,
    isFetching: isFetchingAvailable 
  } = useAvailableDeliveries({ enabled: isOnline, refetchInterval: isOnline ? 10000 : false });

  const requests = availableData?.deliveries?.map((d: any) => ({
    id: d.id || d._id,
    restaurant: d.order?.store?.store_name || d.pickup_address || 'Store',
    destination: d.delivery_address || d.order?.delivery_address || 'Destination',
    price: d.delivery_fee || 15.0,
    distance: d.distance ? `${d.distance.toFixed(1)} km` : `${(Math.random() * 4 + 1).toFixed(1)} km`,
    time: d.estimated_time || `${Math.floor(Math.random() * 15 + 10)} mins`,
    items: d.order?.order_items?.length || 1
  })) || [];

  const assignDriverMutation = useAssignDriver();

  // Fetch User Info
  useEffect(() => {
    getUserData().then(data => {
      if (data) setUser(data);
    }).catch(console.error);
  }, []);

  // Check location permission status on mount
  useEffect(() => {
    (async () => {
      const { status: bg } = await Location.getBackgroundPermissionsAsync();
      setLocationGranted(bg === 'granted');
    })();
  }, []);

  // Handle disclosure accept — request actual system permissions
  const handleDisclosureAccept = useCallback(async () => {
    setShowDisclosure(false);
    const perms = await requestLocationPermissions();
    setLocationGranted(perms.background);
    if (perms.background) {
      await setLocationSharingPreference(true);
      // Now proceed with going online
      await goOnline();
    } else {
      CustomInAppToast.show({
        type: 'error',
        title: 'Permission Denied',
        message: 'Background location is required for delivery tracking. You can enable it in Settings.',
      });
    }
  }, []);

  // The actual go-online logic (extracted so disclosure flow can call it)
  const goOnline = async () => {
    try {
      await updateDriverAvailability(true);
      setIsOnline(true);
      CustomInAppToast.show({
        type: 'success',
        title: 'You are Online',
        message: 'You will now see delivery requests',
      });
    } catch (error: any) {
      CustomInAppToast.show({
        type: 'error',
        title: 'Update Failed',
        message: error.message || 'Could not update your status',
      });
    }
  };

  // Toggle Online Status
  const toggleOnline = async () => {
    if (isChecking) return;

    if (!isVerified) {
      CustomInAppToast.show({
        type: 'error',
        title: 'Restricted Access',
        message: 'You must be verified before you can go online. It will be done soon.',
      });
      return;
    }

    // Going offline
    if (isOnline) {
      try {
        await updateDriverAvailability(false);
        setIsOnline(false);
        await stopDriverLocationTracking();
        CustomInAppToast.show({
          type: 'success',
          title: 'You are Offline',
          message: 'You will not receive new requests',
        });
      } catch (error: any) {
        CustomInAppToast.show({
          type: 'error',
          title: 'Update Failed',
          message: error.message || 'Could not update your status',
        });
      }
      return;
    }

    // Going online — check background location first
    if (!locationGranted) {
      // Show disclosure modal before requesting system permission
      setShowDisclosure(true);
      return;
    }

    await goOnline();
  };



  const handleAccept = async (id: string) => {
    if (!isVerified) {
      CustomInAppToast.show({ 
        type: 'error', 
        title: 'Verification Required', 
        message: 'Your account is under review. You will be able to accept orders once it is done.' 
      });
      return;
    }

    if (activeDeliveries.length > 0) {
      CustomInAppToast.show({ 
        type: 'error', 
        title: 'Active Delivery', 
        message: 'Please complete your current delivery before accepting a new one.' 
      });
      return;
    }

    try {
      await assignDriverMutation.mutateAsync(id);
      router.push({ pathname: '/driver/activeOrder', params: { deliveryId: id } } as any);
    } catch (e: any) {
      CustomInAppToast.show({ 
        type: 'error', 
        title: 'Error', 
        message: e.message || 'Failed to accept order' 
      });
    }
  };

  const RequestCard = ({ item }: { item: any }) => (
    <View style={styles.requestCard}>
      <View style={styles.cardHeader}>
        <View style={styles.priceTag}>
          <Text style={styles.priceText}>₵{item.price.toFixed(2)}</Text>
        </View>
        <Text style={styles.distanceText}>Request Nearby</Text>
      </View>

      <View style={styles.routeContainer}>
        <View style={styles.timeline}>
          <View style={styles.dot} />
          <View style={styles.line} />
          <View style={[styles.dot, { backgroundColor: '#A3E635' }]} />
        </View>

        <View style={styles.addresses}>
          <View style={styles.addressBlock}>
            <Text style={styles.addressLabel}>Pick Up</Text>
            <Text style={styles.addressTitle} numberOfLines={1}>{item.restaurant}</Text>
          </View>
          <View style={[styles.addressBlock, { marginTop: 15 }]}>
            <Text style={styles.addressLabel}>Drop Off</Text>
            <Text style={styles.addressTitle} numberOfLines={1}>{item.destination}</Text>
          </View>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.itemBadge}>
          <Feather name="package" size={14} color="#64748B" />
          <Text style={styles.itemText}>{item.items} Items</Text>
        </View>
        <TouchableOpacity
          style={[styles.acceptBtn, assignDriverMutation.isPending && { opacity: 0.7 }]}
          onPress={() => handleAccept(item.id)}
          disabled={assignDriverMutation.isPending}
        >
          {assignDriverMutation.isPending ? <ActivityIndicator size="small" color="#A3E635" /> : <Text style={styles.acceptText}>Accept Order</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );

  const ActiveMissionCard = ({ delivery }: { delivery: any }) => (
    <TouchableOpacity
      style={styles.activeCard}
      onPress={() => router.push({ pathname: '/driver/activeOrder', params: { deliveryId: delivery.id } } as any)}
    >
      <LinearGradient colors={['#A3E635', '#84cc16']} style={styles.activeGradient}>
        <View style={styles.activeHeader}>
          <Text style={styles.activeBadge}>ACTIVE MISSION</Text>
          <Ionicons name="chevron-forward" size={18} color="#0C1559" />
        </View>
        <Text style={styles.activeTitle}>Ongoing Delivery to {delivery.order?.buyer?.full_name || 'Customer'}</Text>
        <View style={styles.activeFooter}>
          <Text style={styles.activeStatus}>{delivery.status.replace('_', ' ').toUpperCase()}</Text>
          <Text style={styles.activeOrderNum}>#{delivery.order?.order_number}</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor="#0C1559" />

      {/* --- HEADER --- */}
      <View style={styles.header}>
        <SafeAreaView edges={['top', 'left', 'right']}>
          {!isVerified && (
            <TouchableOpacity 
              style={styles.verificationBanner}
              activeOpacity={0.9}
              onPress={() => router.push('/driver/verification')}
            >
              <Feather name="shield" size={16} color="#0C1559" />
              <Text style={styles.verificationText}>
                {isRejected ? 'Application rejected. Tap to see why.' : (isPending ? 'Verification in progress. It will be done soon.' : 'Complete your verification to start earning.')}
              </Text>
              <Feather name="chevron-right" size={14} color="#0C1559" />
            </TouchableOpacity>
          )}

          <View style={styles.headerTop}>
            <View style={styles.profileRow}>
              <Image
                source={{ uri: user?.avatar_url || `https://api.dicebear.com/9.x/fun-emoji/png?seed=${user?.name || 'Driver'}` }}
                style={styles.avatar}
              />
              <View>
                <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0] || 'Driver'}</Text>
                <Text style={styles.statusTextHeader}>
                  {isOnline ? 'You are Online' : 'You are Offline'}
                </Text>
              </View>
            </View>

            {/* Online Toggle */}
            <View style={styles.toggleContainer}>
              <Text style={[styles.toggleLabel, { color: isOnline ? '#A3E635' : '#94A3B8' }]}>
                {isOnline ? 'ON' : 'OFF'}
              </Text>
              <Switch
                trackColor={{ false: '#334155', true: 'rgba(163, 230, 53, 0.3)' }}
                thumbColor={isOnline ? '#A3E635' : '#f4f3f4'}
                onValueChange={toggleOnline}
                value={isOnline}
                disabled={isChecking}
              />
            </View>
          </View>

          {/* Daily Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Today&apos;s Earnings</Text>
              <Text style={styles.statValue}>₵{stats.earnings.toFixed(2)}</Text>
            </View>
            <View style={styles.verticalDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Completed</Text>
              <Text style={styles.statValue}>{stats.completed}</Text>
            </View>
            <View style={styles.verticalDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Total Rides</Text>
              <Text style={styles.statValue}>{stats.total}</Text>
            </View>
          </View>
        </SafeAreaView>
      </View>

      {/* --- CONTENT --- */}
      <View style={styles.contentContainer}>
        {!isOnline ? (
          <View style={styles.offlineState}>
            <View style={styles.offlineIconCircle}>
              <MaterialCommunityIcons name="motorbike-off" size={60} color="#94A3B8" />
            </View>
            <Text style={styles.offlineTitle}>You are currently offline</Text>
            <Text style={styles.offlineSub}>Go online to start receiving delivery requests nearby.</Text>
            <TouchableOpacity style={styles.goOnlineBtn} onPress={toggleOnline}>
              <Text style={styles.goOnlineText}>GO ONLINE</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ flex: 1 }}>

            {/* Active Order if any */}
            {activeDeliveries.length > 0 && (
              <View style={{ marginBottom: 20 }}>
                <Text style={styles.sectionTitle}>Current Task</Text>
                {activeDeliveries.map((d: any) => <ActiveMissionCard key={d.id} delivery={d} />)}
              </View>
            )}

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Available Requests</Text>
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>Live</Text>
              </View>
            </View>

            {requests.length === 0 ? (
              <View style={styles.searchingState}>
                {isLoadingAvailable ? (
                  <>
                    <ActivityIndicator size="large" color="#0C1559" />
                    <Text style={styles.searchingText}>Finding orders...</Text>
                  </>
                ) : (
                  <>
                    <View style={styles.searchingIconCircle}>
                      <Feather name="search" size={40} color="#94A3B8" />
                    </View>
                    <Text style={styles.searchingText}>No orders available right now</Text>
                    <Text style={styles.searchingSub}>We&apos;ll notify you when a new request comes in.</Text>
                    {isFetchingAvailable && <ActivityIndicator size="small" color="#0C1559" style={{ marginTop: 15 }} />}
                  </>
                )}
              </View>
            ) : (
              <FlatList
                data={requests}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => <RequestCard item={item} />}
                contentContainerStyle={{ paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        )}
      </View>

      {/* Prominent Location Disclosure — required by Google / Apple */}
      <LocationDisclosure
        visible={showDisclosure}
        onAccept={handleDisclosureAccept}
        onDecline={() => setShowDisclosure(false)}
        context="driver"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },

  // Header
  header: {
    backgroundColor: '#0C1559',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    paddingBottom: 25,
    paddingHorizontal: 20,
    zIndex: 10,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25, marginTop: 5 },
  verificationBanner: {
    backgroundColor: '#A3E635',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 12,
    marginBottom: 15,
    marginTop: 5,
    gap: 10
  },
  verificationText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Montserrat-Bold',
    color: '#0C1559'
  },
  profileRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: '#A3E635', marginRight: 12, backgroundColor: '#FFF' },
  greeting: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#FFF' },
  statusTextHeader: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: '#CBD5E1' },
  toggleContainer: { alignItems: 'center' },
  toggleLabel: { fontSize: 10, fontFamily: 'Montserrat-Bold', marginBottom: 2 },

  // Stats
  statsContainer: {
    flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16, padding: 15, justifyContent: 'space-between', alignItems: 'center'
  },
  statBox: { alignItems: 'center', flex: 1 },
  statLabel: { color: '#94A3B8', fontSize: 11, fontFamily: 'Montserrat-Medium', marginBottom: 4 },
  statValue: { color: '#FFF', fontSize: 18, fontFamily: 'Montserrat-Bold' },
  verticalDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.2)' },

  // Content
  contentContainer: { flex: 1, padding: 20 },

  // Offline State
  offlineState: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: -50 },
  offlineIconCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  offlineTitle: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginBottom: 8 },
  offlineSub: { fontSize: 14, fontFamily: 'Montserrat-Regular', color: '#64748B', textAlign: 'center', width: '80%', marginBottom: 30 },
  goOnlineBtn: { backgroundColor: '#0C1559', paddingHorizontal: 40, paddingVertical: 15, borderRadius: 30 },
  goOnlineText: { color: '#FFF', fontFamily: 'Montserrat-Bold', fontSize: 16 },

  // Online State
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#64748B', textTransform: 'uppercase', marginBottom: 10 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#DC2626', marginRight: 6 },
  liveText: { color: '#DC2626', fontSize: 10, fontFamily: 'Montserrat-Bold' },

  searchingState: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 40 },
  searchingIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  searchingText: { fontSize: rf(16), fontFamily: 'Montserrat-Bold', color: '#475569', textAlign: 'center' },
  searchingSub: { fontSize: rf(13), fontFamily: 'Montserrat-Regular', color: '#94A3B8', textAlign: 'center', marginTop: 5, width: '80%' },

  // Active Order Card
  activeCard: { borderRadius: 20, overflow: 'hidden', marginBottom: 15, elevation: 4, shadowColor: '#365314', shadowOpacity: 0.2, shadowRadius: 10 },
  activeGradient: { padding: 16 },
  activeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  activeBadge: { fontSize: 10, fontFamily: 'Montserrat-Bold', color: '#0C1559', backgroundColor: 'rgba(255,255,255,0.4)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  activeTitle: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0C1559', marginBottom: 12 },
  activeFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  activeStatus: { fontSize: 11, fontFamily: 'Montserrat-Bold', color: '#FFF', textShadowColor: 'rgba(0,0,0,0.1)', textShadowRadius: 2 },
  activeOrderNum: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: '#0C1559' },

  // Request Card
  requestCard: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 },
  priceTag: { backgroundColor: '#ECFCCB', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  priceText: { color: '#0C1559', fontFamily: 'Montserrat-Bold', fontSize: 16 },
  distanceText: { color: '#64748B', fontFamily: 'Montserrat-SemiBold', fontSize: 12, marginTop: 5 },

  routeContainer: { flexDirection: 'row', marginBottom: 20 },
  timeline: { alignItems: 'center', marginRight: 12, marginTop: 5 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#0C1559' },
  line: { width: 2, height: 35, backgroundColor: '#E2E8F0', marginVertical: 2 },

  addresses: { flex: 1 },
  addressBlock: { height: 42, justifyContent: 'center' },
  addressLabel: { fontSize: 10, fontFamily: 'Montserrat-Bold', color: '#94A3B8', textTransform: 'uppercase' },
  addressTitle: { fontSize: 14, fontFamily: 'Montserrat-SemiBold', color: '#0F172A' },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 15 },
  itemBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  itemText: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: '#475569', marginLeft: 6 },
  acceptBtn: { backgroundColor: '#0C1559', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  acceptText: { color: '#A3E635', fontFamily: 'Montserrat-Bold', fontSize: 13 }
});