import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import MapView, { Marker, Polyline, UrlTile } from '@/components/MapView';
import { OSM_TILE_URL_TEMPLATE } from '@/constants/mapTiles';
import { getTransitInfo, requestLastMile, getDisclaimerByType, acknowledgeDisclaimer } from '@/services/api';
import { socketService } from '@/services/socket';
import { getLatestLocation } from '@/services/delivery';
import { CustomInAppToast } from '@/components/InAppToastHost';
import DisclaimerModal from '@/components/DisclaimerModal';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';
import { formatCurrency } from '@/utils/formatCurrency';

type LegacyPalette = {
  bg: string;
  navy: string;
  headerBg: string;
  card: string;
  body: string;
  muted: string;
  subtle: string;
  border: string;
  borderStrong: string;
  textInverse: string;
};

function buildC(colors: ThemeColors): LegacyPalette {
  return {
    bg: colors.background,
    navy: colors.primary,
    headerBg: colors.headerGradient[0],
    card: colors.surface,
    body: colors.text,
    muted: colors.textSecondary,
    subtle: colors.textMuted,
    border: colors.border,
    borderStrong: colors.borderStrong,
    textInverse: colors.textInverse,
  };
}

type Coord = { latitude: number; longitude: number };

// A coordinate is only usable if present and non-zero (0,0 is the DB default
// for a hub/store that never had its location set).
const toCoord = (lat: any, lng: any): Coord | null => {
  const la = Number(lat);
  const ln = Number(lng);
  if (!la || !ln || Number.isNaN(la) || Number.isNaN(ln)) return null;
  return { latitude: la, longitude: ln };
};

const { width: SW } = Dimensions.get('window');

