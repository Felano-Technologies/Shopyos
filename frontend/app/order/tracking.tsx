import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  Easing,
  Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

export default function OrderTrackingMap() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // Real data from params (passed from order details screen)
  const orderId        = params.orderId as string;
  const deliveryAddress = (params.deliveryAddress as string) || 'Delivery Address';
  const orderNumber    = (params.orderNumber as string) || '';
  // Driver params — only populated when a real driver is assigned
  const driverName    = params.driverName as string | undefined;
  const driverPhone   = params.driverPhone as string | undefined;
  const driverVehicle = params.driverVehicle as string | undefined;
  const driverPlate   = params.driverPlate as string | undefined;

  const hasDriver = !!driverName;

  // Animation Values
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Pulse Animation for User Location marker
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.5, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* --- Full Screen Map Background --- */}
      <View style={styles.mapContainer}>
        {/* Map placeholder — replace with <MapView> when ready */}
        <View style={styles.mapPlaceholder}>
          <MaterialCommunityIcons name="map-outline" size={64} color="#CBD5E1" />
          <Text style={styles.mapPlaceholderText}>Map view coming soon</Text>
        </View>

        {/* Map Overlay Gradient (Top) */}
        <LinearGradient
          colors={['rgba(255,255,255,0.9)', 'rgba(255,255,255,0)']}
          style={styles.topGradient}
        />

        {/* Back Button */}
        <SafeAreaView style={styles.topSafeArea}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#0F172A" />
          </TouchableOpacity>
        </SafeAreaView>

        {/* Destination Marker (always shown) */}
        <View style={styles.markersContainer}>
          <View style={styles.userMarkerContainer}>
            <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseAnim }] }]} />
            <View style={styles.userMarker}>
              <Ionicons name="home" size={18} color="#FFF" />
            </View>
            <View style={styles.markerLabel}>
              <Text style={styles.markerText}>Drop-off</Text>
            </View>
          </View>
        </View>
      </View>

      {/* --- Bottom Sheet --- */}
      <View style={[styles.bottomSheet, hasDriver ? { height: height * 0.42 } : { height: height * 0.32 }]}>
        <View style={styles.dragHandle} />

        {/* Status Header */}
        <View style={styles.statusHeader}>
          <View>
            <Text style={styles.statusTitle}>
              {hasDriver ? 'Driver is on the way' : 'Looking for a driver…'}
            </Text>
            {orderNumber ? (
              <Text style={styles.statusSub}>Order #{orderNumber}</Text>
            ) : null}
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: hasDriver ? '55%' : '25%' }]} />
          </View>
        </View>

        <View style={styles.divider} />

        {/* Driver Card — real or empty state */}
        {hasDriver ? (
          <View style={styles.driverCard}>
            {/* Avatar placeholder */}
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={26} color="#0C1559" />
            </View>
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>{driverName}</Text>
              <View style={styles.ratingRow}>
                <MaterialCommunityIcons name="bike" size={14} color="#64748B" />
                <Text style={styles.vehicleText}> {driverVehicle || 'Vehicle'}</Text>
              </View>
              {driverPlate ? (
                <Text style={styles.plateText}>{driverPlate}</Text>
              ) : null}
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
                We're finding the nearest driver for your order. This usually takes a few minutes.
              </Text>
            </View>
          </View>
        )}

        {/* Delivery Details */}
        <View style={styles.deliveryDetails}>
          <View style={styles.detailRow}>
            <View style={styles.iconBox}>
              <Ionicons name="location" size={20} color="#0C1559" />
            </View>
            <View style={styles.addressBox}>
              <Text style={styles.addressLabel}>Drop-off</Text>
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

  // Map Layer
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
  mapImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  topGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 120 },
  topSafeArea: { position: 'absolute', top: 0, left: 20, zIndex: 10 },
  backBtn: {
    width: 44, height: 44, backgroundColor: '#FFF', borderRadius: 22,
    justifyContent: 'center', alignItems: 'center', marginTop: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 5, elevation: 5,
  },

  // Markers
  markersContainer: {
    position: 'absolute', top: '30%', left: '20%', width: '60%', height: '40%',
  },
  userMarkerContainer: { position: 'absolute', top: 20, right: 20, alignItems: 'center' },
  pulseRing: {
    position: 'absolute', width: 60, height: 60, borderRadius: 30,
    backgroundColor: 'rgba(12, 21, 89, 0.2)', top: -12,
  },
  userMarker: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#0C1559',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: '#FFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 4, elevation: 6, zIndex: 2,
  },
  markerLabel: {
    position: 'absolute', top: -38, backgroundColor: '#0C1559',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignItems: 'center',
  },
  markerText: { color: '#FFF', fontSize: 10, fontFamily: 'Montserrat-Bold' },

  // Bottom Sheet
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

  // Status Section
  statusHeader: { marginBottom: 16 },
  statusTitle: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginBottom: 4 },
  statusSub: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: '#64748B', marginBottom: 10 },
  progressBar: { height: 4, backgroundColor: '#F1F5F9', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#84cc16', borderRadius: 2 },

  divider: { height: 1, backgroundColor: '#F1F5F9', marginBottom: 16 },

  // Real Driver Card
  driverCard: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
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

  // No-driver empty state
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

  // Delivery Details
  deliveryDetails: { backgroundColor: '#F8FAFC', padding: 14, borderRadius: 16 },
  detailRow: { flexDirection: 'row', alignItems: 'center' },
  iconBox: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: '#E0E7FF',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  addressBox: { flex: 1 },
  addressLabel: { fontSize: 11, fontFamily: 'Montserrat-Medium', color: '#64748B', marginBottom: 2 },
  addressText: { fontSize: 14, fontFamily: 'Montserrat-SemiBold', color: '#0F172A' },
});

