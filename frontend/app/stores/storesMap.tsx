import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, StyleSheet, Text, Image, TouchableOpacity,
  Dimensions, ActivityIndicator, FlatList, TextInput,
  ScrollView, Animated,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from '@/components/MapView';
import Circle from '@/components/MapCircle';
import * as Location from 'expo-location';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { getAllStores } from '@/services/api';
const { width, height } = Dimensions.get('window');
const CARD_W   = width * 0.72;
const CARD_GAP = 12;
const SNAP_W   = CARD_W + CARD_GAP;
// ─── Tokens ───────────────────────────────────────────────────────────────────
const C = {
  navy:    '#0C1559',
  navyMid: '#1e3a8a',
  lime:    '#84cc16',
  limeAlt: '#1a2e00',
  card:    '#FFFFFF',
  body:    '#0F172A',
  muted:   '#64748B',
  subtle:  '#94A3B8',
};
// ─── Radius options (km) ──────────────────────────────────────────────────────
const RADIUS_OPTIONS = [1, 2, 5, 10];
// ─── Category chips ───────────────────────────────────────────────────────────
const CATEGORIES = ['All', 'Fashion', 'Electronics', 'Grocery', 'Art', 'Home', 'Footwear'];
// ─── Haversine distance (km) ─────────────────────────────────────────────────
// This is the core "stores near me" logic — gives accurate real-world distance
// between two lat/lng pairs without needing a third-party API.
function haversineKm(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R  = 6371; // Earth radius in km
  const dL = ((lat2 - lat1) * Math.PI) / 180;
  const dO = ((lon2 - lon1) * Math.PI) / 180;
  const a  =
    Math.sin(dL / 2) * Math.sin(dL / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dO / 2) * Math.sin(dO / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function fmtDist(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}
function initials(name: string): string {
  return (name || 'S').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}
// Fixed fallback colours for stores without logos
const FALLBACK_COLORS = [
  ['#1e3a8a', '#0C1559'],
  ['#166534', '#14532d'],
  ['#9d174d', '#831843'],
  ['#92400e', '#78350f'],
  ['#4c1d95', '#3b0764'],
];
interface StoreItem {
  id: string;
  name: string;
  category: string;
  rating: number;
  reviewCount: number;
  logo: string | null;
  catalogues: number;
  verified: boolean;
  latitude: number;
  longitude: number;
  distanceKm: number;
  colorIdx: number;
}
export default function StoresMap() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const mapRef  = useRef<MapView>(null);
  const listRef = useRef<FlatList>(null);
  const [userCoords,    setUserCoords]    = useState<{ latitude: number; longitude: number } | null>(null);
  const [allStores,     setAllStores]     = useState<StoreItem[]>([]);
  const [filteredStores, setFiltered]     = useState<StoreItem[]>([]);
  const [loading,        setLoading]      = useState(true);
  const [activeIndex,    setActiveIndex]  = useState(0);
  const [radiusKm,       setRadiusKm]     = useState(2);
  const [activeCategory, setCategory]     = useState('All');
  const [searchQuery,    setSearch]        = useState('');
  const [showRadiusPicker, setShowRadius] = useState(false);
  // Pulse animation for active marker
  const pulseAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);
  // ── Load location + stores ──────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        let coords = { latitude: 6.6745, longitude: -1.5716 }; // Kumasi fallback
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        }
        setUserCoords(coords);
        const res = await getAllStores({});
        if (res.success) {
          const mapped: StoreItem[] = (res.businesses || []).map((b: any, i: number) => {
            // Use real coordinates if present, otherwise scatter near user
            // (remove the fallback scatter in production — all stores should have coords)
            const lat = b.latitude  ? parseFloat(b.latitude)
              : coords.latitude  + (Math.random() - 0.5) * 0.04;
            const lng = b.longitude ? parseFloat(b.longitude)
              : coords.longitude + (Math.random() - 0.5) * 0.04;
            return {
              id:          b.id,
              name:        b.name        || 'Unknown Store',
              category:    b.category    || 'General',
              rating:      b.rating      || 0,
              reviewCount: b.reviewCount || 0,
              logo:        b.logo        || null,
              catalogues:  b.catalogues  || 0,
              verified:    b.verified    || false,
              latitude:    lat,
              longitude:   lng,
              distanceKm:  haversineKm(coords.latitude, coords.longitude, lat, lng),
              colorIdx:    i % FALLBACK_COLORS.length,
            };
          });
          // Sort by distance — nearest first, just like Snapchat's map
          mapped.sort((a, b) => a.distanceKm - b.distanceKm);
          setAllStores(mapped);
        }
      } catch (err) {
        console.error('StoresMap init error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  // ── Apply filters (radius + category + search) ─────────────────────────────
  useEffect(() => {
    let result = allStores.filter((s) => s.distanceKm <= radiusKm);
    if (activeCategory !== 'All') {
      result = result.filter(
        (s) => s.category.toLowerCase() === activeCategory.toLowerCase()
      );
    }
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q)
      );
    }
    setFiltered(result);
    setActiveIndex(0);
  }, [allStores, radiusKm, activeCategory, searchQuery]);
  // ── Animate map to active store ────────────────────────────────────────────
  const animateToStore = useCallback(
    (store: StoreItem) => {
      mapRef.current?.animateToRegion(
        {
          latitude:      store.latitude  - 0.002, // slight offset so card doesn't hide marker
          longitude:     store.longitude,
          latitudeDelta: 0.012,
          longitudeDelta: 0.012,
        },
        600
      );
    },
    []
  );
  // When activeIndex changes, animate map
  useEffect(() => {
    if (filteredStores[activeIndex]) {
      animateToStore(filteredStores[activeIndex]);
    }
  }, [activeIndex, animateToStore, filteredStores]);
  // ── Carousel scroll → update active marker ────────────────────────────────
  const onCarouselScroll = (event: any) => {
    const idx = Math.round(
      event.nativeEvent.contentOffset.x / SNAP_W
    );
    if (idx >= 0 && idx < filteredStores.length && idx !== activeIndex) {
      setActiveIndex(idx);
    }
  };
  // ── Marker tap → scroll carousel ─────────────────────────────────────────
  const onMarkerPress = (index: number) => {
    setActiveIndex(index);
    listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
  };
  // ── Re-centre on user ──────────────────────────────────────────────────────
  const reCentre = () => {
    if (!userCoords) return;
    mapRef.current?.animateToRegion(
      {
        latitude:      userCoords.latitude,
        longitude:     userCoords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      },
      500
    );
  };
  // ── Loading screen ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={S.loadingWrap}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color={C.navy} />
        <Text style={S.loadingTxt}>Finding stores near you…</Text>
      </View>
    );
  }
  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={S.root}>
      <StatusBar style="dark" />
      {/* ── Full-screen map ──────────────────────────────────────────────── */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={S.map}
        initialRegion={{
          latitude:      userCoords?.latitude  ?? 6.6745,
          longitude:     userCoords?.longitude ?? -1.5716,
          latitudeDelta: 0.03,
          longitudeDelta: 0.03,
        }}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
      >
        {/* ── Radius circle — visual "coverage zone" like Snapchat ─────── */}
        {userCoords && (
          <Circle
            center={userCoords}
            radius={radiusKm * 1000}  // metres
            strokeColor="rgba(12,21,89,0.2)"
            strokeWidth={1.5}
            fillColor="rgba(12,21,89,0.04)"
            lineDashPattern={[6, 4]}
          />
        )}
        {/* ── Store markers ─────────────────────────────────────────────── */}
        {filteredStores.map((store, index) => {
          const isActive = index === activeIndex;
          const [c1, ]  = FALLBACK_COLORS[store.colorIdx];
          return (
            <Marker
              key={store.id}
              coordinate={{ latitude: store.latitude, longitude: store.longitude }}
              onPress={() => onMarkerPress(index)}
              anchor={{ x: 0.5, y: 1 }}
              tracksViewChanges={false}
            >
              <View style={S.markerWrap}>
                {/* Pulse halo — only on active marker */}
                {isActive && (
                  <Animated.View
                    style={[
                      S.markerPulse,
                      {
                        opacity: pulseAnim.interpolate({
                          inputRange: [0, 1], outputRange: [0.6, 0],
                        }),
                        transform: [{
                          scale: pulseAnim.interpolate({
                            inputRange: [0, 1], outputRange: [1, 1.6],
                          }),
                        }],
                      },
                    ]}
                  />
                )}
                {/* Marker ring */}
                <View style={[S.markerRing, isActive && S.markerRingActive]}>
                  {store.logo ? (
                    <Image
                      source={{ uri: store.logo }}
                      style={S.markerImg}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[S.markerFallback, { backgroundColor: c1 }]}>
                      <Text style={S.markerInitials}>{initials(store.name)}</Text>
                    </View>
                  )}
                  {/* Verified checkmark on marker */}
                  {store.verified && (
                    <View style={S.markerVerified}>
                      <Ionicons name="checkmark" size={7} color={C.limeAlt} />
                    </View>
                  )}
                </View>
                {/* Tail */}
                <View style={[S.markerTail, isActive && S.markerTailActive]} />
              </View>
            </Marker>
          );
        })}
      </MapView>
      {/* ── Top overlay: back + search + category chips ───────────────── */}
      <View style={[S.topOverlay, { paddingTop: insets.top + 10 }]}>
        {/* Row 1: back + search */}
        <View style={S.topRow}>
          <TouchableOpacity style={S.iconPill} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color={C.navy} />
          </TouchableOpacity>
          <View style={S.searchPill}>
            <Feather name="search" size={14} color={C.subtle} />
            <TextInput
              style={S.searchInput}
              placeholder="Search stores nearby…"
              placeholderTextColor={C.subtle}
              value={searchQuery}
              onChangeText={setSearch}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={15} color={C.subtle} />
              </TouchableOpacity>
            )}
          </View>
        </View>
        {/* Row 2: category chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={S.chipStrip}
        >
          {CATEGORIES.map((cat) => {
            const on = activeCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[S.chip, on && S.chipOn]}
                onPress={() => setCategory(cat)}
              >
                <Text style={[S.chipTxt, on && S.chipTxtOn]}>{cat}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
      {/* ── FAB group: re-centre + radius ─────────────────────────────── */}
      <View style={[S.fabGroup, { bottom: 240 + insets.bottom }]}>
        {/* Re-centre on user */}
        <TouchableOpacity style={S.fab} onPress={reCentre}>
          <MaterialCommunityIcons name="crosshairs-gps" size={20} color={C.navy} />
        </TouchableOpacity>
        {/* Radius picker toggle */}
        <TouchableOpacity
          style={[S.fab, showRadiusPicker && S.fabActive]}
          onPress={() => setShowRadius((v) => !v)}
        >
          <MaterialCommunityIcons
            name="radar"
            size={20}
            color={showRadiusPicker ? C.lime : C.navy}
          />
        </TouchableOpacity>
        {/* Radius options — slide out when open */}
        {showRadiusPicker && (
          <View style={S.radiusPicker}>
            {RADIUS_OPTIONS.map((r) => (
              <TouchableOpacity
                key={r}
                style={[S.radiusOption, radiusKm === r && S.radiusOptionOn]}
                onPress={() => { setRadiusKm(r); setShowRadius(false); }}
              >
                <Text style={[S.radiusOptionTxt, radiusKm === r && S.radiusOptionTxtOn]}>
                  {r} km
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
      {/* ── Bottom sheet ──────────────────────────────────────────────── */}
      <View style={[S.bottomSheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        {/* Handle */}
        <View style={S.handleWrap}><View style={S.handle} /></View>
        {/* Count row */}
        <View style={S.countRow}>
          <Text style={S.nearbyCount}>
            {filteredStores.length} store{filteredStores.length !== 1 ? 's' : ''} nearby
          </Text>
          <TouchableOpacity
            style={S.radiusBadge}
            onPress={() => setShowRadius((v) => !v)}
          >
            <MaterialCommunityIcons name="radar" size={12} color={C.navy} />
            <Text style={S.radiusBadgeTxt}>Within {radiusKm} km</Text>
            <Ionicons name="chevron-down" size={11} color={C.navy} />
          </TouchableOpacity>
        </View>
        {/* Empty state */}
        {filteredStores.length === 0 ? (
          <View style={S.emptyCarousel}>
            <MaterialCommunityIcons name="storefront-outline" size={28} color={C.subtle} />
            <Text style={S.emptyCarouselTxt}>No stores found in this area</Text>
            <TouchableOpacity
              onPress={() => { setRadiusKm(10); setCategory('All'); setSearch(''); }}
            >
              <Text style={S.emptyCarouselLink}>Expand search to 10 km</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Store carousel */
          <FlatList
            ref={listRef}
            data={filteredStores}
            horizontal
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            snapToInterval={SNAP_W}
            decelerationRate="fast"
            contentContainerStyle={S.carouselContent}
            onMomentumScrollEnd={onCarouselScroll}
            getItemLayout={(_, index) => ({
              length: SNAP_W, offset: SNAP_W * index, index,
            })}
            renderItem={({ item, index }) => {
              const isActive = index === activeIndex;
              const [c1]     = FALLBACK_COLORS[item.colorIdx];
              return (
                <TouchableOpacity
                  style={[S.storeCard, isActive && S.storeCardActive]}
                  activeOpacity={0.88}
                  onPress={() =>
                    router.push({
                      pathname: '/stores/details',
                      params: { id: item.id, name: item.name, logo: item.logo },
                    })
                  }
                >
                  {/* Logo */}
                  {item.logo ? (
                    <Image source={{ uri: item.logo }} style={S.cardLogo} resizeMode="cover" />
                  ) : (
                    <View style={[S.cardLogo, S.cardLogoFallback, { backgroundColor: c1 }]}>
                      <Text style={S.cardLogoInitials}>{initials(item.name)}</Text>
                    </View>
                  )}
                  {/* Info */}
                  <View style={S.cardInfo}>
                    <View style={S.cardNameRow}>
                      <Text style={S.cardName} numberOfLines={1}>{item.name}</Text>
                      {item.verified && (
                        <View style={S.cardVerified}>
                          <Ionicons name="checkmark" size={8} color={C.limeAlt} />
                        </View>
                      )}
                    </View>
                    <Text style={S.cardCat} numberOfLines={1}>{item.category}</Text>
                    <View style={S.cardMeta}>
                      {/* Distance badge — core "near me" feature */}
                      <View style={S.distBadge}>
                        <MaterialCommunityIcons name="map-marker" size={10} color={C.navy} />
                        <Text style={S.distBadgeTxt}>{fmtDist(item.distanceKm)}</Text>
                      </View>
                      <View style={S.ratingPill}>
                        <Ionicons name="star" size={9} color="#F59E0B" />
                        <Text style={S.ratingPillTxt}>{item.rating.toFixed(1)}</Text>
                      </View>
                      <Text style={S.cataloguesTxt}>{item.catalogues} items</Text>
                    </View>
                  </View>
                  {/* Visit arrow */}
                  <View style={[S.visitArrow, isActive && S.visitArrowActive]}>
                    <Ionicons name="chevron-forward" size={14} color={isActive ? C.limeAlt : C.navy} />
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
    </View>
  );
}
// ─── Styles ────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  root:       { flex: 1 },
  map:        { width, height },
  loadingWrap:{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  loadingTxt: { marginTop: 12, fontSize: 14, fontFamily: 'Montserrat-Medium', color: C.muted },
  // ── Top overlay ─────────────────────────────────────────────────────────────
  topOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
    paddingHorizontal: 14, paddingBottom: 10,
  },
  topRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 10 },
  iconPill: {
    width: 40, height: 40, borderRadius: 13,
    backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
    elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 8,
  },
  searchPill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 13, paddingHorizontal: 12,
    height: 40,
    elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 8,
  },
  searchInput: {
    flex: 1, fontSize: 13, fontFamily: 'Montserrat-Medium', color: C.body, height: '100%',
  },
  // Chips
  chipStrip: { gap: 7, flexDirection: 'row', paddingVertical: 2 },
  chip: {
    height: 32, paddingHorizontal: 14, borderRadius: 16,
    backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center',
    elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 4,
  },
  chipOn:    { backgroundColor: C.navy },
  chipTxt:   { fontSize: 11, fontFamily: 'Montserrat-Bold', color: C.muted },
  chipTxtOn: { color: '#fff' },
  // ── FABs ────────────────────────────────────────────────────────────────────
  fabGroup: {
    position: 'absolute', right: 14, zIndex: 20,
    alignItems: 'flex-end', gap: 8,
  },
  fab: {
    width: 42, height: 42, borderRadius: 13,
    backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
    elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 8,
  },
  fabActive: { backgroundColor: C.navy },
  // Radius picker
  radiusPicker: {
    backgroundColor: '#fff', borderRadius: 14, padding: 6,
    elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 12,
    gap: 2,
  },
  radiusOption: {
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10,
  },
  radiusOptionOn:    { backgroundColor: '#EEF2FF' },
  radiusOptionTxt:   { fontSize: 13, fontFamily: 'Montserrat-SemiBold', color: C.muted },
  radiusOptionTxtOn: { color: C.navy, fontFamily: 'Montserrat-Bold' },
  // ── Markers ─────────────────────────────────────────────────────────────────
  markerWrap: { alignItems: 'center', position: 'relative' },
  markerPulse: {
    position: 'absolute',
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: 'rgba(132,204,22,0.3)',
    top: -5,
  },
  markerRing: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#fff', borderWidth: 2.5, borderColor: C.navy,
    overflow: 'hidden',
    elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2, shadowRadius: 6,
    position: 'relative',
  },
  markerRingActive: {
    borderColor: '#84cc16',
    transform: [{ scale: 1.15 }],
    elevation: 10,
  },
  markerImg:      { width: '100%', height: '100%' },
  markerFallback: {
    width: '100%', height: '100%',
    justifyContent: 'center', alignItems: 'center',
  },
  markerInitials: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#84cc16' },
  markerVerified: {
    position: 'absolute', bottom: 1, right: 1,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#84cc16', borderWidth: 1.5, borderColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
  },
  markerTail: {
    width: 0, height: 0,
    borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 8,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderTopColor: C.navy,
    marginTop: -1,
  },
  markerTailActive: { borderTopColor: '#84cc16' },
  // ── Bottom sheet ─────────────────────────────────────────────────────────────
  bottomSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    elevation: 16, shadowColor: C.navy,
    shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.1, shadowRadius: 16,
    zIndex: 20,
  },
  handleWrap: { alignItems: 'center', paddingTop: 10, paddingBottom: 6 },
  handle:     { width: 36, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0' },
  countRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, marginBottom: 12,
  },
  nearbyCount: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: C.body },
  radiusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#EEF2FF', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  radiusBadgeTxt: { fontSize: 11, fontFamily: 'Montserrat-Bold', color: C.navy },
  // Empty carousel
  emptyCarousel: {
    alignItems: 'center', paddingVertical: 24, paddingHorizontal: 30, gap: 6,
  },
  emptyCarouselTxt:  { fontSize: 13, fontFamily: 'Montserrat-Medium', color: C.muted },
  emptyCarouselLink: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: C.navyMid },
  // Store cards
  carouselContent: { paddingHorizontal: 14, paddingBottom: 8 },
  storeCard: {
    width: CARD_W,
    backgroundColor: '#fff', borderRadius: 18,
    flexDirection: 'row', alignItems: 'center',
    padding: 12, marginRight: CARD_GAP,
    borderWidth: 1.5, borderColor: 'transparent',
    elevation: 4, shadowColor: C.navy,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 10,
  },
  storeCardActive: {
    borderColor: '#84cc16',
    elevation: 8, shadowOpacity: 0.14,
  },
  cardLogo: { width: 54, height: 54, borderRadius: 14, backgroundColor: '#dbeafe' },
  cardLogoFallback: { justifyContent: 'center', alignItems: 'center' },
  cardLogoInitials: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#84cc16' },
  cardInfo: { flex: 1, marginLeft: 12 },
  cardNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 },
  cardName: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: C.body, flex: 1 },
  cardVerified: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#84cc16', justifyContent: 'center', alignItems: 'center',
  },
  cardCat: { fontSize: 11, fontFamily: 'Montserrat-SemiBold', color: C.subtle, marginBottom: 7 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  distBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#EEF2FF', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8,
  },
  distBadgeTxt: { fontSize: 10, fontFamily: 'Montserrat-Bold', color: C.navy },
  ratingPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8,
  },
  ratingPillTxt:  { fontSize: 10, fontFamily: 'Montserrat-Bold', color: '#92400E' },
  cataloguesTxt:  { fontSize: 10, fontFamily: 'Montserrat-SemiBold', color: C.subtle },
  visitArrow: {
    width: 30, height: 30, borderRadius: 10, backgroundColor: '#EEF2FF',
    justifyContent: 'center', alignItems: 'center',
  },
  visitArrowActive: { backgroundColor: '#84cc16' },
});