export default function TransitTrackerScreen() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams();
  const themeColors = useThemeColors();
  const C = useMemo(() => buildC(themeColors), [themeColors]);
  const styles = useMemo(() => getStyles(C), [C]);

  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [data, setData] = useState<any | null>(null);

  // Disclaimer state
  const [lastMilePolicy, setLastMilePolicy] = useState<any | null>(null);
  const [isDisclaimerChecked, setIsDisclaimerChecked] = useState(false);
  const [showDisclaimerModal, setShowDisclaimerModal] = useState(false);

  // Live driver position for whichever driver leg is currently active.
  const [driverCoord, setDriverCoord] = useState<Coord | null>(null);
  const mapRef = useRef<any>(null);

  // Map endpoints (store -> origin hub -> destination hub -> home).
  const storeCoord = useMemo(() => toCoord(data?.store?.latitude, data?.store?.longitude), [data]);
  const originHubCoord = useMemo(() => toCoord(data?.originHub?.latitude, data?.originHub?.longitude), [data]);
  const destHubCoord = useMemo(() => toCoord(data?.destinationHub?.latitude, data?.destinationHub?.longitude), [data]);
  const homeCoord = useMemo(() => toCoord(data?.destination?.latitude, data?.destination?.longitude), [data]);

  const routeCoords = useMemo(
    () => [storeCoord, originHubCoord, destHubCoord, homeCoord].filter(Boolean) as Coord[],
    [storeCoord, originHubCoord, destHubCoord, homeCoord]
  );

  // Which driver leg (if any) is worth showing a live marker for. First-mile
  // runs while the order is pre-check-in; last-mile once it's out for delivery.
  const activeLeg = useMemo(() => {
    const s = (data?.orderStatus || '').toLowerCase();
    if (data?.lastMileLeg?.deliveryId && ['awaiting_last_mile', 'in_transit', 'picked_up'].includes(s)) {
      return { deliveryId: data.lastMileLeg.deliveryId as string, kind: 'last_mile' as const };
    }
    if (data?.firstMileLeg?.deliveryId && s === 'ready_for_pickup') {
      return { deliveryId: data.firstMileLeg.deliveryId as string, kind: 'first_mile' as const };
    }
    return null;
  }, [data]);

  const hasMap = routeCoords.length >= 2;

  const fetchTransitDetails = async () => {
    if (!orderId) return;
    try {
      setLoading(true);
      const res = await getTransitInfo(orderId as string);
      if (res.success) {
        setData(res.data);
      }
    } catch (err: any) {
      console.error('Error loading transit info:', err);
      CustomInAppToast.show({
        type: 'error',
        title: 'Error',
        message: err.message || 'Failed to load shipment tracking information.'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadDisclaimer = async () => {
    try {
      const policy = await getDisclaimerByType('inter_regional_terms');
      if (policy) {
        setLastMilePolicy(policy);
      }
    } catch (err) {
      console.warn('Could not load inter-regional terms disclaimer:', err);
    }
  };

  useEffect(() => {
    fetchTransitDetails();
    loadDisclaimer();
  }, [orderId]);

  // Keep the latest fetcher in a ref so the socket effect can call it without
  // re-subscribing on every render.
  const refetchRef = useRef<() => void>(() => {});
  refetchRef.current = fetchTransitDetails;

  // Live hub-milestone updates: refetch when the backend pushes a transit event
  // for this order (check-in / dispatch / arrive / last-mile requested).
  useEffect(() => {
    if (!orderId) return;
    let mounted = true;
    const onTransitUpdate = (payload: any) => {
      if (!mounted || payload?.orderId !== orderId) return;
      refetchRef.current();
    };
    socketService.connect().then((socket) => {
      if (!mounted) return;
      socket.on('order:transit_update', onTransitUpdate);
    });
    return () => {
      mounted = false;
      socketService.getSocket()?.off('order:transit_update', onTransitUpdate);
    };
  }, [orderId]);

  // Live driver position for the active leg (first-mile or last-mile).
  useEffect(() => {
    setDriverCoord(null);
    const deliveryId = activeLeg?.deliveryId;
    if (!deliveryId) return;
    let mounted = true;

    getLatestLocation(deliveryId)
      .then((res: any) => {
        if (mounted && res?.location) {
          setDriverCoord({ latitude: res.location.latitude, longitude: res.location.longitude });
        }
      })
      .catch(() => {});

    const onLocation = (payload: any) => {
      if (!mounted || payload?.deliveryId !== deliveryId) return;
      setDriverCoord({ latitude: payload.latitude, longitude: payload.longitude });
    };
    socketService.connect().then((socket) => {
      if (!mounted) return;
      socket.on('delivery:location_update', onLocation);
    });
    return () => {
      mounted = false;
      socketService.getSocket()?.off('delivery:location_update', onLocation);
    };
  }, [activeLeg?.deliveryId]);

  // Fit the map to all known points whenever they change.
  useEffect(() => {
    const pts = [...routeCoords, driverCoord].filter(Boolean) as Coord[];
    if (pts.length < 2) return;
    mapRef.current?.fitToCoordinates(pts, {
      edgePadding: { top: 60, right: 50, bottom: 60, left: 50 },
      animated: true,
    });
  }, [routeCoords, driverCoord]);

  const handleRequestLastMile = async () => {
    if (!orderId) return;
    if (lastMilePolicy && !isDisclaimerChecked) {
      CustomInAppToast.show({
        type: 'info',
        title: 'Consent Required',
        message: 'Please review and accept the inter-regional last-mile terms to proceed.'
      });
      return;
    }

    try {
      setRequesting(true);
      
      // Acknowledge terms on backend
      if (lastMilePolicy) {
        await acknowledgeDisclaimer('inter_regional_terms', lastMilePolicy.version, orderId as string, 'order');
      }

      const res = await requestLastMile(orderId as string);
      if (res.success) {
        CustomInAppToast.show({
          type: 'success',
          title: 'Success',
          message: 'Last-mile delivery request created! A local driver will be assigned shortly.'
        });
        fetchTransitDetails(); // Refresh details
      }
    } catch (err: any) {
      console.error('Error requesting last mile:', err);
      CustomInAppToast.show({
        type: 'error',
        title: 'Request Failed',
        message: err.message || 'Failed to submit last-mile delivery request.'
      });
    } finally {
      setRequesting(false);
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ready_for_pickup': return 'Vendor Dispatching';
      case 'at_origin_hub': return 'Sorting at Origin Hub';
      case 'in_transit_regional': return 'In Transit Between Hubs';
      case 'at_destination_hub': return 'Arrived at Destination Hub';
      case 'awaiting_last_mile': return 'Awaiting Last-Mile Pickup';
      case 'in_transit': return 'Out for Delivery';
      case 'delivered': return 'Delivered';
      default: return status ? status.replace('_', ' ').toUpperCase() : 'PENDING';
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={C.navy} />
        <Text style={styles.loadingText}>Fetching tracking history...</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.centerContainer}>
        <Feather name="alert-triangle" size={48} color="#D97706" />
        <Text style={styles.errorText}>No shipment details found for this order.</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor={C.headerBg} />
      <LinearGradient colors={themeColors.headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
        <SafeAreaView edges={['top', 'left', 'right']}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Shipment Tracking</Text>
            <View style={{ width: 24 }} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Tracking Details Header */}
        <View style={styles.card}>
          <Text style={styles.label}>Tracking Code</Text>
          <Text style={styles.trackingNumber}>{data.trackingNumber || 'Pending Courier Check-In'}</Text>
          
          <View style={styles.divider} />
          
          <View style={styles.row}>
            <View>
              <Text style={styles.subLabel}>Status</Text>
              <Text style={styles.statusVal}>{getStatusLabel(data.orderStatus)}</Text>
            </View>
            {data.estimatedHubArrival && (
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.subLabel}>Est. Arrival</Text>
                <Text style={styles.estArrivalVal}>
                  {new Date(data.estimatedHubArrival).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Shipment map — schematic hub route + live driver on the active leg */}
        {hasMap && (
          <View style={styles.mapCard}>
            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={{
                ...routeCoords[0],
                latitudeDelta: 1.5,
                longitudeDelta: 1.5,
              }}
            >
              <UrlTile urlTemplate={OSM_TILE_URL_TEMPLATE} maximumZ={19} flipY={false} zIndex={-1} />
              {routeCoords.length > 1 && (
                <Polyline coordinates={routeCoords} strokeColor="#3B82F6" strokeWidth={3} lineDashPattern={[6, 6]} />
              )}
              {storeCoord && (
                <Marker coordinate={storeCoord} title={data.store?.name || 'Store'}>
                  <View style={[styles.pin, { backgroundColor: '#16A34A' }]}>
                    <MaterialCommunityIcons name="storefront-outline" size={15} color="#FFF" />
                  </View>
                </Marker>
              )}
              {originHubCoord && (
                <Marker coordinate={originHubCoord} title={data.originHub?.hub_name || 'Origin Hub'}>
                  <View style={[styles.pin, { backgroundColor: '#3B82F6' }]}>
                    <MaterialCommunityIcons name="warehouse" size={15} color="#FFF" />
                  </View>
                </Marker>
              )}
              {destHubCoord && (
                <Marker coordinate={destHubCoord} title={data.destinationHub?.hub_name || 'Destination Hub'}>
                  <View style={[styles.pin, { backgroundColor: '#7C3AED' }]}>
                    <MaterialCommunityIcons name="warehouse" size={15} color="#FFF" />
                  </View>
                </Marker>
              )}
              {homeCoord && (
                <Marker coordinate={homeCoord} title="Delivery Address">
                  <View style={[styles.pin, { backgroundColor: '#0C1559' }]}>
                    <Ionicons name="home" size={14} color="#FFF" />
                  </View>
                </Marker>
              )}
              {driverCoord && (
                <Marker coordinate={driverCoord} title="Driver">
                  <View style={[styles.pin, { backgroundColor: '#0C1559', borderColor: '#A3E635', borderWidth: 2 }]}>
                    <MaterialCommunityIcons name="bike-fast" size={15} color="#FFF" />
                  </View>
                </Marker>
              )}
            </MapView>
            {activeLeg && (
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveBadgeText}>
                  {activeLeg.kind === 'first_mile' ? 'Live · heading to origin hub' : 'Live · out for delivery'}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Hub to Hub Routing */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Courier Route</Text>
          <View style={styles.routeBox}>
            <View style={styles.routePoint}>
              <View style={[styles.routeIndicator, { backgroundColor: '#3B82F6' }]} />
              <View>
                <Text style={styles.routeRegion}>{data.originHub?.region_name || 'Origin Hub'}</Text>
                <Text style={styles.routeHubName}>{data.originHub?.hub_name || 'Pending assignment'}</Text>
              </View>
            </View>
            
            <View style={styles.routeLine} />
            
            <View style={styles.routePoint}>
              <View style={[styles.routeIndicator, { backgroundColor: '#A3E635' }]} />
              <View>
                <Text style={styles.routeRegion}>{data.destinationHub?.region_name || 'Destination Hub'}</Text>
                <Text style={styles.routeHubName}>{data.destinationHub?.hub_name || 'Pending assignment'}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Last Mile Delivery Request Card */}
        {data.orderStatus === 'at_destination_hub' && !data.lastMileRequested && (
          <View style={[styles.card, styles.lastMileCard]}>
            <View style={styles.lastMileHeader}>
              <Feather name="truck" size={20} color="#1E3A8A" />
              <Text style={styles.lastMileTitle}>Last-Mile Home Delivery</Text>
            </View>
            <Text style={styles.lastMileDesc}>
              Your package has arrived at the destination hub! You can choose to pick it up in person for free, or request a local courier to deliver it to your address.
            </Text>
            
            <View style={styles.feeBreakdown}>
              <Text style={styles.feeLabel}>Last-Mile Delivery Fee:</Text>
              <Text style={styles.feeValue}>{formatCurrency(data.lastMileFee || 15.00)}</Text>
            </View>

            {lastMilePolicy && (
              <View style={styles.disclaimerRow}>
                <TouchableOpacity 
                  onPress={() => setIsDisclaimerChecked(!isDisclaimerChecked)}
                  style={styles.checkboxWrapper}
                >
                  <View style={[styles.checkbox, isDisclaimerChecked && styles.checkboxChecked]}>
                    {isDisclaimerChecked && <Feather name="check" size={12} color="#FFF" />}
                  </View>
                </TouchableOpacity>
                <Text style={styles.disclaimerText}>
                  I agree to the last-mile shipment{' '}
                  <Text style={styles.disclaimerLink} onPress={() => setShowDisclaimerModal(true)}>
                    Terms & Conditions
                  </Text>
                </Text>
              </View>
            )}

            <TouchableOpacity 
              style={[styles.lastMileBtn, requesting && styles.disabledBtn]} 
              onPress={handleRequestLastMile}
              disabled={requesting}
            >
              {requesting ? (
                <ActivityIndicator size="small" color={C.textInverse} />
              ) : (
                <Text style={styles.lastMileBtnText}>Request Home Delivery</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {data.lastMileRequested && (
          <View style={[styles.card, styles.lastMileRequestedCard]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Ionicons name="checkmark-circle" size={20} color="#16A34A" style={{ marginRight: 8 }} />
              <Text style={styles.lastMileRequestedTitle}>Home Delivery Requested</Text>
            </View>
            <Text style={styles.lastMileRequestedDesc}>
              We are dispatching a local driver to pick up your parcel from the hub and bring it to your door.
            </Text>
          </View>
        )}

        {/* History Timeline */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tracking Timeline</Text>
          {!data.history || data.history.length === 0 ? (
            <View style={styles.emptyTimeline}>
              <Feather name="clock" size={28} color={C.subtle} />
              <Text style={styles.emptyTimelineText}>Pending vendor shipment dispatch.</Text>
            </View>
          ) : (
            data.history.map((log: any, idx: number) => (
              <View key={log.created_at || log.createdAt} style={styles.timelineItem}>
                <View style={styles.timelineIndicators}>
                  <View style={styles.timelineDot} />
                  {idx !== data.history.length - 1 && <View style={styles.timelineLine} />}
                </View>
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineStatus}>{getStatusLabel(log.status)}</Text>
                  {log.hub_name && <Text style={styles.timelineLocation}>{log.hub_name}</Text>}
                  {log.notes && <Text style={styles.timelineNotes}>{`"${log.notes}"`}</Text>}
                  <Text style={styles.timelineDate}>
                    {new Date(log.created_at || log.createdAt).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {lastMilePolicy && (
        <DisclaimerModal
          type="inter_regional_terms"
          visible={showDisclaimerModal}
          required={true}
          onClose={() => setShowDisclaimerModal(false)}
          onAcknowledge={() => {
            setIsDisclaimerChecked(true);
            setShowDisclaimerModal(false);
          }}
        />
      )}
    </View>
  );
}

const getStyles = (C: LegacyPalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
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
  scrollContent: {
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: C.bg,
    padding: 30,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontFamily: 'Montserrat-SemiBold',
    color: C.navy,
  },
  errorText: {
    fontSize: 14,
    fontFamily: 'Montserrat-Medium',
    color: C.muted,
    marginTop: 12,
    textAlign: 'center',
  },
  backButton: {
    marginTop: 20,
    backgroundColor: C.navy,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  backButtonText: {
    color: C.textInverse,
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
  },
  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.borderStrong,
  },
  mapCard: {
    height: 220,
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.borderStrong,
  },
  map: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
  },
  pin: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  liveBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(12,21,89,0.9)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#A3E635',
    marginRight: 6,
  },
  liveBadgeText: {
    fontSize: 11,
    fontFamily: 'Montserrat-Bold',
    color: '#FFF',
  },
  cardTitle: {
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
    color: C.navy,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingBottom: 8,
  },
  label: {
    fontSize: 11,
    fontFamily: 'Montserrat-Medium',
    color: C.subtle,
    textTransform: 'uppercase',
  },
  trackingNumber: {
    fontSize: 18,
    fontFamily: 'Montserrat-Bold',
    color: C.navy,
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: C.border,
    marginVertical: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subLabel: {
    fontSize: 10,
    fontFamily: 'Montserrat-Regular',
    color: C.subtle,
    textTransform: 'uppercase',
  },
  statusVal: {
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
    color: '#3B82F6',
    marginTop: 2,
  },
  estArrivalVal: {
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
    color: C.navy,
    marginTop: 2,
  },
  routeBox: {
    paddingVertical: 4,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  routeRegion: {
    fontSize: 13,
    fontFamily: 'Montserrat-Bold',
    color: C.body,
  },
  routeHubName: {
    fontSize: 11,
    fontFamily: 'Montserrat-Medium',
    color: C.muted,
    marginTop: 1,
  },
  routeLine: {
    width: 2,
    height: 24,
    backgroundColor: C.borderStrong,
    marginLeft: 3,
    marginVertical: 4,
  },
  lastMileCard: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  lastMileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  lastMileTitle: {
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
    color: '#1E3A8A',
  },
  lastMileDesc: {
    fontSize: 12,
    fontFamily: 'Montserrat-Medium',
    color: '#1E3A8A',
    lineHeight: 18,
  },
  feeBreakdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#DBEAFE',
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
  },
  feeLabel: {
    fontSize: 12,
    fontFamily: 'Montserrat-SemiBold',
    color: '#1E3A8A',
  },
  feeValue: {
    fontSize: 12,
    fontFamily: 'Montserrat-Bold',
    color: '#1E3A8A',
  },
  disclaimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  checkboxWrapper: {
    padding: 4,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#1E3A8A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  checkboxChecked: {
    backgroundColor: '#1E3A8A',
  },
  disclaimerText: {
    fontSize: 11,
    fontFamily: 'Montserrat-Medium',
    color: '#1E3A8A',
    flex: 1,
  },
  disclaimerLink: {
    textDecorationLine: 'underline',
    fontFamily: 'Montserrat-Bold',
  },
  lastMileBtn: {
    backgroundColor: C.navy,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  lastMileBtnText: {
    color: C.textInverse,
    fontSize: 13,
    fontFamily: 'Montserrat-Bold',
  },
  disabledBtn: {
    opacity: 0.7,
  },
  lastMileRequestedCard: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  lastMileRequestedTitle: {
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
    color: '#16A34A',
  },
  lastMileRequestedDesc: {
    fontSize: 12,
    fontFamily: 'Montserrat-Medium',
    color: '#16A34A',
    lineHeight: 18,
  },
  emptyTimeline: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyTimelineText: {
    fontSize: 12,
    fontFamily: 'Montserrat-Medium',
    color: C.subtle,
    marginTop: 8,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timelineIndicators: {
    alignItems: 'center',
    marginRight: 12,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.navy,
    marginTop: 4,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: C.borderStrong,
    marginVertical: 4,
  },
  timelineContent: {
    flex: 1,
  },
  timelineStatus: {
    fontSize: 13,
    fontFamily: 'Montserrat-Bold',
    color: C.navy,
  },
  timelineLocation: {
    fontSize: 11,
    fontFamily: 'Montserrat-SemiBold',
    color: C.muted,
    marginTop: 2,
  },
  timelineNotes: {
    fontSize: 12,
    fontFamily: 'Montserrat-Medium',
    color: C.muted,
    fontStyle: 'italic',
    marginTop: 2,
  },
  timelineDate: {
    fontSize: 10,
    fontFamily: 'Montserrat-Regular',
    color: C.subtle,
    marginTop: 4,
  },
});
