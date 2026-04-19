import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, StyleSheet, FlatList,
  TouchableOpacity, Dimensions, Image, Keyboard,
  Pressable, ScrollView, ActivityIndicator, Animated,
} from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import BottomNav from '../components/BottomNav';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { safePush } from '@/lib/navigation';
import { CustomInAppToast, storage } from "@/services/api";
import { useProducts, useProductSearch } from '@/hooks/useProducts';
import { useStoreSearch } from '@/hooks/useBusiness';
import { useCategories } from '@/hooks/useCategories';
import { useCart } from '@/context/CartContext';
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
// Category tile accent colours — one per category slot
const CAT_ACCENTS = [
  { bg: '#EEF2FF', text: '#0C1559' },
  { bg: '#F0FDF4', text: '#166534' },
  { bg: '#FEF9C3', text: '#713F12' },
  { bg: '#FCE7F3', text: '#831843' },
  { bg: '#FFF7ED', text: '#92400E' },
  { bg: '#F0F9FF', text: '#075985' },
];
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
export default function SearchScreen() {
  const { addToCart } = useCart();
  const params = useLocalSearchParams();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(
    params.category ? String(params.category) : null
  );
  const [sortBy, setSortBy] = useState<string>(
    params.sortBy ? String(params.sortBy) : 'newest'
  );
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortOpen, setSortOpen] = useState(false);
  const [recentSearches, setRecent] = useState<string[]>([]);
  const [addingId, setAddingId] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  // --- Onboarding ---
  const { startTour, markCompleted, isTourActive, activeScreen } = useOnboarding();
  const [layouts, setLayouts] = useState<any>({});
  const refSearchPill = useRef<View>(null);
  const refActions = useRef<View>(null);
  const refTrending = useRef<View>(null);
  const measureElement = (ref: any, key: string) => {
    if (ref.current) {
      ref.current.measureInWindow((x: number, y: number, width: number, height: number) => {
        setLayouts((prev: any) => ({ ...prev, [key]: { x, y, width, height } }));
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
    {
      targetLayout: layouts.search,
      title: 'Smart Search',
      description: 'Find products, stores, or categories instantly by typing here.',
    },
    {
      targetLayout: layouts.actions,
      title: 'Filter & Sort',
      description: 'Refine your results by price, date, or popularity to find the best deals.',
    },
    {
      targetLayout: layouts.trending,
      title: 'Discovery',
      description: 'Explore trending searches and top categories to see what’s hot right now.',
    },
  ].filter(s => !!s.targetLayout);
  const handleOnboardingComplete = () => {
    markCompleted('search');
  };
  // ── Recent searches ────────────────────────────────────────────────────────
  useEffect(() => {
    storage.getItem(RECENT_KEY).then(raw => {
      if (raw) setRecent(JSON.parse(raw));
    });
  }, []);
  const saveRecent = useCallback(async (term: string) => {
    if (!term.trim()) return;
    setRecent(prev => {
      const next = [term, ...prev.filter(r => r !== term)].slice(0, MAX_RECENT);
      storage.setItem(RECENT_KEY, JSON.stringify(next));
      return next;
    });
  }, []);
  const clearRecent = useCallback(async () => {
    setRecent([]);
    await storage.removeItem(RECENT_KEY);
  }, []);
  // ── Data ────────────────────────────────────────────────────────────────────
  const { data: categoriesData } = useCategories();
  const categories = categoriesData || [];
  const filters = {
    category: category ?? (params.category ? String(params.category) : undefined),
    sortBy: sortBy as any,
    minPrice: params.minPrice ? parseFloat(String(params.minPrice)) : undefined,
    maxPrice: params.maxPrice ? parseFloat(String(params.maxPrice)) : undefined,
  };
  const isActive = query.length >= 2;
  const { data: allData, isLoading: loadingAll } = useProducts(filters, 50);
  const { data: searchData, isLoading: loadingSearch } = useProductSearch(query, filters, 50);
  const { data: storeSearchData } = useStoreSearch(query, 10);
  const loading = isActive ? loadingSearch : loadingAll;
  const products = isActive
    ? (searchData?.success ? searchData.products : [])
    : (allData?.success ? allData.products : []);
  const stores = isActive && storeSearchData?.success ? storeSearchData.data : [];
  // Cross-fade on data / view change
  useEffect(() => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0.3, duration: 80, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 240, useNativeDriver: true }),
    ]).start();
  }, [products.length, viewMode, category, fadeAnim]);
  // Slide-in sort dropdown
  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: sortOpen ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [slideAnim, sortOpen]);
  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleChangeText = (text: string) => {
    setQuery(text);
    if (category) setCategory(null);
  };
  const handleSubmit = () => {
    if (query.trim().length >= 2) saveRecent(query.trim());
    Keyboard.dismiss();
  };
  const handleProductPress = (item: any) => {
    safePush(`/product/${item._id}`, { name: item.name, price: item.price, image: item.images?.[0] || '' });
  };
  const handleAddToCart = async (item: any) => {
    setAddingId(item._id);
    try {
      addToCart({
        id: item._id,
        title: item.name,
        category: item.category || 'General',
        price: parseFloat(item.price) || 0,
        image: item.images?.[0] || 'https://via.placeholder.com/300'
      });
      CustomInAppToast.show({ type: 'success', title: 'Added to cart', message: item.name });
    } catch {
      CustomInAppToast.show({ type: 'error', title: 'Could not add to cart', message: 'Please try again later' });
    } finally {
      setAddingId(null);
    }
  };
  // ── Header title ────────────────────────────────────────────────────────────
  const headingTop = isActive ? 'Results for' : 'Discover';
  // ── Render: stores ──────────────────────────────────────────────────────────
  const renderStores = () => {
    if (!stores || stores.length === 0) return null;
    return (
      <View style={styles.storesSection}>
        <View style={styles.storesHeader}>
          <Text style={styles.storesTitle}>Sellers</Text>
          <Text style={styles.storesCount}>
            {stores.length} found
          </Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.storeList}
        >
          {stores.map((store: any) => (
            <TouchableOpacity
              key={store.id}
              style={styles.storeCard}
              onPress={() => safePush('/stores/details', { id: store.id, name: store.name, logo: store.logo })}
            >
              <View style={styles.storeLogoWrap}>
                <Image
                  source={{ uri: store.logo || 'https://via.placeholder.com/60' }}
                  style={styles.storeLogo}
                />
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
  };
  // ── Render: grid card ───────────────────────────────────────────────────────
  const renderGrid = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.gridCard}
      activeOpacity={0.88}
      onPress={() => handleProductPress(item)}
    >
      <View style={styles.gridImgWrap}>
        <Image
          source={{ uri: item.images?.[0] || 'https://via.placeholder.com/300' }}
          style={styles.gridImg}
        />
        <TouchableOpacity style={styles.favBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="heart-outline" size={13} color={C.navy} />
        </TouchableOpacity>
        {item.isNew && (
          <View style={styles.badgeNew}><Text style={styles.badgeNewTxt}>NEW</Text></View>
        )}
      </View>
      <View style={styles.gridInfo}>
        <Text style={styles.storeLbl} numberOfLines={1}>
          {item.store?.name || 'Shopyos'}
        </Text>
        <Text style={styles.productLbl} numberOfLines={2}>{item.name}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.priceLbl}>₵{parseFloat(item.price).toFixed(2)}</Text>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => handleAddToCart(item)}
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
  // ── Render: featured card (first result in list view) ──────────────────────
  const renderFeatured = (item: any) => (
    <TouchableOpacity
      style={styles.featCard}
      activeOpacity={0.88}
      onPress={() => handleProductPress(item)}
    >
      <Image
        source={{ uri: item.images?.[0] || 'https://via.placeholder.com/300' }}
        style={styles.featImg}
      />
      <View style={styles.featInfo}>
        <View style={styles.featBadge}><Text style={styles.featBadgeTxt}>TOP PICK</Text></View>
        <Text style={styles.featName} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.featStore} numberOfLines={1}>{item.store?.name || 'Shopyos'}</Text>
        <Text style={styles.featPrice}>₵{parseFloat(item.price).toFixed(2)}</Text>
      </View>
      <TouchableOpacity
        style={styles.featAddBtn}
        onPress={() => handleAddToCart(item)}
        disabled={addingId === item._id}
      >
        {addingId === item._id
          ? <ActivityIndicator size="small" color={C.limeText} />
          : <Ionicons name="add" size={18} color={C.limeText} />
        }
      </TouchableOpacity>
    </TouchableOpacity>
  );
  // ── Render: list card ───────────────────────────────────────────────────────
  const renderList = ({ item, index }: { item: any; index: number }) => {
    if (index === 0) return renderFeatured(item);
    return (
      <TouchableOpacity
        style={styles.listCard}
        activeOpacity={0.85}
        onPress={() => handleProductPress(item)}
      >
        <Image
          source={{ uri: item.images?.[0] || 'https://via.placeholder.com/300' }}
          style={styles.listImg}
        />
        <View style={styles.listInfo}>
          <Text style={styles.storeLbl} numberOfLines={1}>
            {item.store?.name || 'Shopyos'}
          </Text>
          <Text style={styles.productLbl} numberOfLines={2}>{item.name}</Text>
          <Text style={[styles.priceLbl, { fontSize: 14, fontFamily: 'Montserrat-Bold', color: C.lime }]}>
            ₵{parseFloat(item.price).toFixed(2)}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.listAddBtn}
          onPress={() => handleAddToCart(item)}
          disabled={addingId === item._id}
        >
          {addingId === item._id
            ? <ActivityIndicator size="small" color="#fff" />
            : <Ionicons name="add" size={16} color="#fff" />
          }
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };
  // ── Render: discovery ───────────────────────────────────────────────────────
  const renderDiscovery = () => (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.discoveryScroll}
      keyboardShouldPersistTaps="handled"
    >
      {recentSearches.length > 0 && (
        <View style={styles.discSection}>
          <View style={styles.discHeader}>
            <Text style={styles.discLabel}>Recent</Text>
            <TouchableOpacity onPress={clearRecent}>
              <Text style={styles.discClear}>Clear all</Text>
            </TouchableOpacity>
          </View>
          {recentSearches.map(term => (
            <TouchableOpacity
              key={term}
              style={styles.recentRow}
              onPress={() => { setQuery(term); inputRef.current?.focus(); }}
            >
              <View style={styles.recentIcon}>
                <Ionicons name="time-outline" size={14} color={C.navy} />
              </View>
              <Text style={styles.recentTxt}>{term}</Text>
              <Feather name="arrow-up-right" size={13} color={C.subtle} />
            </TouchableOpacity>
          ))}
        </View>
      )}
      {categories.length > 0 && (
        <>
          <View style={styles.discDivider} />
          <View style={styles.discSection}>
            <Text style={styles.discLabel}>Browse categories</Text>
            <View style={styles.catTileGrid}>
              {[...categories].sort((a, b) => a.name.localeCompare(b.name)).map((cat: any, i: number) => {
                const isOn = category === cat.name;
                const catImg = CATEGORY_IMAGES[cat.name];
                return (
                  <TouchableOpacity
                    key={cat.id || cat.name}
                    style={styles.catTile}
                    onPress={() => {
                      setCategory(isOn ? null : cat.name);
                      setQuery('');
                    }}
                  >
                    {catImg ? (
                      <View style={[
                        styles.catTileInner,
                        { backgroundColor: isOn ? C.navy : '#1E293B' }
                      ]}>
                        <Image
                          source={catImg}
                          style={styles.catTileImg}
                          resizeMode="contain"
                        />
                        <View style={styles.catTileTextWrap}>
                          <Text style={styles.catTileTxtLeft} numberOfLines={2}>
                            {cat.name}
                          </Text>
                        </View>
                      </View>
                    ) : (
                      <View style={[
                        styles.catTileFallback,
                        { backgroundColor: isOn ? C.navy : '#1E293B' }
                      ]}>
                        <Text style={[
                          styles.catTileTxtLeft,
                          { color: isOn ? '#fff' : '#E2E8F0' }
                        ]}>
                          {cat.name}
                        </Text>
                      </View>
                    )
                    }
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
  // ── Render: empty results ───────────────────────────────────────────────────
  const renderEmpty = () => (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyCircle}>
        <MaterialCommunityIcons name="archive-search-outline" size={44} color={C.navy} />
      </View>
      <Text style={styles.emptyTitle}>Nothing found</Text>
      <Text style={styles.emptyBody}>Try different keywords or remove active filters.</Text>
      <TouchableOpacity
        style={styles.resetBtn}
        onPress={() => { setQuery(''); setCategory(null); setSortBy('newest'); }}
      >
        <Text style={styles.resetBtnTxt}>Reset filters</Text>
      </TouchableOpacity>
    </View>
  );
  // ── Root ────────────────────────────────────────────────────────────────────
  return (
    <Pressable onPress={() => { Keyboard.dismiss(); setSortOpen(false); }} style={{ flex: 1 }}>
      <View style={styles.root}>
        <StatusBar style="light" />
        {/* ── Premium header ──────────────────────────────────────────────── */}
        <LinearGradient colors={[C.navy, C.navyMid]} style={styles.hdrGradient}>
          {/* Radial lime glow — decorative */}
          <View style={styles.hdrGlow} pointerEvents="none" />
          <SafeAreaView edges={['top', 'left', 'right']}>
            <View style={styles.hdrInner}>
              {/* Top row */}
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
                  <TouchableOpacity
                    style={styles.hdrBtn}
                    onPress={() => safePush('/cart')}
                  >
                    <Feather name="shopping-bag" size={16} color="rgba(255,255,255,0.8)" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.hdrBtn}
                    onPress={() => safePush('/filter')}
                  >
                    <Feather name="sliders" size={16} color="rgba(255,255,255,0.8)" />
                  </TouchableOpacity>
                </View>
              </View>
              {/* Search pill */}
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
                  <TouchableOpacity
                    style={styles.clearBtn}
                    onPress={() => { setQuery(''); setCategory(null); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close" size={10} color="#fff" />
                  </TouchableOpacity>
                ) : (
                  <View style={styles.kbdHint}>
                    <Text style={styles.kbdHintTxt}>⌘K</Text>
                  </View>
                )}
              </View>
            </View>
          </SafeAreaView>
          {/* White arc cutout — creates the premium curved bottom */}
          <View style={styles.hdrArc} />
        </LinearGradient>
        {/* ── Body ────────────────────────────────────────────────────────── */}
        {(loading && products.length === 0) ? (
          <View style={{ flex: 1 }}><SearchSkeleton /></View>
        ) : (
          <View style={{
            flex: 1,
            backgroundColor: '#ffffff',
            zIndex: 10
          }}>
            {/* Discovery: no active search and no category selected */}
            {!isActive && !category ? (
              renderDiscovery()
            ) : (
              <View style={{ flex: 1 }}>
                {/* Category chip strip — only when browsing (not text search) */}
                {!isActive && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ flexGrow: 0, flexShrink: 0 }}
                    contentContainerStyle={styles.chipStrip}
                  >
                    <TouchableOpacity
                      style={[styles.chip, !category && styles.chipOn]}
                      onPress={() => setCategory(null)}
                    >
                      <Text style={[styles.chipTxt, !category && styles.chipTxtOn]}>All</Text>
                    </TouchableOpacity>
                    {categories.map((cat: any) => {
                      const on = category === cat.name;
                      return (
                        <TouchableOpacity
                          key={cat.id || cat.name}
                          style={[styles.chip, on && styles.chipOn]}
                          onPress={() => setCategory(on ? null : cat.name)}
                        >
                          <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>
                            {cat.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}
                {/* Toolbar */}
                <View style={styles.toolbar}>
                  <Text style={styles.resultCount}>
                    {products.length}{' '}
                    {isActive ? 'result' : 'product'}
                    {products.length !== 1 ? 's' : ''}
                  </Text>
                  <View style={styles.toolbarRight}>
                    {/* Grid / List toggle */}
                    <View style={styles.viewToggle}>
                      <TouchableOpacity
                        style={[styles.vtBtn, viewMode === 'grid' && styles.vtBtnOn]}
                        onPress={() => setViewMode('grid')}
                      >
                        <MaterialCommunityIcons
                          name="view-grid-outline"
                          size={15}
                          color={viewMode === 'grid' ? '#fff' : C.muted}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.vtBtn, viewMode === 'list' && styles.vtBtnOn]}
                        onPress={() => setViewMode('list')}
                      >
                        <MaterialCommunityIcons
                          name="view-list-outline"
                          size={15}
                          color={viewMode === 'list' ? '#fff' : C.muted}
                        />
                      </TouchableOpacity>
                    </View>
                    {/* Sort */}
                    <TouchableOpacity
                      style={styles.sortBtn}
                      onPress={() => setSortOpen(v => !v)}
                    >
                      <Ionicons name="funnel-outline" size={11} color={C.navy} />
                      <Text style={styles.sortBtnTxt}>
                        {SORT_OPTIONS.find(s => s.value === sortBy)?.label ?? 'Sort'}
                      </Text>
                      <Ionicons
                        name={sortOpen ? 'chevron-up' : 'chevron-down'}
                        size={11}
                        color={C.navy}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
                {/* Sort dropdown */}
                {sortOpen && (
                  <Animated.View
                    style={[
                      styles.sortDropdown,
                      {
                        opacity: slideAnim,
                        transform: [{
                          translateY: slideAnim.interpolate({
                            inputRange: [0, 1], outputRange: [-8, 0],
                          }),
                        }],
                      },
                    ]}
                  >
                    {SORT_OPTIONS.map(opt => (
                      <TouchableOpacity
                        key={opt.value}
                        style={[
                          styles.sortOption,
                          sortBy === opt.value && styles.sortOptionOn,
                        ]}
                        onPress={() => { setSortBy(opt.value); setSortOpen(false); }}
                      >
                        <Text style={[
                          styles.sortOptionTxt,
                          sortBy === opt.value && { color: C.navy },
                        ]}>
                          {opt.label}
                        </Text>
                        {sortBy === opt.value && (
                          <Ionicons name="checkmark" size={14} color={C.lime} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </Animated.View>
                )}
                {/* Product list */}
                <Animated.View style={{
                  flex: 1,
                  opacity: loading ? 0.6 : fadeAnim
                }}>
                  {viewMode === 'grid' ? (
                    <FlatList
                      key="grid"
                      data={products}
                      keyExtractor={item => item._id}
                      numColumns={2}
                      contentContainerStyle={styles.gridContent}
                      columnWrapperStyle={styles.gridRow}
                      showsVerticalScrollIndicator={false}
                      keyboardShouldPersistTaps="handled"
                      renderItem={renderGrid}
                      ListHeaderComponent={renderStores}
                      ListEmptyComponent={renderEmpty}
                    />
                  ) : (
                    <FlatList
                      key="list"
                      data={products}
                      keyExtractor={item => item._id}
                      contentContainerStyle={styles.listContent}
                      showsVerticalScrollIndicator={false}
                      keyboardShouldPersistTaps="handled"
                      renderItem={renderList}
                      ListHeaderComponent={renderStores}
                      ListEmptyComponent={renderEmpty}
                    />
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
        onComplete={handleOnboardingComplete}
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
    height: 96,
    borderRadius: 16,
    elevation: 4,
    shadowColor: C2.navy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  catTileInner: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  catTileImg: {
    position: 'absolute',
    right: -10,
    bottom: -10,
    width: '65%',
    height: '90%',
    opacity: 0.95,
  },
  catTileTextWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: '40%',
    paddingTop: 16,
    paddingLeft: 16,
  },
  catTileTxtLeft: {
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
    color: '#fff',
    lineHeight: 18,
  },
  catTileFallback: {
    flex: 1,
    paddingTop: 16,
    paddingLeft: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
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
});