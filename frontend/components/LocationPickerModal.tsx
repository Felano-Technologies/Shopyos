import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import MapView, { UrlTile } from '@/components/MapView';
import { OSM_TILE_URL_TEMPLATE } from '@/constants/mapTiles';
import * as Location from 'expo-location';
import { requestForegroundLocationWithDisclosure } from '@/src/utils/location';
import { GlassContainer } from 'expo-glass-effect';
import { GlassSurface } from '@/components/ui/GlassSurface';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useLocationStore } from '@/store/locationStore';

const ACCRA_FALLBACK = { latitude: 5.6037, longitude: -0.1870 };

type Props = {
  visible: boolean;
  onClose: () => void;
  // Extra callback purely for navigation side effects, e.g. cart.tsx wants
  // to jump to /checkout right after a first-time confirm; checkout/home
  // just close in place and leave it unset.
  onConfirmed?: () => void;
};

/**
 * Shared "pick my location" map picker — fixed center pin, drag-to-move,
 * Nominatim search-to-jump. Confirming writes straight into the app-wide
 * locationStore (persisted, reverse-geocoded), so every screen that renders
 * this sees the update immediately with no extra wiring.
 */
export default function LocationPickerModal({ visible, onClose, onConfirmed }: Props) {
  const colors = useThemeColors();
  const coords = useLocationStore((s) => s.coords);
  const setLocation = useLocationStore((s) => s.setLocation);

  const [mapSearchQuery, setMapSearchQuery] = useState('');
  const [tempMapCoords, setTempMapCoords] = useState(ACCRA_FALLBACK);
  const [liveCoords, setLiveCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const mapRef = useRef<MapView>(null);

  // Fetch the buyer's live position early so the map opens centered on
  // roughly where they are, instead of a fixed Accra default they'd have to
  // search/scroll away from every time.
  useEffect(() => {
    (async () => {
      try {
        const { status } = await requestForegroundLocationWithDisclosure();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setLiveCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        }
      } catch {
        // Falls back to the fixed default center — buyer can still search/drag.
      }
    })();
  }, []);

  // Seed the pin from the currently-saved location each time the picker
  // opens, else the live device position, else the Accra fallback.
  useEffect(() => {
    if (!visible) return;
    if (coords) {
      setTempMapCoords({ latitude: coords.lat, longitude: coords.lng });
    } else if (liveCoords) {
      setTempMapCoords(liveCoords);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // MapView's `initialRegion` only applies once, at the map's very first
  // mount — and <Modal> keeps its children mounted even while hidden, so the
  // map is actually created at whatever tempMapCoords was at that moment,
  // long before the buyer opens the picker. Explicitly re-center every time
  // the modal opens, same as the search box already does below.
  useEffect(() => {
    if (visible) {
      mapRef.current?.animateToRegion({
        latitude: tempMapCoords.latitude,
        longitude: tempMapCoords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 400);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Covers the race where the buyer opens the picker before the location
  // permission prompt/fetch has resolved — the map opens on the fallback,
  // then jumps to the real position as soon as it arrives (only if there's
  // no saved location yet and they haven't already dragged elsewhere).
  useEffect(() => {
    if (visible && liveCoords && !coords) {
      setTempMapCoords(liveCoords);
      mapRef.current?.animateToRegion({
        latitude: liveCoords.latitude,
        longitude: liveCoords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 400);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveCoords]);

  const handleMapSearch = async () => {
    const query = mapSearchQuery.trim();
    if (!query) return;
    Keyboard.dismiss();
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
        { headers: { 'User-Agent': 'ShopyosApp/1.0' } }
      );
      const results = await res.json();
      if (!results?.[0]) {
        CustomInAppToast.show({ type: 'info', title: 'No Results', message: `Couldn't find "${query}". Try a more specific address.` });
        return;
      }
      const { lat, lon } = results[0];
      mapRef.current?.animateToRegion({
        latitude: Number.parseFloat(lat),
        longitude: Number.parseFloat(lon),
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }, 1000);
    } catch (error) {
      console.warn('Map search failed:', error);
      CustomInAppToast.show({ type: 'error', title: 'Search Failed', message: 'Could not reach the map search service. Please drag the pin manually.' });
    }
  };

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await setLocation({ lat: tempMapCoords.latitude, lng: tempMapCoords.longitude });
      onClose();
      onConfirmed?.();
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide">
      <View style={{ flex: 1 }}>
        <MapView
          ref={mapRef}
          style={{ flex: 1 }}
          initialRegion={{
            latitude: tempMapCoords.latitude,
            longitude: tempMapCoords.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          onRegionChangeComplete={(region) => {
            setTempMapCoords({ latitude: region.latitude, longitude: region.longitude });
          }}
        >
          <UrlTile urlTemplate={OSM_TILE_URL_TEMPLATE} maximumZ={19} flipY={false} zIndex={-1} />
        </MapView>

        <View style={S.mapMarkerFixed} pointerEvents="none">
          <View style={S.markerCircle}><Ionicons name="location" size={26} color="#FFF" /></View>
          <View style={S.markerArrow} />
        </View>
        <SafeAreaView style={S.mapOverlay} pointerEvents="box-none">
          <GlassContainer style={S.mapSearchContainer} spacing={0}>
            <TouchableOpacity accessibilityLabel="Close location picker" accessibilityRole="button" onPress={onClose}>
              <GlassSurface style={S.mapSearchClose} isInteractive>
                <Ionicons name="arrow-back" size={24} color="#0C1559" />
              </GlassSurface>
            </TouchableOpacity>
            <GlassSurface style={S.mapSearchWrapper}>
              <Ionicons name="search" size={18} color="#94A3B8" />
              <TextInput
                accessibilityLabel="Search street or landmark"
                accessibilityRole="none"
                style={S.mapSearchInput}
                placeholder="Search street or landmark..."
                placeholderTextColor="#94A3B8"
                value={mapSearchQuery}
                onChangeText={setMapSearchQuery}
                onSubmitEditing={handleMapSearch}
                returnKeyType="search"
              />
              {mapSearchQuery.length > 0 && (
                <TouchableOpacity accessibilityLabel="Clear search" accessibilityRole="button" onPress={() => setMapSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </GlassSurface>
          </GlassContainer>

          <TouchableOpacity accessibilityLabel="Confirm delivery location" accessibilityRole="button" onPress={handleConfirm} disabled={confirming}>
            <GlassSurface style={[S.mapConfirmBtn, confirming && { opacity: 0.7 }]} tintColor={colors.primary} isInteractive>
              <LinearGradient colors={colors.headerGradient} style={S.mapConfirmGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={S.mapConfirmText}>Confirm Delivery Location</Text>
                <Feather name="check" size={20} color="#FFF" style={{ marginLeft: 10 }} />
              </LinearGradient>
            </GlassSurface>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const S = StyleSheet.create({
  mapMarkerFixed: { position: 'absolute', top: '50%', left: '50%', marginLeft: -24, marginTop: -48, alignItems: 'center', zIndex: 1 },
  markerCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#0C1559', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#FFF', elevation: 10 },
  markerArrow: { width: 0, height: 0, borderLeftWidth: 8, borderRightWidth: 8, borderBottomWidth: 12, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#0C1559', transform: [{ rotate: '180deg' }], marginTop: -2 },
  mapOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'space-between', padding: 20 },
  mapSearchContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  mapSearchWrapper: { flex: 1, height: 50, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 15, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, elevation: 5, shadowColor: '#000', shadowOpacity: 0.1 },
  mapSearchInput: { flex: 1, marginLeft: 10, fontFamily: 'Montserrat-Medium', color: '#0F172A', fontSize: 14 },
  mapSearchClose: { width: 50, height: 50, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 15, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  mapConfirmBtn: { borderRadius: 18, overflow: 'hidden', elevation: 10, marginBottom: 20 },
  mapConfirmGradient: { paddingVertical: 18, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  mapConfirmText: { color: '#FFF', fontFamily: 'Montserrat-Bold', fontSize: 16 },
});
