import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, StyleSheet, Text, TouchableOpacity,
  Dimensions, ActivityIndicator, FlatList, TextInput,
  ScrollView, Animated,
} from 'react-native';
import AppImage from '@/components/AppImage';
import MapView, { Marker, UrlTile } from '@/components/MapView';
import Circle from '@/components/MapCircle';
import * as Location from 'expo-location';
import { requestForegroundLocationWithDisclosure } from '@/src/utils/location';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { getAllStores } from '@/services/api';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';
import { OSM_TILE_URL_TEMPLATE } from '@/constants/mapTiles';
const { width, height } = Dimensions.get('window');
const CARD_W   = width * 0.72;
const CARD_GAP = 12;
const SNAP_W   = CARD_W + CARD_GAP;
// ─── Tokens ───────────────────────────────────────────────────────────────────
type LegacyPalette = {
  bg: string;
  navy: string;
  navyMid: string;
  lime: string;
  limeAlt: string;
  card: string;
  body: string;
  muted: string;
  subtle: string;
  border: string;
  badgeBg: string;
};

function buildC(colors: ThemeColors): LegacyPalette {
  return {
    bg: colors.backgroundAlt,
    navy: colors.primary,
    navyMid: colors.primaryMid,
    lime: colors.accent,
    limeAlt: '#1a2e00',
    card: colors.surface,
    body: colors.text,
    muted: colors.textSecondary,
    subtle: colors.textMuted,
    border: colors.border,
    badgeBg: colors.backgroundAlt,
  };
}
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

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export default function StoresMap() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const themeColors = useThemeColors();
  const C = useMemo(() => buildC(themeColors), [themeColors]);
  const S = useMemo(() => getStyles(C), [C]);
  const mapRef  = useRef<MapView>(null);
  const listRef = useRef<FlatList>(null);
  const [userCoords,    setUserCoords]    = useState<{ latitude: number; longitude: number } | null>(null);
  const [allStores,     setAllStores]     = useState<StoreItem[]>([]);
  const [filteredStores, setFilteredStores] = useState<StoreItem[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [activeIndex,    setActiveIndex]    = useState(0);
  const [radiusKm,       setRadiusKm]       = useState(2);
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery,    setSearchQuery]    = useState('');
  const [showRadiusPicker, setShowRadiusPicker] = useState(false);
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
  // ── Load stores near a given point (server-side radius filter — the app no
  // longer downloads every store and filters in JS) ──────────────────────────
  const FETCH_RADIUS_KM = 15; // wide enough to cover every RADIUS_OPTIONS value client-side
  const fetchStoresNear = useCallback(async (coords: { latitude: number; longitude: number }) => {
    const res = await getAllStores({ lat: coords.latitude, lng: coords.longitude, radiusKm: FETCH_RADIUS_KM, limit: 100 });
    if (!res.success) return;
    const mapped: StoreItem[] = (res.businesses || [])
      // Stores without real coordinates can't be placed on the map or given a
      // real distance — skip them instead of scattering them at fake positions.
      .filter((b: any) => b.latitude != null && b.longitude != null)
      .map((b: any, i: number) => {
        const lat = Number.parseFloat(b.latitude);
        const lng = Number.parseFloat(b.longitude);
        return {
          id:          b.id,
          name:        b.name        || 'Unknown Store',
          category:    b.category    || 'General',
          rating:      toNumber(b.rating, 0),
          reviewCount: toNumber(b.reviewCount, 0),
          logo:        b.logo        || null,
          catalogues:  toNumber(b.catalogues, 0),
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
  }, []);

  // ── Load location + stores ──────────────────────────────────────────────────
  // Don't block the first render on a precise GPS fix (that's the slow part —
  // often a few seconds). Show something immediately using the last-known
  // position (usually instant) or the city fallback, then refine quietly once
  // the accurate position resolves, only refetching if it actually moved far
  // enough to change which stores are nearby.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const fallback = { latitude: 6.6745, longitude: -1.5716 }; // Kumasi fallback
      try {
        const { status } = await requestForegroundLocationWithDisclosure();

        let quickCoords = fallback;
        if (status === 'granted') {
          try {
            const lastKnown = await Location.getLastKnownPositionAsync();
            if (lastKnown) {
              quickCoords = { latitude: lastKnown.coords.latitude, longitude: lastKnown.coords.longitude };
            }
          } catch {
            // fall through to fallback coords
          }
        }
        if (cancelled) return;
        setUserCoords(quickCoords);
        await fetchStoresNear(quickCoords);
        if (cancelled) return;
        setLoading(false);

        if (status === 'granted') {
          // Refine in the background — no loading spinner, no blocking the UI.
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          if (cancelled) return;
          const preciseCoords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          setUserCoords(preciseCoords);
          if (haversineKm(quickCoords.latitude, quickCoords.longitude, preciseCoords.latitude, preciseCoords.longitude) > 0.5) {
            await fetchStoresNear(preciseCoords);
          }
        }
      } catch (err) {
        console.error('StoresMap init error:', err);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fetchStoresNear]);
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
    setFilteredStores(result);
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
        <UrlTile
          urlTemplate={OSM_TILE_URL_TEMPLATE}
          maximumZ={19}
          flipY={false}
          zIndex={-1}
        />
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
                    <AppImage
                      uri={store.logo}
                      style={S.markerImg}
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
              onChangeText={setSearchQuery}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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
                onPress={() => setActiveCategory(cat)}
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
          onPress={() => setShowRadiusPicker((v) => !v)}
        >
          <MaterialCommunityIcons
            name="radar"
            size={20}
            color={showRadiusPicker ? C.limeAlt : C.navy}
          />
        </TouchableOpacity>
        {/* Radius options — slide out when open */}
        {showRadiusPicker && (
          <View style={S.radiusPicker}>
            {RADIUS_OPTIONS.map((r) => (
              <TouchableOpacity
                key={r}
                style={[S.radiusOption, radiusKm === r && S.radiusOptionOn]}
                onPress={() => { setRadiusKm(r); setShowRadiusPicker(false); }}
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
            {filteredStores.length} store{filteredStores.length === 1 ? '' : 's'} nearby
          </Text>
          <TouchableOpacity
            style={S.radiusBadge}
            onPress={() => setShowRadiusPicker((v) => !v)}
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
              onPress={() => { setRadiusKm(10); setActiveCategory('All'); setSearchQuery(''); }}
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
                    <AppImage uri={item.logo} style={S.cardLogo} />
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
                        <Text style={S.ratingPillTxt}>{toNumber(item.rating, 0).toFixed(1)}</Text>
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
const getStyles = (C: LegacyPalette) => StyleSheet.create({
  root:       { flex: 1 },
  map:        { width, height },
  loadingWrap:{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },
  loadingTxt: { marginTop: 12, fontSize: 14, fontFamily: 'Montserrat-Medium', color: C.muted },
  // ── Top overlay ─────────────────────────────────────────────────────────────
  topOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
    paddingHorizontal: 14, paddingBottom: 10,
  },
  topRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 10 },
  iconPill: {
    width: 40, height: 40, borderRadius: 13,
    backgroundColor: C.card,
    justifyContent: 'center', alignItems: 'center',
    elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 8,
  },
  searchPill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.card, borderRadius: 13, paddingHorizontal: 12,
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
    backgroundColor: C.card, justifyContent: 'center', alignItems: 'center',
    elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 4,
  },
  chipOn:    { backgroundColor: C.lime },
  chipTxt:   { fontSize: 11, fontFamily: 'Montserrat-Bold', color: C.muted },
  chipTxtOn: { color: C.limeAlt },
  // ── FABs ────────────────────────────────────────────────────────────────────
  fabGroup: {
    position: 'absolute', right: 14, zIndex: 20,
    alignItems: 'flex-end', gap: 8,
  },
  fab: {
    width: 42, height: 42, borderRadius: 13,
    backgroundColor: C.card,
    justifyContent: 'center', alignItems: 'center',
    elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 8,
  },
  fabActive: { backgroundColor: C.lime },
  // Radius picker
  radiusPicker: {
    backgroundColor: C.card, borderRadius: 14, padding: 6,
    elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 12,
    gap: 2,
  },
  radiusOption: {
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10,
  },
  radiusOptionOn:    { backgroundColor: C.badgeBg },
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
    backgroundColor: C.card,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    elevation: 16, shadowColor: C.navy,
    shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.1, shadowRadius: 16,
    zIndex: 20,
  },
  handleWrap: { alignItems: 'center', paddingTop: 10, paddingBottom: 6 },
  handle:     { width: 36, height: 4, borderRadius: 2, backgroundColor: C.border },
  countRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, marginBottom: 12,
  },
  nearbyCount: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: C.body },
  radiusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.badgeBg, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
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
    backgroundColor: C.card, borderRadius: 18,
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
  cardLogo: { width: 54, height: 54, borderRadius: 14, backgroundColor: C.badgeBg },
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
    backgroundColor: C.badgeBg, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8,
  },
  distBadgeTxt: { fontSize: 10, fontFamily: 'Montserrat-Bold', color: C.navy },
  ratingPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8,
  },
  ratingPillTxt:  { fontSize: 10, fontFamily: 'Montserrat-Bold', color: '#92400E' },
  cataloguesTxt:  { fontSize: 10, fontFamily: 'Montserrat-SemiBold', color: C.subtle },
  visitArrow: {
    width: 30, height: 30, borderRadius: 10, backgroundColor: C.badgeBg,
    justifyContent: 'center', alignItems: 'center',
  },
  visitArrowActive: { backgroundColor: '#84cc16' },
});
