import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  Image, StyleSheet, Dimensions, Keyboard, Pressable,
  Modal, Switch, Animated, ActivityIndicator,
} from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { safePush } from '@/lib/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import BottomNav from '@/components/BottomNav';
import { getAllStores } from '@/services/api';
import { StoresSkeleton } from '@/components/skeletons/StoresSkeleton';
import { useOnboarding } from '@/context/OnboardingContext';
import { SpotlightTour } from '@/components/ui/SpotlightTour';
const { width } = Dimensions.get('window');
const C = {
  pageBg:   '#E9F0FF',
  navy:     '#0C1559',
  navyMid:  '#1e3a8a',
  lime:     '#84cc16',
  limeText: '#1a2e00',
  card:     '#FFFFFF',
  body:     '#0F172A',
  muted:    '#64748B',
  subtle:   '#94A3B8',
  border:   'rgba(12,21,89,0.07)',
  borderMd: 'rgba(12,21,89,0.14)',
};
const CATEGORIES = ['All', 'Grocery', 'Electronics', 'Fashion', 'Home', 'Footwear', 'Art'];
const SORT_OPTIONS: { label: string; value: 'rating' | 'newest' | 'name' }[] = [
  { label: 'Top rated', value: 'rating' },
  { label: 'Newest',    value: 'newest' },
  { label: 'A → Z',     value: 'name'   },
];
const initials = (name: string) =>
  (name || 'S').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
