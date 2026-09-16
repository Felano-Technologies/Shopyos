// components/onboarding/LocationField.tsx
// Self-contained map location picker — ported from the old
// app/business/businessRegistration.tsx flow (fixed center pin, drag-to-pan,
// OSM/Nominatim address search) so both the seller (shop_location) and
// driver (operating_location) wizards can let the applicant point at an
// actual place instead of only typing an address string.
import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, Keyboard, StyleSheet } from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassContainer } from 'expo-glass-effect';
import { GlassSurface } from '@/components/ui/GlassSurface';
import * as Location from 'expo-location';
import MapView, { UrlTile } from '@/components/MapView';
import { OSM_TILE_URL_TEMPLATE } from '@/constants/mapTiles';
import { requestLocationPermissionWithDisclosure } from '@/src/utils/permissions';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { FieldLabel, getSharedStyles } from './FormControls';

const DEFAULT_COORDS = { latitude: 5.6037, longitude: -0.1870 }; // Accra — last-resort fallback only, when GPS is unavailable/denied

export const LocationField: React.FC<{
  label: string;
  latitude: string;
  longitude: string;
  onChange: (latitude: string, longitude: string) => void;
  confirmLabel?: string;
}> = ({ label, latitude, longitude, onChange, confirmLabel = 'Set Location' }) => {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const styles = getSharedStyles(colors);
  const mapRef = useRef<MapView>(null);
  const [visible, setVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [tempCoords, setTempCoords] = useState(DEFAULT_COORDS);

  const hasLocation = !!latitude && !!longitude;

  const open = async () => {
    const lat = Number.parseFloat(latitude);
    const lon = Number.parseFloat(longitude);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      // Already has a saved pin — reopen centered on that, don't override
      // it with the device's current position.
      setTempCoords({ latitude: lat, longitude: lon });
      setVisible(true);
      return;
    }

    // No pin yet — open centered on the device's actual current location
    // instead of a fixed Accra default, so someone in Kumasi (or anywhere
    // else) doesn't have to manually drag the map across the country to
    // find themselves. Show the modal immediately with the fallback so
    // there's no blocking wait for GPS to resolve, then animate to the
    // real position once it's available.
    setTempCoords(DEFAULT_COORDS);
    setVisible(true);
    try {
      const { status } = await requestLocationPermissionWithDisclosure();
      if (status !== Location.PermissionStatus.GRANTED) return;
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const current = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      setTempCoords(current);
      mapRef.current?.animateToRegion({ ...current, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 800);
    } catch {
      // Keep the Accra fallback — the user can still search or drag manually.
    }
  };

  const confirm = () => {
    onChange(String(tempCoords.latitude), String(tempCoords.longitude));
    setVisible(false);
    CustomInAppToast.show({ type: 'success', title: 'Location Pinned', message: 'Your location has been saved.' });
  };

  const handleSearch = async () => {
    const query = searchQuery.trim();
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

  return (
    <View style={styles.fieldWrap}>
      <FieldLabel label={label} />
      <TouchableOpacity style={mapFieldStyles.trigger(colors, hasLocation)} onPress={open}>
        <Ionicons name={hasLocation ? 'checkmark-circle' : 'map-outline'} size={20} color={hasLocation ? colors.success : colors.textMuted} />
        <Text style={[mapFieldStyles.triggerText, { color: hasLocation ? colors.success : colors.textMuted }]}>
          {hasLocation ? 'Location set — tap to change' : 'Tap to set location on map'}
        </Text>
      </TouchableOpacity>

      <Modal visible={visible} animationType="slide">
        <View style={{ flex: 1 }}>
          <MapView
            ref={mapRef}
            style={{ flex: 1 }}
            initialRegion={{ latitude: tempCoords.latitude, longitude: tempCoords.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
            onRegionChangeComplete={(region: any) => setTempCoords({ latitude: region.latitude, longitude: region.longitude })}
          >
            <UrlTile urlTemplate={OSM_TILE_URL_TEMPLATE} maximumZ={19} flipY={false} zIndex={-1} />
          </MapView>

          <View style={mapFieldStyles.markerFixed} pointerEvents="none">
            <View style={[mapFieldStyles.markerCircle, { backgroundColor: colors.primary }]}>
              <MaterialCommunityIcons name="map-marker" size={26} color="#FFF" />
            </View>
            <View style={[mapFieldStyles.markerArrow, { borderTopColor: colors.primary }]} />
          </View>

          {/* 'top' excluded — handled explicitly via insets.top on the
              search GlassContainer below instead, since GlassContainer
              (grouped Liquid Glass surfaces) doesn't reliably inherit a
              plain SafeAreaView's top padding the way the ungrouped confirm
              button does; letting both apply would double the top offset. */}
          <SafeAreaView style={mapFieldStyles.overlay} edges={['left', 'right', 'bottom']} pointerEvents="box-none">
            <GlassContainer style={[mapFieldStyles.searchContainer, { marginTop: insets.top + 10 }]} spacing={0}>
              <TouchableOpacity onPress={() => setVisible(false)}>
                <GlassSurface style={mapFieldStyles.closeBtn} isInteractive>
                  <Ionicons name="arrow-back" size={24} color={colors.primary} />
                </GlassSurface>
              </TouchableOpacity>
              <GlassSurface style={mapFieldStyles.searchWrapper} isInteractive>
                <Ionicons name="search" size={18} color={colors.textMuted} />
                <TextInput
                  style={[mapFieldStyles.searchInput, { color: colors.text }]}
                  placeholder="Search street or landmark..."
                  placeholderTextColor={colors.textMuted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onSubmitEditing={handleSearch}
                  returnKeyType="search"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                )}
              </GlassSurface>
            </GlassContainer>

            <TouchableOpacity onPress={confirm}>
              <GlassSurface style={mapFieldStyles.confirmBtn} tintColor={colors.primary} isInteractive>
                <LinearGradient colors={colors.headerGradient} style={mapFieldStyles.confirmGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  <Text style={mapFieldStyles.confirmText}>{confirmLabel}</Text>
                  <Feather name="check" size={20} color="#FFF" style={{ marginLeft: 10 }} />
                </LinearGradient>
              </GlassSurface>
            </TouchableOpacity>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
};

const mapFieldStyles = {
  trigger: (c: ThemeColors, active: boolean) => ({
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, borderWidth: 1,
    borderColor: active ? c.success : c.border, borderRadius: 14, paddingHorizontal: 14, height: 52, backgroundColor: c.surface,
  }),
  triggerText: { fontSize: 14, fontFamily: 'Montserrat-Medium' as const },
  ...StyleSheet.create({
    markerFixed: { position: 'absolute', top: '50%', left: '50%', marginLeft: -24, marginTop: -48, alignItems: 'center', zIndex: 1 },
    markerCircle: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#FFF', elevation: 6 },
    markerArrow: { width: 0, height: 0, borderLeftWidth: 8, borderRightWidth: 8, borderTopWidth: 12, borderLeftColor: 'transparent', borderRightColor: 'transparent', marginTop: -2 },
    overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'space-between', padding: 16 },
    searchContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 16 },
    closeBtn: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    searchWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, paddingHorizontal: 14, height: 44 },
    searchInput: { flex: 1, fontSize: 14, fontFamily: 'Montserrat-Medium' },
    confirmBtn: { borderRadius: 16, overflow: 'hidden' },
    confirmGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },
    confirmText: { color: '#FFF', fontSize: 15, fontFamily: 'Montserrat-Bold' },
  }),
};
