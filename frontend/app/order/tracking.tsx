import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Animated,
  Easing,
  Platform,
  Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

// --- Mock Data ---
const MOCK_ORDER = {
  id: 'ORD-8943',
  eta: '15-20 min',
  status: 'On the way',
  driver: {
    name: 'Samuel Osei',
    vehicle: 'Honda Ace 125',
    plate: 'GT-4592-23',
    rating: 4.8,
    phone: '+233540000000',
    avatar: 'https://api.dicebear.com/9.x/adventurer/png?seed=Samuel'
  },
  deliveryAddress: 'KNUST Campus, Republic Hall',
  currentLocation: 'Tech Junction',
};

export default function OrderTrackingMap() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  // Animation Values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const driverPosition = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const [bottomSheetHeight, setBottomSheetHeight] = useState(height * 0.35);

  useEffect(() => {
    // Pulse Animation for User Location
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.5,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Simulate Driver Movement
    startDriverAnimation();
  }, []);

  const startDriverAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(driverPosition, {
          toValue: { x: 20, y: 40 }, 
          duration: 4000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(driverPosition, {
          toValue: { x: 0, y: 0 },
          duration: 4000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const handleCallDriver = () => {
    Linking.openURL(`tel:${MOCK_ORDER.driver.phone}`);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* --- Full Screen Map Background --- */}
      <View style={styles.mapContainer}>
        {/* Replace this Image with <MapView> later when ready */}
        <Image 
          source={{ uri: 'https://i.imgur.com/83g2v6z.png' }} // High-res map image placeholder
          style={styles.mapImage}
        />
        
        {/* Map Overlay Gradient (Top) */}
        <LinearGradient
          colors={['rgba(255,255,255,0.9)', 'rgba(255,255,255,0)']}
          style={styles.topGradient}
        />

        {/* --- Back Button --- */}
        <SafeAreaView style={styles.topSafeArea}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={24} color="#0F172A" />
            </TouchableOpacity>
        </SafeAreaView>

        {/* --- Route Path & Markers --- */}
        <View style={styles.markersContainer}>
            {/* User Destination Marker */}
            <View style={styles.userMarkerContainer}>
                <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseAnim }] }]} />
                <View style={styles.userMarker}>
                    <Ionicons name="home" size={18} color="#FFF" />
                </View>
                <View style={styles.markerLabel}>
                    <Text style={styles.markerText}>You</Text>
                    <Text style={styles.markerTime}>{MOCK_ORDER.eta}</Text>
                </View>
            </View>

            {/* Driver Marker (Animated) */}
            <Animated.View 
                style={[
                    styles.driverMarkerContainer,
                    { transform: driverPosition.getTranslateTransform() }
                ]}
            >
                <View style={styles.driverMarker}>
                    <MaterialCommunityIcons name="bike" size={20} color="#FFF" />
                </View>
                <View style={styles.driverBubble}>
                    <Text style={styles.driverBubbleText}>{MOCK_ORDER.driver.name}</Text>
                </View>
            </Animated.View>
        </View>
      </View>

      {/* --- Bottom Sheet Info --- */}
      <View style={[styles.bottomSheet, { height: bottomSheetHeight }]}>
        <View style={styles.dragHandle} />

        {/* Status Header */}
        <View style={styles.statusHeader}>
            <View>
                <Text style={styles.statusTitle}>Arriving in {MOCK_ORDER.eta}</Text>
                <Text style={styles.statusSub}>{MOCK_ORDER.status} • {MOCK_ORDER.currentLocation}</Text>
            </View>
            <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: '65%' }]} />
            </View>
        </View>

        <View style={styles.divider} />

        {/* Driver Profile */}
        <View style={styles.driverCard}>
            <Image source={{ uri: MOCK_ORDER.driver.avatar }} style={styles.driverAvatar} />
            <View style={styles.driverInfo}>
                <Text style={styles.driverName}>{MOCK_ORDER.driver.name}</Text>
                <View style={styles.ratingRow}>
                    <Ionicons name="star" size={14} color="#F59E0B" />
                    <Text style={styles.ratingText}>{MOCK_ORDER.driver.rating}</Text>
                    <Text style={styles.vehicleText}> • {MOCK_ORDER.driver.vehicle}</Text>
                </View>
                <Text style={styles.plateText}>{MOCK_ORDER.driver.plate}</Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
                <TouchableOpacity style={styles.actionBtn} onPress={handleCallDriver}>
                    <Ionicons name="call" size={22} color="#0C1559" />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.chatBtn]} onPress={() => router.push('/chat')}>
                    <Ionicons name="chatbubble-ellipses" size={22} color="#FFF" />
                </TouchableOpacity>
            </View>
        </View>

        {/* Delivery Details */}
        <View style={styles.deliveryDetails}>
            <View style={styles.detailRow}>
                <View style={styles.iconBox}>
                    <Ionicons name="location" size={20} color="#0C1559" />
                </View>
                <View style={styles.addressBox}>
                    <Text style={styles.addressLabel}>Drop-off</Text>
                    <Text style={styles.addressText} numberOfLines={1}>{MOCK_ORDER.deliveryAddress}</Text>
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
    height: height * 0.75, // Takes up top 75%
  },
  mapImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  topSafeArea: {
    position: 'absolute',
    top: 0,
    left: 20,
    zIndex: 10,
  },
  backBtn: {
    width: 44,
    height: 44,
    backgroundColor: '#FFF',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 5,
  },

  // Markers
  markersContainer: {
    position: 'absolute',
    top: '30%',
    left: '20%',
    width: '60%',
    height: '40%',
  },
  
  // User Marker
  userMarkerContainer: {
    position: 'absolute',
    top: 20,
    right: 20,
    alignItems: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(12, 21, 89, 0.2)',
    top: -12,
  },
  userMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0C1559',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
    zIndex: 2,
  },
  markerLabel: {
    position: 'absolute',
    top: -45,
    backgroundColor: '#0C1559',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignItems: 'center',
  },
  markerText: { color: '#FFF', fontSize: 10, fontFamily: 'Montserrat-Bold' },
  markerTime: { color: '#84cc16', fontSize: 10, fontFamily: 'Montserrat-Bold' },

  // Driver Marker
  driverMarkerContainer: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    alignItems: 'center',
  },
  driverMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
    zIndex: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  driverBubble: {
    position: 'absolute',
    top: -30,
    backgroundColor: '#FFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  driverBubbleText: { fontSize: 10, fontFamily: 'Montserrat-Bold', color: '#0F172A' },

  // Bottom Sheet
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 24,
    paddingTop: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },

  // Status Section
  statusHeader: { marginBottom: 20 },
  statusTitle: { fontSize: 20, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginBottom: 4 },
  statusSub: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: '#64748B', marginBottom: 15 },
  progressBar: { height: 4, backgroundColor: '#F1F5F9', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#84cc16', borderRadius: 2 },
  
  divider: { height: 1, backgroundColor: '#F1F5F9', marginBottom: 20 },

  // Driver Card
  driverCard: { flexDirection: 'row', alignItems: 'center', marginBottom: 25 },
  driverAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#F1F5F9' },
  driverInfo: { flex: 1, marginLeft: 16 },
  driverName: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginBottom: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center' },
  ratingText: { fontSize: 12, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginLeft: 4 },
  vehicleText: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: '#64748B' },
  plateText: { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: '#64748B', marginTop: 2 },

  actionButtons: { flexDirection: 'row', gap: 12 },
  actionBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  chatBtn: { backgroundColor: '#0C1559' },

  // Delivery Details
  deliveryDetails: { backgroundColor: '#F8FAFC', padding: 16, borderRadius: 16 },
  detailRow: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#E0E7FF', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  addressBox: { flex: 1 },
  addressLabel: { fontSize: 11, fontFamily: 'Montserrat-Medium', color: '#64748B', marginBottom: 2 },
  addressText: { fontSize: 14, fontFamily: 'Montserrat-SemiBold', color: '#0F172A' },
});