export default function StoresScreen() {
  const [searchQuery,    setSearchQuery]    = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [stores,         setStores]         = useState<any[]>([]);
  const [popularStores,  setPopularStores]  = useState<any[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [isRefreshing,   setIsRefreshing]   = useState(false);
  const [showFilter,     setShowFilter]     = useState(false);
  const [filterSort,     setFilterSort]     = useState<'rating' | 'newest' | 'name'>('rating');
  const [filterVerified, setFilterVerified] = useState(false);
  const fadeAnim   = useRef(new Animated.Value(1)).current;
  const isSearching = searchQuery.length > 0;
  // --- Onboarding ---
  const { startTour, markCompleted, isTourActive, activeScreen } = useOnboarding();
  const [layouts, setLayouts] = useState<any>({});
  const refSearch = useRef<View>(null);
  const refFilter = useRef<View>(null);
  const refPopular = useRef<View>(null);
  const refMap = useRef<View>(null);
  const measureElement = (ref: any, key: string) => {
    if (ref.current) {
      ref.current.measureInWindow((x: number, y: number, width: number, height: number) => {
        setLayouts((prev: any) => ({ ...prev, [key]: { x, y, width, height } }));
      });
    }
  };
  useEffect(() => {
    const timer = setTimeout(() => {
      // Only start tour if user isn't actively searching
      if (searchQuery.length === 0) {
        measureElement(refSearch, 'search');
        measureElement(refFilter, 'filter');
        measureElement(refPopular, 'popular');
        measureElement(refMap, 'map');
        startTour('stores');
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [searchQuery.length, startTour]);
  const onboardingSteps = [
    {
      targetLayout: layouts.search,
      title: 'Store Finder',
      description: 'Looking for a specific vendor? Find them quickly here.',
    },
    {
      targetLayout: layouts.filter,
      title: 'Verified Only',
      description: 'Use filters to see only verified and top-rated merchants.',
    },
    {
      targetLayout: layouts.popular,
      title: 'Top Picks',
      description: 'Explore our community’s most trusted and popular stores.',
    },
    {
      targetLayout: layouts.map,
      title: 'Map View',
      description: 'Prefer to shop locally? See exactly where stores are located around you.',
    },
  ].filter(s => !!s.targetLayout);
  const handleOnboardingComplete = () => {
    markCompleted('stores');
  };
  const fetchStores = useCallback(async () => {
    try {
      // Only show full skeleton if we have no data yet
      const isInitial = stores.length === 0;
      if (isInitial) setLoading(true);
      else setIsRefreshing(true);
      const res = await getAllStores({
        search:   searchQuery || undefined,
        category: activeCategory !== 'All' ? activeCategory : undefined,
        sortBy:   filterSort,
        verified: filterVerified ? 'true' : undefined,
      });
      if (res.success) {
        const mapped = (res.businesses || []).map((b: any) => ({
          id:          b.id,
          name:        b.name        || 'Unknown Store',
          category:    b.category    || 'General',
          rating:      b.rating      || 0,
          reviewCount: b.reviewCount || 0,
          logo:        b.logo        || null,
          catalogues:  b.catalogues  || 0,
          verified:    b.verified    || false,
          isTrusted:   b.isTrusted   || false,
        }));
        Animated.sequence([
          Animated.timing(fadeAnim, { toValue: 0.5, duration: 120, useNativeDriver: true }),
          Animated.timing(fadeAnim, { toValue: 1,   duration: 300, useNativeDriver: true }),
        ]).start();
        setStores(mapped);
        if (searchQuery === '' && activeCategory === 'All') {
          setPopularStores(mapped.slice(0, 6));
        }
      }
    } catch (e) {
      console.error('Error fetching stores', e);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [stores.length, searchQuery, activeCategory, filterSort, filterVerified, fadeAnim]);
  useEffect(() => { fetchStores(); }, [fetchStores]);
  const handleVisitStore = (item: any) => {
    safePush('/stores/details', { id: item.id, name: item.name, category: item.category, logo: item.logo });
  };
  // ── Popular card — single logo image, verified badge overlaid on it ────────
  const renderPopularCard = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.popularCard}
      activeOpacity={0.85}
      onPress={() => handleVisitStore(item)}
    >
      {/* Single image block — logo fills the top, gradient fades it into the card */}
      <View style={styles.popularImgWrap}>
        {item.logo ? (
          <Image
            source={{ uri: item.logo }}
            style={styles.popularLogo}
            resizeMode="cover"
          />
        ) : (
          // Fallback: coloured block with initials
          <View style={styles.popularLogoFallback}>
            <Text style={styles.popularLogoInitials}>{initials(item.name)}</Text>
          </View>
        )}
        {/* Bottom gradient so name text below never fights the image */}
        <LinearGradient
          colors={['transparent', 'rgba(12,21,89,0.45)']}
          style={styles.popularImgGradient}
        />
        {/* Trusted badge — top right, on top of the image */}
        {item.isTrusted && (
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark" size={9} color={C.limeText} />
            <Text style={styles.verifiedBadgeTxt}>Trusted</Text>
          </View>
        )}
      </View>
      {/* Info below the image */}
      <View style={styles.popularInfo}>
        <Text style={styles.popularName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.popularCat}  numberOfLines={1}>{item.category}</Text>
        <View style={styles.popularFooter}>
          <View style={styles.ratingPill}>
            <Ionicons name="star" size={9} color="#F59E0B" />
            <Text style={styles.ratingPillTxt}>{item.rating.toFixed(1)}</Text>
          </View>
          <Text style={styles.popularItems}>{item.catalogues} items</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
  // ── Store row ──────────────────────────────────────────────────────────────
  const renderStoreRow = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.storeRow}
      activeOpacity={0.82}
      onPress={() => handleVisitStore(item)}
    >
      {item.logo
        ? <Image source={{ uri: item.logo }} style={styles.storeRowLogo} />
        : <View style={[styles.storeRowLogo, styles.storeRowLogoFallback]}>
            <Text style={styles.storeRowLogoTxt}>{initials(item.name)}</Text>
          </View>
      }
      <View style={styles.storeRowInfo}>
        <View style={styles.storeNameRow}>
          <Text style={styles.storeRowName} numberOfLines={1}>{item.name}</Text>
          {item.isTrusted && (
            <View style={styles.inlineVerified}>
              <Ionicons name="checkmark" size={8} color={C.limeText} />
            </View>
          )}
        </View>
        <View style={styles.storeRowMeta}>
          <Text style={styles.storeRowCat}>{item.category}</Text>
          <View style={styles.dot} />
          <Text style={styles.storeRowItems}>{item.catalogues} items</Text>
        </View>
        <View style={styles.storeRatingRow}>
          <Ionicons name="star" size={10} color="#F59E0B" />
          <Text style={styles.storeRatingTxt}>
            {item.rating.toFixed(1)} · {item.reviewCount} reviews
          </Text>
        </View>
      </View>
      <TouchableOpacity style={styles.visitBtn} onPress={() => handleVisitStore(item)}>
        <Text style={styles.visitTxt}>Visit</Text>
        <Ionicons name="chevron-forward" size={12} color={C.navy} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
  const renderEmpty = () => (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyCircle}>
        <MaterialCommunityIcons name="storefront-outline" size={40} color={C.navy} />
      </View>
      <Text style={styles.emptyTitle}>No stores found</Text>
      <Text style={styles.emptyBody}>
        {searchQuery
          ? `No results for "${searchQuery}". Try a different search.`
          : 'No stores in this category yet.'}
      </Text>
    </View>
  );
  // Only show the full skeleton loader during initial boot with NO data
  if (loading && stores.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: C.pageBg }}>
        <StatusBar style="light" />
        <StoresSkeleton />
        <BottomNav />
      </View>
    );
  }
  const headingEye = searchQuery.length > 0 ? 'Results for' : 'Explore';
  return (
    <Pressable onPress={Keyboard.dismiss} style={{ flex: 1 }}>
      <View style={styles.root}>
        <StatusBar style="light" />
        <LinearGradient colors={[C.navy, C.navyMid]} style={styles.hdrGradient}>
          <View style={styles.hdrGlow} pointerEvents="none" />
          <SafeAreaView edges={['top', 'left', 'right']}>
            <View style={styles.hdrInner}>
              <View style={styles.hdrTop}>
                <View>
                  <Text style={styles.hdrEye}>{headingEye}</Text>
                  <Text style={styles.hdrTitle} numberOfLines={1}>
                    {searchQuery.length > 0
                      ? <>{'"'}<Text style={{ color: C.lime }}>{searchQuery}</Text>{'"'}</>
                      : <>{'Discover '}<Text style={{ color: C.lime }}>{'Stores'}</Text></>
                    }
                  </Text>
                </View>
                <TouchableOpacity style={styles.hdrBtn} onPress={() => safePush('/notification')}>
                  <Ionicons name="notifications-outline" size={17} color="rgba(255,255,255,0.8)" />
                </TouchableOpacity>
              </View>
              <View style={styles.searchRow}>
                <View style={[styles.searchPill, searchQuery.length > 0 && styles.searchPillActive]} ref={refSearch} onLayout={() => measureElement(refSearch, 'search')}>
                  <Feather name="search" size={14} color="rgba(255,255,255,0.5)" />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search stores..."
                    placeholderTextColor="rgba(255,255,255,0.32)"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    returnKeyType="search"
                    autoCorrect={false}
                    autoCapitalize="none"
                  />
                  {isRefreshing ? (
                    <ActivityIndicator size="small" color={C.lime} style={{ marginRight: 4 }} />
                  ) : searchQuery.length > 0 && (
                    <TouchableOpacity
                      style={styles.clearBtn}
                      onPress={() => setSearchQuery('')}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close" size={10} color="#fff" />
                    </TouchableOpacity>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.filterFab}
                  onPress={() => setShowFilter(true)}
                  activeOpacity={0.85}
                  ref={refFilter}
                  onLayout={() => measureElement(refFilter, 'filter')}
                >
                  <Feather name="sliders" size={16} color={C.limeText} />
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
          <View style={styles.hdrArc} />
        </LinearGradient>
        <Animated.View style={{ 
          flex: 1, 
          opacity: (loading || isRefreshing) ? 0.6 : fadeAnim 
        }}>
          <FlatList
            data={stores}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            renderItem={renderStoreRow}
            ListEmptyComponent={renderEmpty}
            ListHeaderComponent={
              <>
                <FlatList
                  horizontal
                  data={CATEGORIES}
                  keyExtractor={(item) => item}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipStrip}
                  renderItem={({ item }) => {
                    const on = activeCategory === item;
                    return (
                      <TouchableOpacity
                        style={[styles.chip, on && styles.chipOn]}
                        onPress={() => setActiveCategory(item)}
                      >
                        <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{item}</Text>
                      </TouchableOpacity>
                    );
                  }}
                />
                {!isSearching && popularStores.length > 0 && (
                  <>
                    <View style={styles.secHeader} ref={refPopular} onLayout={() => measureElement(refPopular, 'popular')}>
                      <Text style={styles.secTitle}>Popular Stores</Text>
                      <Text style={styles.secMeta}>{popularStores.length} stores</Text>
                    </View>
                    <FlatList
                      horizontal
                      data={popularStores}
                      keyExtractor={(item) => item.id}
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.popularStrip}
                      renderItem={renderPopularCard}
                    />
                  </>
                )}
                <View style={styles.secHeader}>
                  <Text style={styles.secTitle}>
                    {isSearching
                      ? `${stores.length} result${stores.length !== 1 ? 's' : ''}`
                      : 'All Stores'}
                  </Text>
                  {!isSearching && (
                    <Text style={styles.secMeta}>{stores.length} stores</Text>
                  )}
                </View>
              </>
            }
          />
        </Animated.View>
        <TouchableOpacity
          style={styles.mapFab}
          activeOpacity={0.88}
          onPress={() => safePush('/stores/storesMap')}
          ref={refMap}
          onLayout={() => measureElement(refMap, 'map')}
        >
          <LinearGradient colors={[C.navy, C.navyMid]} style={styles.mapFabInner}>
            <MaterialCommunityIcons name="map-marker-radius" size={18} color="#fff" />
            <Text style={styles.mapFabTxt}>Find Stores</Text>
          </LinearGradient>
        </TouchableOpacity>
        <BottomNav />
        <Modal
          visible={showFilter}
          transparent
          animationType="slide"
          onRequestClose={() => setShowFilter(false)}
        >
          <View style={styles.modalOverlay}>
            <Pressable style={styles.modalBackdrop} onPress={() => setShowFilter(false)} />
            <View style={styles.modalSheet}>
              <View style={styles.sheetHandle} />
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Filter Stores</Text>
                <TouchableOpacity style={styles.modalClose} onPress={() => setShowFilter(false)}>
                  <Ionicons name="close" size={16} color={C.navy} />
                </TouchableOpacity>
              </View>
              <Text style={styles.modalSectionLbl}>Sort by</Text>
              <View style={styles.sortRow}>
                {SORT_OPTIONS.map((opt) => {
                  const on = filterSort === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.sortChip, on && styles.sortChipOn]}
                      onPress={() => setFilterSort(opt.value)}
                    >
                      <Text style={[styles.sortChipTxt, on && styles.sortChipTxtOn]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={styles.switchRow}>
                <View>
                  <Text style={styles.switchLbl}>Verified stores only</Text>
                  <Text style={styles.switchSub}>Show only PRO-verified sellers</Text>
                </View>
                <Switch
                  value={filterVerified}
                  onValueChange={setFilterVerified}
                  trackColor={{ false: '#E2E8F0', true: C.lime }}
                  thumbColor="#FFF"
                  ios_backgroundColor="#E2E8F0"
                />
              </View>
              <TouchableOpacity
                style={styles.applyBtn}
                activeOpacity={0.88}
                onPress={() => { setShowFilter(false); fetchStores(); }}
              >
                <Text style={styles.applyTxt}>Apply filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
      <SpotlightTour 
        visible={isTourActive && activeScreen === 'stores'} 
        steps={onboardingSteps}
        onComplete={handleOnboardingComplete}
      />
    </Pressable>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.pageBg },
  hdrGradient: {
    position: 'relative', paddingBottom: 28, zIndex: 20,
    elevation: 12, shadowColor: C.navy,
    shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.22, shadowRadius: 20,
  },
  hdrGlow: {
    position: 'absolute', top: -40, right: -40,
    width: 180, height: 180, borderRadius: 90,
    backgroundColor: 'rgba(132,204,22,0.13)',
  },
  hdrInner: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 6 },
  hdrTop: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', marginBottom: 16,
  },
  hdrEye: {
    fontSize: 11, fontFamily: 'Montserrat-SemiBold',
    color: 'rgba(255,255,255,0.45)', letterSpacing: 0.8,
    textTransform: 'uppercase', marginBottom: 3,
  },
  hdrTitle: {
    fontSize: 24, fontFamily: 'Montserrat-Bold',
    color: '#fff', letterSpacing: -0.5, maxWidth: width * 0.65,
  },
  hdrBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.11)', borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.16)', justifyContent: 'center',
    alignItems: 'center', marginTop: 4,
  },
  searchRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  searchPill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9,
    backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.16)', borderRadius: 14,
    paddingHorizontal: 13, height: 48,
  },
  searchPillActive: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderColor: 'rgba(255,255,255,0.3)',
  },
  searchInput: {
    flex: 1, fontSize: 14, fontFamily: 'Montserrat-Medium', color: '#fff', height: '100%',
  },
  clearBtn: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  filterFab: {
    width: 48, height: 48, borderRadius: 14, backgroundColor: C.lime,
    justifyContent: 'center', alignItems: 'center',
    elevation: 3, shadowColor: C.lime,
    shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 6,
  },
  hdrArc: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 28,
    backgroundColor: C.pageBg, borderTopLeftRadius: 28, borderTopRightRadius: 28,
  },
  listContent: { paddingBottom: 120 },
  chipStrip: {
    paddingHorizontal: 16, paddingVertical: 14, gap: 8, flexDirection: 'row',
  },
  chip: {
    // Fixed height — same fix as orders chips, prevents inflation
    height: 36, paddingHorizontal: 16, borderRadius: 18,
    borderWidth: 1, borderColor: C.navyMid, backgroundColor: C.card,
    justifyContent: 'center', alignItems: 'center',
    elevation: 1, shadowColor: C.navy,
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2,
  },
  chipOn:    { backgroundColor: C.lime, borderColor: C.lime },
  chipTxt:   { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: C.muted },
  chipTxtOn: { color: C.limeText },
  secHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 16, marginBottom: 12,
  },
  secTitle: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: C.body },
  secMeta:  { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: C.subtle },
  // ── Popular card — single logo image ───────────────────────────────────────
  popularStrip: { paddingLeft: 16, paddingRight: 8, paddingBottom: 20 },
  popularCard: {
    width: 148, backgroundColor: C.card, borderRadius: 22,
    overflow: 'hidden', marginRight: 12,
    elevation: 5, shadowColor: C.navy,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.09, shadowRadius: 14,
  },
  // The image wrapper — logo fills this area entirely
  popularImgWrap: {
    width: '100%',
    height: 110,   // slightly taller than before since there's no avatar offset
    position: 'relative',
  },
  popularLogo: {
    width: '100%',
    height: '100%',
    // cover keeps the logo centred and fills the space without letterboxing
    resizeMode: 'cover',
  },
  // Fallback when no logo URL — coloured block with initials centred
  popularLogoFallback: {
    width: '100%', height: '100%',
    backgroundColor: C.navy,
    justifyContent: 'center', alignItems: 'center',
  },
  popularLogoInitials: {
    fontSize: 28, fontFamily: 'Montserrat-Bold', color: C.lime,
  },
  // Gradient fades the bottom of the image so the card info below feels connected
  popularImgGradient: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    height: 40,          // only covers the bottom portion
    borderRadius: 0,     // no radius — abuts the info section directly
  },
  // Verified badge — absolute, top-right, sitting on top of the image
  verifiedBadge: {
    position: 'absolute', top: 8, right: 8,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: C.lime,
    borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3,
    // Subtle shadow so it lifts off the image
    elevation: 2, shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 3,
  },
  verifiedBadgeTxt: { fontSize: 9, fontFamily: 'Montserrat-Bold', color: C.limeText },
  popularInfo: { padding: 11 },   // no extra paddingTop — avatar overlap is gone
  popularName: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: C.body, marginBottom: 2 },
  popularCat:  { fontSize: 10, fontFamily: 'Montserrat-SemiBold', color: C.subtle, marginBottom: 8 },
  popularFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ratingPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8,
  },
  ratingPillTxt: { fontSize: 10, fontFamily: 'Montserrat-Bold', color: '#92400E' },
  popularItems:  { fontSize: 10, fontFamily: 'Montserrat-Bold', color: C.lime },
  // Store row
  storeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.card, borderRadius: 20, padding: 13,
    marginHorizontal: 14, marginBottom: 10,
    elevation: 3, shadowColor: C.navy,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8,
  },
  storeRowLogo: {
    width: 56, height: 56, borderRadius: 16, resizeMode: 'cover', backgroundColor: '#dbeafe',
  },
  storeRowLogoFallback: { backgroundColor: C.navy, justifyContent: 'center', alignItems: 'center' },
  storeRowLogoTxt: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#fff' },
  storeRowInfo: { flex: 1 },
  storeNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 },
  storeRowName: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: C.body, flex: 1 },
  inlineVerified: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: C.lime, justifyContent: 'center', alignItems: 'center',
  },
  storeRowMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  storeRowCat:  { fontSize: 11, fontFamily: 'Montserrat-SemiBold', color: C.subtle },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#CBD5E1' },
  storeRowItems: { fontSize: 11, fontFamily: 'Montserrat-Bold', color: C.lime },
  storeRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  storeRatingTxt: { fontSize: 11, fontFamily: 'Montserrat-SemiBold', color: C.navy },
  visitBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#EEF2FF', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12,
  },
  visitTxt: { fontSize: 11, fontFamily: 'Montserrat-Bold', color: C.navy },
  mapFab: {
    position: 'absolute', bottom: 86, alignSelf: 'center', marginBottom: 15,
    borderRadius: 30, elevation: 10, shadowColor: C.navy,
    shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.28, shadowRadius: 14, zIndex: 50,
  },
  mapFabInner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 12, paddingHorizontal: 22, borderRadius: 30,
  },
  mapFabTxt: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: '#fff' },
  emptyWrap: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 },
  emptyCircle: {
    width: 90, height: 90, borderRadius: 45, backgroundColor: '#EEF2FF',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
    elevation: 2, shadowColor: C.navy,
    shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 8,
  },
  emptyTitle: { fontSize: 17, fontFamily: 'Montserrat-Bold', color: C.body, marginBottom: 8 },
  emptyBody: {
    fontSize: 13, fontFamily: 'Montserrat-Medium', color: C.muted, textAlign: 'center', lineHeight: 20,
  },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(12,21,89,0.4)' },
  modalBackdrop: { flex: 1 },
  modalSheet: {
    backgroundColor: C.card, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 20, paddingBottom: 40,
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0',
    alignSelf: 'center', marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 20,
  },
  modalTitle: { fontSize: 17, fontFamily: 'Montserrat-Bold', color: C.body },
  modalClose: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center',
  },
  modalSectionLbl: {
    fontSize: 10, fontFamily: 'Montserrat-Bold', color: C.subtle,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12,
  },
  sortRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  sortChip: {
    flex: 1, paddingVertical: 10, borderRadius: 12,
    backgroundColor: '#F8FAFC', borderWidth: 0.5, borderColor: C.border, alignItems: 'center',
  },
  sortChipOn:    { backgroundColor: '#EEF2FF', borderColor: C.navyMid },
  sortChipTxt:   { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: C.muted },
  sortChipTxtOn: { color: C.navy, fontFamily: 'Montserrat-Bold' },
  switchRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 28, backgroundColor: '#F8FAFC', padding: 14,
    borderRadius: 14, borderWidth: 0.5, borderColor: C.border,
  },
  switchLbl: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: C.body, marginBottom: 2 },
  switchSub: { fontSize: 11, fontFamily: 'Montserrat-Medium', color: C.muted },
  applyBtn: {
    backgroundColor: C.navy, paddingVertical: 16, borderRadius: 16, alignItems: 'center',
    elevation: 4, shadowColor: C.navy,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10,
  },
  applyTxt: { fontSize: 15, fontFamily: 'Montserrat-Bold', color: '#fff' },
});