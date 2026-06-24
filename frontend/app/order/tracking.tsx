import React, { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  Linking,
} from 'react-native';
import AppImage from '@/components/AppImage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import MapView, { Marker, Polyline, UrlTile } from '@/components/MapView';
import { socketService } from '@/services/socket';
import { getLatestLocation, fetchDrivingRoute, haversineMetres } from '@/services/delivery';

const { height } = Dimensions.get('window');

type Coord = { latitude: number; longitude: number };

async function computeAndSetRoute(
  from: Coord,
  customerCoord: Coord,
  lastRef: React.MutableRefObject<Coord | null>,
  setRouteCoords: (coords: Coord[]) => void,
  setEtaMinutes: (mins: number) => void,
) {
  if (lastRef.current && haversineMetres(lastRef.current, from) < 50) return;
  lastRef.current = from;
  const result = await fetchDrivingRoute(from, customerCoord);
  if (result) {
    setRouteCoords(result.coords);
    setEtaMinutes(Math.round(result.durationSecs / 60));
  }
}

export default function OrderTrackingMap() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const deliveryId = params.deliveryId as string | undefined;
  const deliveryAddress = (params.deliveryAddress as string) || 'Delivery Address';
  const orderNumber = (params.orderNumber as string) || '';
  const driverName = params.driverName as string | undefined;
  const driverAvatar = params.driverAvatar as string | undefined;
  const driverPhone = params.driverPhone as string | undefined;
  const driverVehicle = params.driverVehicle as string | undefined;
  const driverPlate = params.driverPlate as string | undefined;
  const storeName = params.storeName as string | undefined;
  const storeLogo = params.storeLogo as string | undefined;
  const storeCategory = params.storeCategory as string | undefined;
  const orderStatus = (params.orderStatus as string | undefined)?.toLowerCase();
  const deliveryStatus = (params.deliveryStatus as string | undefined)?.toLowerCase();

  const customerCoord = useMemo<Coord | null>(
    () => params.deliveryLatitude && params.deliveryLongitude
      ? { latitude: Number.parseFloat(params.deliveryLatitude as string), longitude: Number.parseFloat(params.deliveryLongitude as string) }
      : null,
    [params.deliveryLatitude, params.deliveryLongitude]
  );

  const storeCoord: Coord | null =
    params.storeLatitude && params.storeLongitude
      ? { latitude: Number.parseFloat(params.storeLatitude as string), longitude: Number.parseFloat(params.storeLongitude as string) }
      : null;

  const hasDriver = !!driverName;

  const [driverCoord, setDriverCoord] = useState<Coord | null>(null);
  const [routeCoords, setRouteCoords] = useState<Coord[]>([]);
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);
  const lastRouteFetchCoord = useRef<Coord | null>(null);
  const mapRef = useRef<any>(null);
  const lastUpdateTime = useRef<number | null>(null);
  const [, forceUpdate] = useState(0);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.5, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);

  // Auto-fit camera to all visible markers
  useEffect(() => {
    const coords = [driverCoord, customerCoord, storeCoord].filter(Boolean) as Coord[];
    if (coords.length < 2) return;
    mapRef.current?.fitToCoordinates(coords, {
      edgePadding: { top: 80, right: 60, bottom: 440, left: 60 },
      animated: true,
    });
  }, [driverCoord, customerCoord, storeCoord]);

  // Stale location ticker — re-renders every 30s to update "last updated X min ago" label
  useEffect(() => {
    const id = setInterval(() => forceUpdate(n => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const updateRoute = useCallback(async (from: Coord) => {
    if (!customerCoord) return;
    await computeAndSetRoute(from, customerCoord, lastRouteFetchCoord, setRouteCoords, setEtaMinutes);
  }, [customerCoord]);

  // Seed initial driver position via TanStack Query (staleTime avoids re-fetch on quick remount)
  const { data: seedData } = useQuery({
    queryKey: ['delivery-location', deliveryId],
    queryFn: () => getLatestLocation(deliveryId!),
    staleTime: 30_000,
    enabled: !!deliveryId,
  });

  useEffect(() => {
    if (seedData?.location) {
      const coord: Coord = { latitude: seedData.location.latitude, longitude: seedData.location.longitude };
      setDriverCoord(coord);
      updateRoute(coord);
    }
  }, [seedData, updateRoute]);

  const handleLocationUpdate = useCallback((data: any) => {
    if (data.deliveryId !== deliveryId) return;
    const coord: Coord = { latitude: data.latitude, longitude: data.longitude };
    lastUpdateTime.current = Date.now();
    setDriverCoord(coord);
    updateRoute(coord);
  }, [deliveryId, updateRoute]);

  // Live socket updates
  useEffect(() => {
    if (!deliveryId) return;
    let mounted = true;
    socketService.connect().then((socket) => {
      if (!mounted) return;
      socket.on('delivery:location_update', handleLocationUpdate);
    });
    return () => {
      mounted = false;
      socketService.getSocket()?.off('delivery:location_update');
    };
  }, [deliveryId, handleLocationUpdate]);

  const bottomSheetHeight = hasDriver ? height * 0.45 : height * 0.35;

  const DELIVERED_STATUSES = ['delivered', 'completed', 'done'];
  const isDelivered = DELIVERED_STATUSES.includes(orderStatus ?? '') || DELIVERED_STATUSES.includes(deliveryStatus ?? '');

  let statusTitle: string;
  let progressFillWidth: string;
  if (isDelivered) {
    statusTitle = 'Order Delivered';
    progressFillWidth = '100%';
  } else if (deliveryStatus === 'en_route_to_pickup') {
    statusTitle = 'Driver heading to store';
    progressFillWidth = '35%';
  } else if (deliveryStatus === 'arrived_at_pickup') {
    statusTitle = 'Driver at the store';
    progressFillWidth = '45%';
  } else if (hasDriver) {
    statusTitle = 'Driver is on the way';
    progressFillWidth = '55%';
  } else {
    statusTitle = 'Looking for a driver…';
    progressFillWidth = '25%';
  }

  let etaLabel: string | null;
  if (etaMinutes === null) {
    etaLabel = null;
  } else if (etaMinutes < 1) {
    etaLabel = 'Almost here!';
  } else if (etaMinutes >= 60) {
    const h = Math.floor(etaMinutes / 60);
    const m = etaMinutes % 60;
    etaLabel = `~${h}h${m > 0 ? ` ${m}m` : ''} away`;
  } else {
    etaLabel = `~${etaMinutes} min away`;
  }

  const staleMs = lastUpdateTime.current ? Date.now() - lastUpdateTime.current : null;
  const staleLabel = driverCoord && staleMs !== null && staleMs > 120_000
    ? `Updated ${Math.floor(staleMs / 60_000)} min ago`
    : null;

  const mapRegion = customerCoord
    ? { ...customerCoord, latitudeDelta: 0.05, longitudeDelta: 0.05 }
    : undefined;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Full-screen map */}
      <View style={styles.mapContainer}>
        {mapRegion ? (
          <MapView ref={mapRef} style={StyleSheet.absoluteFillObject} initialRegion={mapRegion}>
            <UrlTile
              urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              maximumZ={19}
              flipY={false}
              zIndex={-1}
            />
            {driverCoord && (
              <Marker coordinate={driverCoord} title="Driver">
                <Animated.View style={[styles.driverPin, { transform: [{ scale: pulseAnim }] }]}>
                  <MaterialCommunityIcons name="bike-fast" size={18} color="#FFF" />
                </Animated.View>
              </Marker>
            )}
            {storeCoord && (
              <Marker coordinate={storeCoord} title="Pickup">
                <View style={styles.storePin}>
                  <MaterialCommunityIcons name="storefront-outline" size={16} color="#FFF" />
                </View>
              </Marker>
            )}
            {customerCoord && (
              <Marker coordinate={customerCoord} title="Drop-off">
                <View style={styles.customerPin}>
                  <Ionicons name="home" size={16} color="#FFF" />
                </View>
              </Marker>
            )}
            {routeCoords.length > 1 && (
              <Polyline
                coordinates={routeCoords}
                strokeColor="#0C1559"
                strokeWidth={4}
              />
            )}
          </MapView>
        ) : (
          <View style={styles.mapPlaceholder}>
            <MaterialCommunityIcons name="map-outline" size={64} color="#CBD5E1" />
            <Text style={styles.mapPlaceholderText}>Loading map…</Text>
          </View>
        )}

        <LinearGradient
          colors={['rgba(255,255,255,0.9)', 'rgba(255,255,255,0)']}
          style={styles.topGradient}
        />
        <SafeAreaView style={styles.topSafeArea}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#0F172A" />
          </TouchableOpacity>
        </SafeAreaView>
      </View>

      {/* Bottom sheet */}
      <View style={[styles.bottomSheet, { height: bottomSheetHeight }]}>
        <View style={styles.dragHandle} />

        {/* Status header */}
        <View style={styles.statusHeader}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.statusTitle}>{statusTitle}</Text>
              {orderNumber ? (
                <Text style={styles.statusSub}>Order #{orderNumber}</Text>
              ) : null}
              {etaLabel && (
                <View style={styles.etaPill}>
                  <MaterialCommunityIcons name="clock-fast" size={13} color="#16A34A" />
                  <Text style={styles.etaText}>{etaLabel}</Text>
                </View>
              )}
              {staleLabel && (
                <Text style={styles.staleText}>{staleLabel}</Text>
              )}
            </View>
            {storeLogo && (
              <View style={styles.storeLogoBadge}>
                <AppImage uri={storeLogo} style={styles.miniLogo} />
              </View>
            )}
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: progressFillWidth }]} />
          </View>
        </View>

        <View style={styles.divider} />

        {/* Driver card */}
        {hasDriver ? (
          <View style={styles.driverCard}>
            <View style={styles.avatarContainer}>
              {driverAvatar ? (
                <AppImage uri={driverAvatar} style={styles.driverAvatarImg} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={26} color="#0C1559" />
                </View>
              )}
            </View>
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>{driverName}</Text>
              <View style={styles.ratingRow}>
                <MaterialCommunityIcons name="bike" size={14} color="#64748B" />
                <Text style={styles.vehicleText}> {driverVehicle || 'Vehicle'}</Text>
              </View>
              {driverPlate ? <Text style={styles.plateText}>{driverPlate}</Text> : null}
            </View>
            <View style={styles.actionButtons}>
              {driverPhone && (
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => Linking.openURL(`tel:${driverPhone}`)}
                >
                  <Ionicons name="call" size={22} color="#0C1559" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.noDriverCard}>
            <View style={styles.noDriverIconBg}>
              <MaterialCommunityIcons name="bike-fast" size={30} color="#0C1559" />
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={styles.noDriverTitle}>No driver assigned yet</Text>
              <Text style={styles.noDriverSub}>
                We&apos;re finding the nearest driver for your order. This usually takes a few minutes.
              </Text>
            </View>
          </View>
        )}

        {/* Delivery details */}
        <View style={styles.deliveryDetails}>
          <View style={styles.detailRow}>
            <View style={styles.iconBox}>
              <Ionicons name="location" size={20} color="#0C1559" />
            </View>
            <View style={styles.addressBox}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={styles.addressLabel}>Drop-off</Text>
                {storeName && (
                  <Text style={styles.storeTag}>{storeCategory || 'Store'} · {storeName}</Text>
                )}
              </View>
              <Text style={styles.addressText} numberOfLines={2}>{deliveryAddress}</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  mapContainer: {
    ...StyleSheet.absoluteFillObject,
    height: height * 0.75,
  },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapPlaceholderText: {
    marginTop: 12,
    fontSize: 14,
    fontFamily: 'Montserrat-Medium',
    color: '#94A3B8',
  },
  topGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 120 },
  topSafeArea: { position: 'absolute', top: 0, left: 20, zIndex: 10 },
  backBtn: {
    width: 44, height: 44, backgroundColor: '#FFF', borderRadius: 22,
    justifyContent: 'center', alignItems: 'center', marginTop: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 5, elevation: 5,
  },
  // Map marker pins
  driverPin: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#0C1559',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#A3E635',
  },
  storePin: {
    width: 32, height: 32, borderRadius: 8, backgroundColor: '#16A34A',
    justifyContent: 'center', alignItems: 'center',
  },
  customerPin: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#0C1559',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: '#FFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 4, elevation: 6,
  },
  // Bottom sheet
  bottomSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFF',
    borderTopLeftRadius: 30, borderTopRightRadius: 30,
    paddingHorizontal: 24, paddingTop: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.1, shadowRadius: 10, elevation: 10,
  },
  dragHandle: {
    width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2,
    alignSelf: 'center', marginBottom: 20,
  },
  statusHeader: { marginBottom: 16 },
  statusTitle: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginBottom: 4 },
  statusSub: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: '#64748B', marginBottom: 6 },
  etaPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#DCFCE7', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, alignSelf: 'flex-start', marginBottom: 8,
  },
  etaText: { fontSize: 12, fontFamily: 'Montserrat-Bold', color: '#16A34A' },
  staleText: { fontSize: 10, fontFamily: 'Montserrat-Medium', color: '#94A3B8', marginTop: 3 },
  progressBar: { height: 4, backgroundColor: '#F1F5F9', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#84cc16', borderRadius: 2 },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginBottom: 16 },
  driverCard: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  avatarContainer: { width: 52, height: 52, borderRadius: 26, overflow: 'hidden' },
  driverAvatarImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  avatarPlaceholder: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: '#E0E7FF',
    justifyContent: 'center', alignItems: 'center',
  },
  driverInfo: { flex: 1, marginLeft: 14 },
  driverName: { fontSize: 15, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginBottom: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center' },
  vehicleText: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: '#64748B' },
  plateText: { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: '#64748B', marginTop: 2 },
  actionButtons: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#F1F5F9',
    justifyContent: 'center', alignItems: 'center',
  },
  noDriverCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8FAFC', borderRadius: 18,
    padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: '#E2E8F0', borderStyle: 'dashed',
  },
  noDriverIconBg: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: '#E0E7FF',
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  noDriverTitle: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginBottom: 4 },
  noDriverSub: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: '#64748B', lineHeight: 18 },
  deliveryDetails: { backgroundColor: '#F8FAFC', padding: 14, borderRadius: 16 },
  detailRow: { flexDirection: 'row', alignItems: 'center' },
  iconBox: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: '#E0E7FF',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  addressBox: { flex: 1 },
  addressLabel: { fontSize: 11, fontFamily: 'Montserrat-Medium', color: '#64748B', marginBottom: 2 },
  addressText: { fontSize: 14, fontFamily: 'Montserrat-SemiBold', color: '#0F172A' },
  storeLogoBadge: { width: 36, height: 36, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#E2E8F0' },
  miniLogo: { width: '100%', height: '100%' },
  storeTag: { fontSize: 10, fontFamily: 'Montserrat-Bold', color: '#0C1559', backgroundColor: '#ECFCCB', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
});
