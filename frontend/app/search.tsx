import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, TextInput, StyleSheet, FlatList,
  TouchableOpacity, Dimensions, Keyboard,
  ScrollView, ActivityIndicator, Animated,
  Pressable,
} from 'react-native';
import AppImage from '@/components/AppImage';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import BottomNav from '../components/BottomNav';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { safePush } from '@/lib/navigation';
import { CustomInAppToast, storage, getActiveBanners, recordAdClick } from "@/services/api";
import { CompactAdCarousel } from '@/components/home/CompactAdCarousel';
import { HeroAd } from '@/components/home/HeroCarousel';
import { useProducts, useProductSearch } from '@/hooks/useProducts';
import { useStoreSearch } from '@/hooks/useBusiness';
import { useCategories } from '@/hooks/useCategories';
import { useCart } from '@/store/cartStore';
import { SearchSkeleton } from '@/components/skeletons/SearchSkeleton';
import { useOnboarding } from '@/context/OnboardingContext';
import { SpotlightTour } from '@/components/ui/SpotlightTour';
const { width } = Dimensions.get('window');
const CARD_W = (width - 52) / 2;
const RECENT_KEY = 'SHOPYOS_RECENT_SEARCHES';
const MAX_RECENT = 6;
// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg: '#E9F0FF',
  navy: '#0C1559',
  navyMid: '#1e3a8a',
  lime: '#84cc16',
  limeText: '#1a2e00',
  card: '#FFFFFF',
  body: '#0F172A',
  muted: '#64748B',
  subtle: '#94A3B8',
  border: 'rgba(12,21,89,0.08)',
  borderMd: 'rgba(12,21,89,0.14)',
};

const isFashionCategory = (cat: string | null) => {
  const c = String(cat || '').toLowerCase();
  return c.includes('fashion') || c.includes('footwear') || c.includes('sneaker') || c.includes('accessory') || c.includes('accessories') || c.includes('clothing');
};
const SORT_OPTIONS = [
  { label: 'Newest', value: 'newest' },
  { label: 'Price ↑', value: 'price_asc' },
  { label: 'Price ↓', value: 'price_desc' },
  { label: 'Popular', value: 'popular' },
];
const CATEGORY_IMAGES: Record<string, any> = {
  'Grocery': require('../assets/images/search/fooddrinks.png'),
  'Footwear': require('../assets/images/search/slipper1.png'),
  'Fashion': require('../assets/images/search/womencloth.png'),
  'Electronics': require('../assets/images/search/appliances.jpeg'),
  'Home': require('../assets/images/search/table.jpg'),
  'Health': require('../assets/images/search/supplement.png'),
  'Art': require('../assets/images/search/Arts1.png'),
  'Accessories': require('../assets/images/search/accessories.png'),
  'Beauty': require('../assets/images/search/supplement2.jpg'),
  'Sports': require('../assets/images/search/sports.jpg'),
  'Home & Kitchen': require('../assets/images/search/table2.jpg'),
  'Kitchen and home': require('../assets/images/search/table2.jpg'),
  'Other': require('../assets/images/search/arts2.jpeg'),
  'Sneakers': require('../assets/images/search/slipper2.jpg'),
  'Books': require('../assets/images/search/pencil.png'),
};
type ViewMode = 'grid' | 'list';

function buildFilters(
  category: string | null,
  gender: string | null,
  sortBy: string,
  params: ReturnType<typeof useLocalSearchParams>,
) {
  return {
    category: category ?? (params.category ? String(params.category) : undefined),
    gender: gender ?? (params.gender ? String(params.gender) : undefined),
    sortBy: sortBy as any,
    minPrice: params.minPrice ? Number.parseFloat(String(params.minPrice)) : undefined,
    maxPrice: params.maxPrice ? Number.parseFloat(String(params.maxPrice)) : undefined,
    minRating: params.minRating ? Number.parseFloat(String(params.minRating)) : undefined,
  };
}

async function addItemToCart(
  item: any,
  addToCart: (p: any) => void,
  setAddingId: (id: string | null) => void,
) {
  setAddingId(item._id);
  try {
    addToCart({
      id: item._id,
      title: item.name,
      category: item.category || 'General',
      price: Number.parseFloat(item.price) || 0,
      image: item.images?.[0] || 'https://via.placeholder.com/300',
      storeId: item.store_id || item.business_id || item.store?._id || item.store?.id,
    });
    CustomInAppToast.show({ type: 'success', title: 'Added to cart', message: item.name });
  } catch {
    CustomInAppToast.show({ type: 'error', title: 'Could not add to cart', message: 'Please try again later' });
  } finally {
    setAddingId(null);
  }
}

function AdPlaceholder({ style }: { style?: any }) {
  return (
    <View style={[styles.searchAdPlaceholder, style]}>
      <LinearGradient
        colors={['rgba(12,21,89,0.05)', 'rgba(12,21,89,0.02)']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.searchAdContent}>
        <View style={[styles.searchAdBadge, { backgroundColor: 'rgba(12,21,89,0.08)' }]}>
          <Text style={[styles.searchAdBadgeTxt, { color: C.muted }]}>ADS</Text>
        </View>
        <Text style={[styles.searchAdTitle, { color: C.muted }]}>Your campaign here</Text>
        <Text style={[styles.searchAdSub, { color: C.subtle }]}>Promote your store to buyers →</Text>
      </View>
    </View>
  );
}

function StoreList({ stores }: { stores: any[] }) {
  if (!stores || stores.length === 0) return null;
  return (
    <View style={styles.storesSection}>
      <View style={styles.storesHeader}>
        <Text style={styles.storesTitle}>Sellers</Text>
        <Text style={styles.storesCount}>{stores.length} found</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storeList}>
        {stores.map((store: any) => (
          <TouchableOpacity
            key={store.id}
            style={styles.storeCard}
            onPress={() => safePush('/stores/details', { id: store.id, name: store.name, logo: store.logo })}
          >
            <View style={styles.storeLogoWrap}>
              <AppImage uri={store.logo || 'https://via.placeholder.com/60'} style={styles.storeLogo} />
              {store.verified && (
                <View style={styles.verifiedBadgeSmall}>
                  <Ionicons name="checkmark-circle" size={10} color={C.lime} />
                </View>
              )}
            </View>
            <Text style={styles.storeName} numberOfLines={1}>{store.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const GridCard = React.memo(function GridCard({ item, addingId, onAddToCart }: { item: any; addingId: string | null; onAddToCart: (item: any) => void }) {
  return (
    <TouchableOpacity style={styles.gridCard} activeOpacity={0.88} onPress={() => safePush('/product/details', { id: item._id })}>
      <View style={styles.gridImgWrap}>
        <AppImage uri={item.images?.[0] || 'https://via.placeholder.com/300'} style={styles.gridImg} />
        <TouchableOpacity style={styles.favBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="heart-outline" size={13} color={C.navy} />
        </TouchableOpacity>
        {item.isNew && <View style={styles.badgeNew}><Text style={styles.badgeNewTxt}>NEW</Text></View>}
      </View>
      <View style={styles.gridInfo}>
        <Text style={styles.storeLbl} numberOfLines={1}>{item.store?.name || 'Shopyos'}</Text>
        <Text style={styles.productLbl} numberOfLines={2}>{item.name}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.priceLbl}>₵{Number.parseFloat(item.price).toFixed(2)}</Text>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={(e: any) => { e?.stopPropagation?.(); onAddToCart(item); }}
            disabled={addingId === item._id}
          >
            {addingId === item._id
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="add" size={14} color="#fff" />
            }
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
});

const FeaturedCard = React.memo(function FeaturedCard({ item, addingId, onAddToCart }: { item: any; addingId: string | null; onAddToCart: (item: any) => void }) {
  return (
    <TouchableOpacity style={styles.featCard} activeOpacity={0.88} onPress={() => safePush('/product/details', { id: item._id })}>
      <AppImage uri={item.images?.[0] || 'https://via.placeholder.com/300'} style={styles.featImg} />
      <View style={styles.featInfo}>
        <View style={styles.featBadge}><Text style={styles.featBadgeTxt}>TOP PICK</Text></View>
        <Text style={styles.featName} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.featStore} numberOfLines={1}>{item.store?.name || 'Shopyos'}</Text>
        <Text style={styles.featPrice}>₵{Number.parseFloat(item.price).toFixed(2)}</Text>
      </View>
      <TouchableOpacity
        style={styles.featAddBtn}
        onPress={(e: any) => { e?.stopPropagation?.(); onAddToCart(item); }}
        disabled={addingId === item._id}
      >
        {addingId === item._id
          ? <ActivityIndicator size="small" color={C.limeText} />
          : <Ionicons name="add" size={18} color={C.limeText} />
        }
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

const ListCard = React.memo(function ListCard({ item, addingId, onAddToCart }: { item: any; addingId: string | null; onAddToCart: (item: any) => void }) {
  return (
    <TouchableOpacity style={styles.listCard} activeOpacity={0.85} onPress={() => safePush('/product/details', { id: item._id })}>
      <AppImage uri={item.images?.[0] || 'https://via.placeholder.com/300'} style={styles.listImg} />
      <View style={styles.listInfo}>
        <Text style={styles.storeLbl} numberOfLines={1}>{item.store?.name || 'Shopyos'}</Text>
        <Text style={styles.productLbl} numberOfLines={2}>{item.name}</Text>
        <Text style={[styles.priceLbl, { fontSize: 14, fontFamily: 'Montserrat-Bold', color: C.lime }]}>
          ₵{Number.parseFloat(item.price).toFixed(2)}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.listAddBtn}
        onPress={(e: any) => { e?.stopPropagation?.(); onAddToCart(item); }}
        disabled={addingId === item._id}
      >
        {addingId === item._id
          ? <ActivityIndicator size="small" color="#fff" />
          : <Ionicons name="add" size={16} color="#fff" />
        }
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

function DiscoveryView({
  recentSearches,
  searchAds,
  visibleCategories,
  category,
  handleAdPress,
  clearRecent,
  setQuery,
  setCategory,
  inputRef,
}: {
  recentSearches: string[];
  searchAds: HeroAd[];
  visibleCategories: any[];
  category: string | null;
  handleAdPress: (ad: HeroAd) => void;
  clearRecent: () => void;
  setQuery: (q: string) => void;
  setCategory: (c: string | null) => void;
  inputRef: React.RefObject<TextInput>;
}) {
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.discoveryScroll} keyboardShouldPersistTaps="handled">
      {recentSearches.length > 0 && (
        <View style={styles.discSection}>
          <View style={styles.discHeader}>
            <Text style={styles.discLabel}>Recent</Text>
            <TouchableOpacity onPress={clearRecent}><Text style={styles.discClear}>Clear all</Text></TouchableOpacity>
          </View>
          {recentSearches.map(term => (
            <TouchableOpacity key={term} style={styles.recentRow} onPress={() => { setQuery(term); inputRef.current?.focus(); }}>
              <View style={styles.recentIcon}><Ionicons name="time-outline" size={14} color={C.navy} /></View>
              <Text style={styles.recentTxt}>{term}</Text>
              <Feather name="arrow-up-right" size={13} color={C.subtle} />
            </TouchableOpacity>
          ))}
        </View>
      )}
      {searchAds.length > 0
        ? <View style={{ marginTop: 4 }}><CompactAdCarousel ads={searchAds} onAdPress={handleAdPress} /></View>
        : <AdPlaceholder style={{ marginTop: 4 }} />
      }
      {visibleCategories.length > 0 && (
        <>
          <View style={styles.discDivider} />
          <View style={styles.discSection}>
            <Text style={styles.discLabel}>Browse categories</Text>
            <View style={styles.catTileGrid}>
              {[...visibleCategories].sort((a, b) => a.name.localeCompare(b.name)).map((cat: any) => {
                const isOn = category === cat.name;
                const catImg = CATEGORY_IMAGES[cat.name];
                return (
                  <TouchableOpacity
                    key={cat.id || cat.name}
                    style={[styles.catTile, isOn && styles.catTileSelected]}
                    onPress={() => { setCategory(isOn ? null : cat.name); setQuery(''); }}
                  >
                    <View style={styles.catTileInner}>
                      {catImg
                        ? <AppImage source={catImg} style={styles.catTileBgImg} />
                        : <View style={[styles.catTileBgImg, { backgroundColor: '#1E293B' }]} />
                      }
                      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.82)']} style={styles.catTileScrim} />
                      {isOn && <View style={styles.catTileActiveTint} />}
                      <View style={styles.catTileTextWrap}>
                        {isOn && <View style={styles.catTileCheckmark}><Ionicons name="checkmark" size={9} color="#fff" /></View>}
                        <Text style={styles.catTileTxtLeft} numberOfLines={2}>{cat.name}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}

function EmptyResults({ setQuery, setCategory, setSortBy }: { setQuery: (q: string) => void; setCategory: (c: string | null) => void; setSortBy: (s: string) => void }) {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyCircle}>
        <MaterialCommunityIcons name="archive-search-outline" size={44} color={C.navy} />
      </View>
      <Text style={styles.emptyTitle}>Nothing found</Text>
      <Text style={styles.emptyBody}>Try different keywords or remove active filters.</Text>
      <TouchableOpacity style={styles.resetBtn} onPress={() => { setQuery(''); setCategory(null); setSortBy('newest'); }}>
        <Text style={styles.resetBtnTxt}>Reset filters</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function SearchScreen() {
  const addToCart = useCart((s) => s.addToCart);
  const params = useLocalSearchParams();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(
    params.category ? String(params.category) : null
  );
  const [gender, setGender] = useState<string | null>(
    params.gender ? String(params.gender) : null
  );
  const [sortBy, setSortBy] = useState<string>(
    params.sortBy ? String(params.sortBy) : 'newest'
  );
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortOpen, setSortOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [searchAds, setSearchAds] = useState<HeroAd[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await getActiveBanners();
        if (res?.banners?.length > 0) setSearchAds(res.banners);
      } catch { }
    })();
  }, []);

  const handleAdPress = useCallback((ad: HeroAd) => {
    recordAdClick(ad.id).catch(() => {});
    if (ad.product?.id) safePush('/product/details', { id: ad.product.id });
    else if (ad.store_id) safePush('/stores/details', { id: ad.store_id });
  }, []);

  useEffect(() => {
    if (typeof params.query === 'string') {
      setQuery(params.query);
    } else if (Array.isArray(params.query)) {
      setQuery(params.query[0] || '');
    }
    setCategory(params.category ? String(params.category) : null);
    setGender(params.gender ? String(params.gender) : null);
    setSortBy(params.sortBy ? String(params.sortBy) : 'newest');
  }, [params.query, params.category, params.gender, params.sortBy]);

  const { startTour, markCompleted, isTourActive, activeScreen } = useOnboarding();
  const [layouts, setLayouts] = useState<any>({});
  const refSearchPill = useRef<View>(null);
  const refActions = useRef<View>(null);
  const refTrending = useRef<View>(null);
  const measureElement = (ref: any, key: string) => {
    if (ref.current) {
      ref.current.measureInWindow((x: number, y: number, w: number, h: number) => {
        setLayouts((prev: any) => ({ ...prev, [key]: { x, y, width: w, height: h } }));
      });
    }
  };
  useEffect(() => {
    const timer = setTimeout(() => {
      measureElement(refSearchPill, 'search');
      measureElement(refActions, 'actions');
      measureElement(refTrending, 'trending');
      startTour('search');
    }, 1500);
    return () => clearTimeout(timer);
  }, [startTour]);
  const onboardingSteps = [
    { targetLayout: layouts.search, title: 'Smart Search', description: 'Find products, stores, or categories instantly by typing here.' },
    { targetLayout: layouts.actions, title: 'Filter & Sort', description: 'Refine your results by price, date, or popularity to find the best deals.' },
    { targetLayout: layouts.trending, title: 'Discovery', description: "Explore trending searches and top categories to see what's hot right now." },
  ].filter(s => !!s.targetLayout);

  useEffect(() => {
    storage.getItem(RECENT_KEY).then(raw => {
      if (raw) setRecentSearches(JSON.parse(raw));
    });
  }, []);
  const saveRecent = useCallback(async (term: string) => {
    if (!term.trim()) return;
    setRecentSearches(prev => {
      const next = [term, ...prev.filter(r => r !== term)].slice(0, MAX_RECENT);
      storage.setItem(RECENT_KEY, JSON.stringify(next));
      return next;
    });
  }, []);
  const clearRecent = useCallback(async () => {
    setRecentSearches([]);
    await storage.removeItem(RECENT_KEY);
  }, []);

  const { data: categoriesData } = useCategories();
  const categories = categoriesData || [];
  const visibleCategories = categories.filter((cat: any) => {
    const name = String(cat?.name || '').trim().toLowerCase();
    return name !== 'automotive' && name !== 'toys';
  });
  const filters = buildFilters(category, gender, sortBy, params);
  const isActive = query.length >= 2;
  const { data: allData, isLoading: loadingAll, refetch: refetchAll } = useProducts(filters, 50);
  const { data: searchData, isLoading: loadingSearch, refetch: refetchSearch } = useProductSearch(query, filters, 50);
  const { data: storeSearchData, refetch: refetchStores } = useStoreSearch(query, category, 10);
  const loading = isActive ? loadingSearch : loadingAll;
  const activeProducts = searchData?.success ? searchData.products : [];
  const browseProducts = allData?.success ? allData.products : [];
  const products = isActive ? activeProducts : browseProducts;
  const showStores = isActive || !!category;
  const stores = useMemo(
    () => showStores && storeSearchData?.success ? (storeSearchData.data || storeSearchData.businesses || []) : [],
    [showStores, storeSearchData]
  );

  useEffect(() => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0.3, duration: 80, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 240, useNativeDriver: true }),
    ]).start();
  }, [products.length, viewMode, category, fadeAnim]);
  useEffect(() => {
    Animated.timing(slideAnim, { toValue: sortOpen ? 1 : 0, duration: 180, useNativeDriver: true }).start();
  }, [slideAnim, sortOpen]);

  const handleChangeText = (text: string) => { setQuery(text); if (category) setCategory(null); };
  const handleSubmit = () => { if (query.trim().length >= 2) saveRecent(query.trim()); Keyboard.dismiss(); };
  const handleAddToCart = useCallback((item: any) => addItemToCart(item, addToCart, setAddingId), [addToCart, setAddingId]);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await Promise.all([refetchAll(), refetchSearch(), refetchStores()]); }
    finally { setRefreshing(false); }
  }, [refetchAll, refetchSearch, refetchStores]);

  const headingTop = isActive ? 'Results for' : 'Discover';
  const renderListHeader = useCallback(() => (
    <View>
      <StoreList stores={stores} />
      {searchAds.length > 0
        ? <CompactAdCarousel ads={searchAds} onAdPress={handleAdPress} />
        : <AdPlaceholder />
      }
    </View>
  ), [stores, searchAds, handleAdPress]);
  const renderGrid = useCallback(({ item }: { item: any }) => <GridCard item={item} addingId={addingId} onAddToCart={handleAddToCart} />, [addingId, handleAddToCart]);
  const renderList = useCallback(({ item, index }: { item: any; index: number }) =>
    index === 0
      ? <FeaturedCard item={item} addingId={addingId} onAddToCart={handleAddToCart} />
      : <ListCard item={item} addingId={addingId} onAddToCart={handleAddToCart} />,
  [addingId, handleAddToCart]);
  const renderEmpty = useCallback(() => <EmptyResults setQuery={setQuery} setCategory={setCategory} setSortBy={setSortBy} />, [setQuery, setCategory, setSortBy]);

  return (
    <Pressable onPress={() => { Keyboard.dismiss(); setSortOpen(false); }} style={{ flex: 1 }}>
      <View style={styles.root}>
        <StatusBar style="light" />
        <LinearGradient colors={[C.navy, C.navyMid]} style={styles.hdrGradient}>
          <View style={styles.hdrGlow} pointerEvents="none" />
          <SafeAreaView edges={['top', 'left', 'right']}>
            <View style={styles.hdrInner}>
              <View style={styles.hdrTop}>
                <View>
                  <Text style={styles.hdrEyebrow}>{headingTop}</Text>
                  <Text style={styles.hdrTitle} numberOfLines={1}>
                    {isActive
                      ? <>{'"'}<Text style={{ color: C.lime }}>{query}</Text>{'"'}</>
                      : <>{'Find your '}<Text style={{ color: C.lime }}>{'match'}</Text></>
                    }
                  </Text>
                </View>
                <View style={styles.hdrActions} ref={refActions} onLayout={() => measureElement(refActions, 'actions')}>
                  <TouchableOpacity style={styles.hdrBtn} onPress={() => safePush('/cart')}>
                    <Feather name="shopping-bag" size={16} color="rgba(255,255,255,0.8)" />
                  </TouchableOpacity>
                </View>
              </View>
              <View style={[styles.searchPill, query.length > 0 && styles.searchPillFocused]} ref={refSearchPill} onLayout={() => measureElement(refSearchPill, 'search')}>
                <Feather name="search" size={15} color="rgba(255,255,255,0.5)" />
                <TextInput
                  ref={inputRef}
                  style={styles.searchInput}
                  placeholder="Search products, brands…"
                  placeholderTextColor="rgba(255,255,255,0.32)"
                  value={query}
                  onChangeText={handleChangeText}
                  onSubmitEditing={handleSubmit}
                  returnKeyType="search"
                  autoCorrect={false}
                  autoCapitalize="none"
                />
                {query.length > 0 ? (
                  <TouchableOpacity style={styles.clearBtn} onPress={() => { setQuery(''); setCategory(null); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close" size={10} color="#fff" />
                  </TouchableOpacity>
                ) : (
                  <View style={styles.kbdHint}><Text style={styles.kbdHintTxt}>⌘K</Text></View>
                )}
              </View>
            </View>
          </SafeAreaView>
          <View style={styles.hdrArc} />
        </LinearGradient>
        {(loading && products.length === 0 && !isActive && !category) ? (
          <View style={{ flex: 1 }}><SearchSkeleton /></View>
        ) : (
          <View style={{ flex: 1, backgroundColor: '#ffffff', zIndex: 10 }}>
            {!isActive && !category ? (
              <DiscoveryView
                recentSearches={recentSearches}
                searchAds={searchAds}
                visibleCategories={visibleCategories}
                category={category}
                handleAdPress={handleAdPress}
                clearRecent={clearRecent}
                setQuery={setQuery}
                setCategory={setCategory}
                inputRef={inputRef}
              />
            ) : (
              <View style={{ flex: 1 }}>
                {isFashionCategory(category) && (
                  <View style={styles.genderFilterRow}>
                    {['All', 'Men', 'Women', 'Unisex', 'Boys', 'Girls'].map((g) => {
                      const active = (g === 'All' && !gender) || gender === g;
                      return (
                        <TouchableOpacity key={g} style={[styles.genderFilterChip, active && styles.genderFilterChipActive]} onPress={() => setGender(g === 'All' ? null : g)}>
                          <Text style={[styles.genderFilterChipTxt, active && styles.genderFilterChipTxtActive]}>{g}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
                <View style={styles.toolbar}>
                  <Text style={styles.resultCount}>
                    {products.length}{' '}{isActive ? 'result' : 'product'}{products.length === 1 ? '' : 's'}
                  </Text>
                  <View style={styles.toolbarRight}>
                    <View style={styles.viewToggle}>
                      <TouchableOpacity style={[styles.vtBtn, viewMode === 'grid' && styles.vtBtnOn]} onPress={() => setViewMode('grid')}>
                        <MaterialCommunityIcons name="view-grid-outline" size={15} color={viewMode === 'grid' ? '#fff' : C.muted} />
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.vtBtn, viewMode === 'list' && styles.vtBtnOn]} onPress={() => setViewMode('list')}>
                        <MaterialCommunityIcons name="view-list-outline" size={15} color={viewMode === 'list' ? '#fff' : C.muted} />
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity style={styles.sortBtn} onPress={() => setSortOpen(v => !v)}>
                      <Ionicons name="funnel-outline" size={11} color={C.navy} />
                      <Text style={styles.sortBtnTxt}>{SORT_OPTIONS.find(s => s.value === sortBy)?.label ?? 'Sort'}</Text>
                      <Ionicons name={sortOpen ? 'chevron-up' : 'chevron-down'} size={11} color={C.navy} />
                    </TouchableOpacity>
                  </View>
                </View>
                {sortOpen && (
                  <Animated.View style={[styles.sortDropdown, { opacity: slideAnim, transform: [{ translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }] }]}>
                    {SORT_OPTIONS.map(opt => (
                      <TouchableOpacity key={opt.value} style={[styles.sortOption, sortBy === opt.value && styles.sortOptionOn]} onPress={() => { setSortBy(opt.value); setSortOpen(false); }}>
                        <Text style={[styles.sortOptionTxt, sortBy === opt.value && { color: C.navy }]}>{opt.label}</Text>
                        {sortBy === opt.value && <Ionicons name="checkmark" size={14} color={C.lime} />}
                      </TouchableOpacity>
                    ))}
                  </Animated.View>
                )}
                <Animated.View style={{ flex: 1, opacity: loading ? 0.6 : fadeAnim }}>
                  {viewMode === 'grid' ? (
                    <FlatList key="grid" data={products} keyExtractor={item => item._id} numColumns={2} contentContainerStyle={styles.gridContent} columnWrapperStyle={styles.gridRow} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" initialNumToRender={10} maxToRenderPerBatch={10} windowSize={10} removeClippedSubviews renderItem={renderGrid} ListHeaderComponent={renderListHeader} ListEmptyComponent={renderEmpty} refreshing={refreshing} onRefresh={onRefresh} />
                  ) : (
                    <FlatList key="list" data={products} keyExtractor={item => item._id} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" initialNumToRender={10} maxToRenderPerBatch={10} windowSize={10} removeClippedSubviews renderItem={renderList} ListHeaderComponent={renderListHeader} ListEmptyComponent={renderEmpty} refreshing={refreshing} onRefresh={onRefresh} />
                  )}
                </Animated.View>
              </View>
            )}
          </View>
        )}
        <BottomNav />
      </View>
      <SpotlightTour
        visible={isTourActive && activeScreen === 'search'}
        steps={onboardingSteps}
        onComplete={() => markCompleted('search')}
      />
    </Pressable>
  );
}
// ─── Styles ───────────────────────────────────────────────────────────────────
const C2 = {
  bg: '#FFFFFF',
  navy: '#0C1559',
  navyMid: '#1e3a8a',
  lime: '#84cc16',
  limeText: '#1a2e00',
  card: '#FFFFFF',
  body: '#0F172A',
  muted: '#64748B',
  subtle: '#94A3B8',
  border: 'rgba(12,21,89,0.08)',
  borderMd: 'rgba(12,21,89,0.14)',
};
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C2.bg },
  // ── Header ─────────────────────────────────────────────────────────────────
  hdrGradient: {
    position: 'relative',
    paddingBottom: 28,   // extra space absorbed by arc
    zIndex: 20,
    // Shadow thrown onto the page bg
    elevation: 12,
    shadowColor: C2.navy,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
  },
  hdrGlow: {
    position: 'absolute',
    top: -60,
    left: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(132,204,22,0.13)',
  },
  hdrInner: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 6 },
  hdrTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  hdrEyebrow: {
    fontSize: 11,
    fontFamily: 'Montserrat-SemiBold',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  hdrTitle: {
    fontSize: 26,
    fontFamily: 'Montserrat-Bold',
    color: '#fff',
    letterSpacing: -0.5,
  },
  hdrActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  hdrBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.11)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.16)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Search pill — embedded in header
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 50,
  },
  searchPillFocused: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderColor: 'rgba(255,255,255,0.3)',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Montserrat-Medium',
    color: '#fff',
    height: '100%',
  },
  clearBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  kbdHint: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  kbdHintTxt: {
    fontSize: 10,
    fontFamily: 'Montserrat-Bold',
    color: 'rgba(255,255,255,0.45)',
  },
  // White arc at bottom of header
  hdrArc: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 28,
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  // ── Category chips ─────────────────────────────────────────────────────────
  chipStrip: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 20,
    gap: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 18,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 1,
    shadowColor: C2.navy,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
  },
  chipOn: {
    backgroundColor: C2.lime,
    borderColor: C2.lime,
    shadowColor: C2.lime,
    shadowOpacity: 0.2,
  },
  chipTxt: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: '#64748B' },
  chipTxtOn: { color: C2.limeText },
  // ── Toolbar ────────────────────────────────────────────────────────────────
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    backgroundColor: '#fff',
    zIndex: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  resultCount: {
    fontSize: 12,
    fontFamily: 'Montserrat-SemiBold',
    color: C2.muted,
  },
  toolbarRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(12,21,89,0.06)',
    borderRadius: 10,
    padding: 2,
    gap: 2,
  },
  vtBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vtBtnOn: { backgroundColor: C2.navy },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: C2.card,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 0.5,
    borderColor: C2.borderMd,
    elevation: 2,
    shadowColor: C2.navy,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  sortBtnTxt: { fontSize: 11, fontFamily: 'Montserrat-Bold', color: C2.navy },
  // ── Sort dropdown ──────────────────────────────────────────────────────────
  sortDropdown: {
    position: 'absolute',
    top: 46,
    right: 16,
    zIndex: 100,
    backgroundColor: C2.card,
    borderRadius: 16,
    paddingVertical: 4,
    width: 160,
    elevation: 16,
    shadowColor: C2.navy,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    borderWidth: 0.5,
    borderColor: C2.border,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  sortOptionOn: { backgroundColor: 'rgba(132,204,22,0.07)' },
  sortOptionTxt: { fontSize: 13, fontFamily: 'Montserrat-SemiBold', color: C2.body },
  // ── Filter chip bar ────────────────────────────────────────────────────────
  filterChipStrip: {
    paddingHorizontal: 12, paddingVertical: 8, gap: 8,
    flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: 'rgba(12,21,89,0.06)',
  },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1, borderColor: C2.borderMd,
    backgroundColor: '#fff',
  },
  filterChipOn: { backgroundColor: C2.lime, borderColor: C2.lime },
  filterChipTxt: { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: C2.navy },
  filterChipTxtOn: { color: C2.limeText },
  // ── Filter bottom sheet ────────────────────────────────────────────────────
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  filterSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 36,
  },
  filterSheetHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0',
    alignSelf: 'center', marginBottom: 16,
  },
  filterSheetTitle: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: C2.navy, marginBottom: 14 },
  filterSheetSubtitle: { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: C2.muted, marginBottom: 8 },
  filterSheetRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  filterSheetRowOn: { backgroundColor: 'rgba(132,204,22,0.07)' },
  filterSheetRowTxt: { fontSize: 14, fontFamily: 'Montserrat-SemiBold', color: C2.body },
  filterChipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterSheetChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: C2.borderMd,
  },
  filterSheetChipOn: { backgroundColor: C2.lime, borderColor: C2.lime },
  filterSheetChipTxt: { fontSize: 13, fontFamily: 'Montserrat-SemiBold', color: C2.body },
  filterSheetChipTxtOn: { color: C2.limeText },
  filterSheetClear: {
    marginTop: 20, alignSelf: 'center',
    paddingHorizontal: 24, paddingVertical: 10,
    borderRadius: 20, borderWidth: 1, borderColor: C2.borderMd,
  },
  filterSheetClearTxt: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: C2.muted },
  // ── Grid ───────────────────────────────────────────────────────────────────
  gridContent: { paddingHorizontal: 14, paddingBottom: 110 },
  gridRow: { justifyContent: 'space-between', marginBottom: 14 },
  gridCard: {
    width: CARD_W,
    backgroundColor: C2.card,
    borderRadius: 22,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: C2.navy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  gridImgWrap: { width: '100%', height: 136, position: 'relative' },
  gridImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  favBtn: {
    position: 'absolute',
    top: 9, right: 9,
    width: 28, height: 28,
    borderRadius: 14,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  badgeNew: {
    position: 'absolute',
    top: 9, left: 9,
    backgroundColor: C2.lime,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeNewTxt: { fontSize: 9, fontFamily: 'Montserrat-Bold', color: C2.limeText, letterSpacing: 0.4 },
  gridInfo: { padding: 11 },
  // ── Shared product text ────────────────────────────────────────────────────
  storeLbl: {
    fontSize: 9,
    fontFamily: 'Montserrat-Bold',
    color: C2.subtle,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  productLbl: {
    fontSize: 13,
    fontFamily: 'Montserrat-Bold',
    color: C2.body,
    lineHeight: 18,
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceLbl: { fontSize: 15, fontFamily: 'Montserrat-Bold', color: C2.lime },
  addBtn: {
    width: 28, height: 28,
    borderRadius: 10,
    backgroundColor: C2.navy,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: C2.navy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  // Stores section
  storesSection: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.03)', marginBottom: 8 },
  storesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  storesTitle: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: C2.navy, textTransform: 'uppercase', letterSpacing: 0.5 },
  storesCount: { fontSize: 11, fontFamily: 'Montserrat-Medium', color: C2.subtle },
  storeList: { paddingLeft: 16, paddingRight: 16, gap: 16, flexDirection: 'row' },
  storeCard: {
    width: 68,
    alignItems: 'center',
    gap: 8,
  },
  storeLogoWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#fff',
    padding: 0,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    position: 'relative',
  },
  storeLogo: { width: '100%', height: '100%', borderRadius: 28 },
  storeName: { fontSize: 10, fontFamily: 'Montserrat-SemiBold', color: C2.body, textAlign: 'center' },
  verifiedBadgeSmall: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  // ── Featured card (list top result) ───────────────────────────────────────
  featCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: C2.navy,
    borderRadius: 22,
    padding: 14,
    marginHorizontal: 14,
    marginBottom: 10,
    elevation: 8,
    shadowColor: C2.navy,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  featImg: {
    width: 78,
    height: 78,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  featInfo: { flex: 1 },
  featBadge: {
    backgroundColor: C2.lime,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  featBadgeTxt: { fontSize: 9, fontFamily: 'Montserrat-Bold', color: C2.limeText, letterSpacing: 0.5 },
  featName: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#fff', marginBottom: 3, lineHeight: 19 },
  featStore: { fontSize: 10, fontFamily: 'Montserrat-SemiBold', color: 'rgba(255,255,255,0.45)', marginBottom: 6 },
  featPrice: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: C2.lime },
  featAddBtn: {
    width: 36, height: 36,
    borderRadius: 12,
    backgroundColor: C2.lime,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-end',
    elevation: 2,
    shadowColor: C2.lime,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  // ── List card ──────────────────────────────────────────────────────────────
  listContent: { paddingHorizontal: 14, paddingBottom: 110 },
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C2.card,
    borderRadius: 18,
    padding: 12,
    marginBottom: 10,
    elevation: 3,
    shadowColor: C2.navy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  listImg: {
    width: 72, height: 72,
    borderRadius: 14,
    backgroundColor: '#EEF2FF',
  },
  listInfo: { flex: 1 },
  listAddBtn: {
    width: 34, height: 34,
    borderRadius: 11,
    backgroundColor: C2.navy,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: C2.navy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  // ── Discovery ─────────────────────────────────────────────────────────────
  discoveryScroll: { paddingTop: 6, paddingBottom: 110 },
  discSection: { paddingHorizontal: 20, paddingVertical: 16 },
  discHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  discLabel: {
    fontSize: 10,
    fontFamily: 'Montserrat-Bold',
    color: C2.subtle,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 20,
  },
  discClear: { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: C2.navyMid },
  discDivider: { height: 0.5, backgroundColor: C2.border, marginHorizontal: 20 },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: C2.border,
    gap: 10,
  },
  recentIcon: {
    width: 34, height: 34,
    borderRadius: 11,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recentTxt: { flex: 1, fontSize: 14, fontFamily: 'Montserrat-Medium', color: '#334155' },
  trendWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  trendChip: {
    backgroundColor: C2.card,
    borderWidth: 0.5,
    borderColor: C2.borderMd,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    elevation: 1,
    shadowColor: C2.navy,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
  },
  trendChipTxt: { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: '#334155' },
  catTileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
catTile: {
  width: (width - 50) / 2,
  height: 100,
  borderRadius: 18,
  overflow: 'hidden',       // ← move overflow here so shadow still works
  elevation: 5,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.2,
  shadowRadius: 8,
},
catTileSelected: {
  elevation: 8,
  shadowOpacity: 0.32,
},
catTileInner: {
  flex: 1,
  borderRadius: 18,
  overflow: 'hidden',
  position: 'relative',
},
catTileBgImg: {
  position: 'absolute',
  top: 0, left: 0, right: 0, bottom: 0,
  width: '100%',
  height: '100%',
},
catTileScrim: {
  position: 'absolute',
  top: 0, left: 0, right: 0, bottom: 0,
},
catTileActiveTint: {
  position: 'absolute',
  top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(12,21,89,0.45)',   // navy tint when selected
},
catTileTextWrap: {
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  paddingHorizontal: 12,
  paddingBottom: 12,
  flexDirection: 'row',
  alignItems: 'center',
  gap: 5,
},
catTileCheckmark: {
  width: 16, height: 16,
  borderRadius: 8,
  backgroundColor: C2.lime,
  justifyContent: 'center',
  alignItems: 'center',
},
catTileTxtLeft: {
  fontSize: 13,
  fontFamily: 'Montserrat-Bold',
  color: '#fff',
  lineHeight: 17,
  textShadowColor: 'rgba(0,0,0,0.6)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 4,
  flex: 1,
},
catTileFallback: {   // keep for safety, though now unused
  flex: 1,
  paddingTop: 16,
  paddingLeft: 16,
  borderRadius: 18,
},
  // ── Empty state ───────────────────────────────────────────────────────────
  emptyWrap: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  emptyCircle: {
    width: 96, height: 96,
    borderRadius: 48,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
    elevation: 2,
    shadowColor: C2.navy,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  emptyTitle: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: C2.body, marginBottom: 8 },
  emptyBody: {
    fontSize: 13,
    fontFamily: 'Montserrat-Medium',
    color: C2.muted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  resetBtn: {
    backgroundColor: C2.navy,
    paddingVertical: 13,
    paddingHorizontal: 28,
    borderRadius: 14,
    elevation: 3,
    shadowColor: C2.navy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  resetBtnTxt: { color: '#fff', fontSize: 13, fontFamily: 'Montserrat-Bold' },
  genderFilterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 6,
    gap: 8,
    backgroundColor: '#ffffff',
  },
  genderFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(12,21,89,0.08)',
    backgroundColor: '#F8FAFC',
  },
  genderFilterChipActive: {
    backgroundColor: '#0C1559',
    borderColor: '#0C1559',
  },
  genderFilterChipTxt: {
    fontSize: 11,
    fontFamily: 'Montserrat-SemiBold',
    color: '#64748B',
  },
  genderFilterChipTxtActive: {
    color: '#ffffff',
  },
  searchAdBanner: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    height: 90,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    elevation: 3,
    shadowColor: '#0C1559',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  searchAdPlaceholder: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    height: 90,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(12,21,89,0.1)',
    borderStyle: 'dashed',
  },
  searchAdImg: {
    ...StyleSheet.absoluteFillObject,
    resizeMode: 'cover',
  },
  searchAdContent: {
    position: 'absolute',
    left: 16,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    zIndex: 10,
  },
  searchAdBadge: {
    backgroundColor: '#84cc16',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  searchAdBadgeTxt: {
    fontSize: 8,
    fontFamily: 'Montserrat-Bold',
    color: '#1a2e00',
  },
  searchAdTitle: {
    fontSize: 15,
    fontFamily: 'Montserrat-Bold',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  searchAdSub: {
    fontSize: 10,
    fontFamily: 'Montserrat-Medium',
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
});
