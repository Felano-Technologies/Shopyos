import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  RefreshControl, Dimensions, ScrollView, ActivityIndicator,
} from 'react-native';
import AppImage from '@/components/AppImage';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { useRouter } from 'expo-router';
import { safePush } from '@/lib/navigation';
import * as Location from 'expo-location';
import { requestForegroundLocationWithDisclosure } from '@/src/utils/location';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useProducts, useInfiniteProducts } from '@/hooks/useProducts';
import { useFlashSales } from '@/hooks/useFlashSales';
import { HomeSkeleton } from '@/components/skeletons/HomeSkeleton';
import { recordAdClick, storage, CustomInAppToast } from '@/services/api';
import { useActiveBanners } from '@/hooks/useBanners';
import { useProfile } from '@/hooks/useProfile';
import { useBuyerUnreadCount } from '@/hooks/useChat';
import { useCart } from '@/store/cartStore';
import { useUnreadNotificationCount } from '@/hooks/useNotifications';
import { useDailyCheckin } from '@/hooks/useDailyCheckin';
import { useOnboarding } from '@/context/OnboardingContext';
import WelcomeCard from '@/components/WelcomeCard';
import { useAddFavorite, useFavorites, useRemoveFavorite } from '@/hooks/useFavorites';
import { SnapsRow } from '@/components/SnapsRow';
// Home section components
import { HeroCarousel, HeroAd } from '@/components/home/HeroCarousel';
import { QuickActions, QuickAction } from '@/components/home/QuickActions';
import { FlashSaleSection } from '@/components/home/FlashSaleSection';
import { MidFeedBanner } from '@/components/home/MidFeedBanner';
import { ProductRow } from '@/components/home/ProductRow';
import { ProductGrid, ProductCard, AdCard, buildGridItems, GridListItem } from '@/components/home/ProductGrid';
import { SectionHeader } from '@/components/home/SectionHeader';
import { SponsoredAdsRow } from '@/components/home/SponsoredAdsRow';
import { RecommendedSection } from '@/components/home/RecommendedSection';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';

const { width } = Dimensions.get('window');

// Show sponsored section when more than this many campaigns are active
const AD_THRESHOLD = 0;

type LegacyPalette = { pageBg: string; navy: string; navyMid: string; lime: string; limeText: string; muted: string; body: string; border: string };

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function getStoreDisplayName(item: any) {
  return (
    item?.store?.store_name || item?.store?.businessName || item?.store?.name ||
    item?.business?.businessName || item?.business?.store_name || item?.business?.name ||
    item?.store_name || item?.businessName || item?.sellerName || 'Shopyos'
  );
}

async function updateLocationDisplay(profileData: any, setLocation: (txt: string) => void) {
  const cachedTxt = await storage.getItem('CACHED_LOCATION_TEXT');
  const cachedCoordsStr = await storage.getItem('CACHED_LOCATION_COORDS');
  if (cachedTxt) setLocation(cachedTxt);

  let liveCoords: { latitude: number; longitude: number } | null = null;
  const { status } = await requestForegroundLocationWithDisclosure();
  if (status === 'granted') {
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      liveCoords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
    } catch (e) {
      console.warn('Failed to get location:', e);
    }
  }

  if (!liveCoords && profileData?.city) {
    const txt = profileData.city + (profileData.country ? `, ${profileData.country}` : '');
    setLocation(txt);
    await storage.setItem('CACHED_LOCATION_TEXT', txt);
    return;
  }

  if (liveCoords) {
    let shouldGeocode = !cachedTxt;
    if (cachedCoordsStr) {
      try {
        const cc = JSON.parse(cachedCoordsStr);
        if (Math.abs(cc.latitude - liveCoords.latitude) > 0.005 || Math.abs(cc.longitude - liveCoords.longitude) > 0.005)
          shouldGeocode = true;
      } catch (e) {
        console.warn('Failed to parse cached coords:', e);
        shouldGeocode = true;
      }
    }
    if (shouldGeocode) {
      try {
        const [info] = await Location.reverseGeocodeAsync(liveCoords);
        if (info) {
          const cityName = info.city ?? info.region ?? info.country ?? 'Unknown';
          const txt = `${cityName}${info.country ? `, ${info.country}` : ''}`;
          setLocation(txt);
          await storage.setItem('CACHED_LOCATION_TEXT', txt);
          await storage.setItem('CACHED_LOCATION_COORDS', JSON.stringify(liveCoords));
        }
      } catch (e) {
        console.warn('Failed to reverse geocode:', e);
      }
    }
  } else if (!cachedTxt) setLocation('Location unavailable');
}


export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const C = useMemo<LegacyPalette>(() => ({
    pageBg: colors.background,
    navy: colors.primary,
    navyMid: colors.primaryMid,
    lime: colors.accent,
    limeText: colors.accentText,
    muted: colors.textSecondary,
    body: colors.text,
    border: colors.border,
  }), [colors]);
  const S = useMemo(() => getS(C), [C]);
  const MIN_SKELETON_MS = 450;

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [locationText, setLocationText] = useState('Locating…');
  const [userName, setUserName] = useState('');
  const [showStartupSkeleton, setShowStartupSkeleton] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [favoriteBusyId, setFavoriteBusyId] = useState<string | null>(null);

  // Daily check-in loyalty reward (once per calendar day)
  useDailyCheckin();

  // ── Remote data ───────────────────────────────────────────────────────────────
  const { data: unreadCount = 0 } = useBuyerUnreadCount();
  const cartItems = useCart((s) => s.items);
  const addToCart = useCart((s) => s.addToCart);
  const cartCount = cartItems.reduce((sum: number, item: any) => sum + item.quantity, 0);
  const { data: favoriteProducts = [] } = useFavorites();
  const addFavoriteMutation = useAddFavorite();
  const removeFavoriteMutation = useRemoveFavorite();
  const favoriteIds = useMemo(
    () => new Set<string>((favoriteProducts || []).map((p: any) => String(p.id || p._id || p.productId))),
    [favoriteProducts]
  );
  const { data: profileData } = useProfile();
  const { data: bannersData } = useActiveBanners();
const { data: notifData } = useUnreadNotificationCount(false);
  const unreadNotifCount = notifData?.unreadCount ?? 0;
  // ── Product queries ────────────────────────────────────────────────────────────
  const { data: recentData, isLoading: loadingRecent, refetch: refetchRecent, isRefetching: refetchingRecent } =
    useProducts({ sortBy: 'newest' }, 10);
  const { data: trendingData, isLoading: loadingTrending, refetch: refetchTrending, isRefetching: refetchingTrending } =
    useProducts({ sortBy: 'popular' }, 10);
  const { data: dealsData, isLoading: loadingDeals, refetch: refetchDeals, isRefetching: refetchingDeals } =
    useProducts({ sortBy: 'price_asc' }, 20);
  const {
    data: exploreData, isLoading: loadingExplore, refetch: refetchExplore,
    isRefetching: refetchingExplore, fetchNextPage: fetchMoreExplore,
    hasNextPage: hasMoreExplore, isFetchingNextPage: fetchingMoreExplore,
  } = useInfiniteProducts({}, 24);

  const loading = loadingRecent || loadingDeals || loadingTrending || loadingExplore;
  const refreshing = refetchingRecent || refetchingDeals || refetchingTrending || refetchingExplore;

  const recentProducts = useMemo(() => recentData?.success ? recentData.products : [], [recentData]);
  const trendingProducts = trendingData?.success ? trendingData.products : [];
  const dealsProducts = dealsData?.success ? dealsData.products : [];
  const exploreProducts = exploreData?.pages?.flatMap((p: any) => p.products || []) || [];

  // ── Flash sales (admin-controlled, real-time) ─────────────────────────────────
  const { active: flashActive, sale: flashSale, products: flashProducts, loading: loadingFlash } = useFlashSales();

  // ── Campaign / ad logic ───────────────────────────────────────────────────────
  const activeCampaigns = useMemo(
    () => (bannersData?.banners || []).filter((b: any) => b.status === 'Active'),
    [bannersData]
  );
  const isManyAds = activeCampaigns.length > AD_THRESHOLD;
  const sponsoredCampaigns = activeCampaigns.slice(0, 8);

  // Old spotlight tour removed — the once-ever <WelcomeCard /> replaces it
  const scrollY = useRef(new Animated.Value(0)).current;
  const { user } = useOnboarding();

  // ── User name ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const name = profileData?.name || profileData?.email || user?.name || user?.email || '';
    setUserName(name.split(' ')[0]);
  }, [profileData, user]);

// ── Location ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    updateLocationDisplay(profileData, setLocationText);
  }, [profileData]);

  // ── Handlers ───────────────────────────────────────────────────────────────────
  const onRefresh = async () =>
    Promise.all([refetchRecent(), refetchDeals(), refetchTrending(), refetchExplore()]);

  const goToDetails = useCallback((item: any) =>
    safePush('/product/details', {
      id: item._id, title: item.name, price: item.price,
      category: item.category, image: item.images?.[0] || '', description: item.description,
    }), []);

  const handleAddToCart = useCallback(async (item: any) => {
    setAddingId(item._id);
    try {
      addToCart({
        id: item._id, title: item.name, category: item.category || 'General',
        price: Number.parseFloat(item.price) || 0,
        image: item.images?.[0] || 'https://via.placeholder.com/300',
        storeId: item.store_id || item.business_id || item.store?._id || item.store?.id,
        storeName: getStoreDisplayName(item),
        storeLogo: item.store?.logo_url || item.business?.logo_url || item.store?.logo,
      });
      CustomInAppToast.show({ type: 'success', title: 'Added to cart', message: item.name });
    } catch {
      CustomInAppToast.show({ type: 'error', title: 'Could not add to cart', message: 'Please try again later' });
    } finally {
      setAddingId(null);
    }
  }, [addToCart]);

  const handleToggleFavorite = useCallback((item: any) => {
    const productId = String(item._id || item.id || '');
    if (!productId || favoriteBusyId === productId) return;
    setFavoriteBusyId(productId);
    const onSettled = () => setFavoriteBusyId(null);
    if (favoriteIds.has(productId)) {
      removeFavoriteMutation.mutate(productId, { onSettled });
      return;
    }
    addFavoriteMutation.mutate(productId, {
      onSuccess: () => CustomInAppToast.show({ type: 'success', title: 'Added to favourites', message: item.name || '' }),
      onSettled,
    });
  }, [favoriteBusyId, favoriteIds, removeFavoriteMutation, addFavoriteMutation]);

  const handleAdPress = useCallback((ad: HeroAd) => {
    recordAdClick(ad.id).catch(() => {});
    if (ad.product?._id) router.push({ pathname: '/product/details', params: { id: ad.product._id } });
    else if (ad.store_id) router.push({ pathname: '/stores/details', params: { id: ad.store_id } } as any);
    else if (ad.dest) router.push(ad.dest as any);
  }, [router]);

  const handleSponsoredPress = useCallback((c: any) => {
    recordAdClick(c.id).catch(() => {});
    if (c.product?._id) router.push({ pathname: '/product/details', params: { id: c.product._id } });
    else if (c.store_id) router.push({ pathname: '/stores/details', params: { id: c.store_id } } as any);
  }, [router]);

  // ── Quick actions (3 only — avoids duplicating bottom nav or the Chat FAB) ──
  const quickActions: QuickAction[] = [
    { icon: 'flash-outline', label: 'Deals', onPress: () => safePush('/deals'), color: '#EF4444', bg: '#FEF2F2' },
    { icon: 'star-outline', label: 'For You', onPress: () => safePush('/for-you'), color: '#0EA5E9', bg: '#F0F9FF' },
    { icon: 'sparkles-outline', label: 'New In', onPress: () => safePush('/recent'), color: '#D97706', bg: '#FFFBEB' },
  ];

  // ── Virtualized Explore feed ────────────────────────────────────────────────
  // The FlatList is the screen's scroll container; everything above Explore is
  // its header, so off-screen product cards get recycled instead of piling up.
  const exploreItems = useMemo<GridListItem[]>(
    () => buildGridItems(exploreProducts, isManyAds ? sponsoredCampaigns : []),
    [exploreProducts, isManyAds, sponsoredCampaigns]
  );

  const renderExploreItem = useCallback(({ item }: { item: GridListItem }) => (
    <View style={S.exploreCell}>
      {item.type === 'ad' ? (
        <AdCard ad={item.data} />
      ) : (
        <ProductCard
          item={item.data}
          onPressProduct={goToDetails}
          onAddToCart={handleAddToCart}
          addingId={addingId}
          favoriteIds={favoriteIds}
          onToggleFavorite={handleToggleFavorite}
          favoriteBusyId={favoriteBusyId}
          storeName={getStoreDisplayName}
        />
      )}
    </View>
  ), [goToDetails, handleAddToCart, addingId, favoriteIds, handleToggleFavorite, favoriteBusyId]);

  const exploreKeyExtractor = useCallback((item: GridListItem, idx: number) =>
    item.type === 'ad' ? item.key : `${item.data._id || item.data.id || 'p'}-${idx}`, []);

  // ── Startup skeleton ───────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setShowStartupSkeleton(false), MIN_SKELETON_MS);
    return () => clearTimeout(t);
  }, []);

  const isInitialLoading =
    loading &&
    recentProducts.length === 0 && dealsProducts.length === 0 &&
    trendingProducts.length === 0 && exploreProducts.length === 0;

  if (showStartupSkeleton || isInitialLoading) {
    return (
      <View style={S.root}>
        <StatusBar style="light" />
        <SafeAreaView style={{ flex: 1 }} edges={['left', 'right']}>
          <HomeSkeleton />
        </SafeAreaView>
      </View>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────────
  return (
    <View style={S.root}>
      <StatusBar style="light" />
      <SafeAreaView style={{ flex: 1 }} edges={['left', 'right']}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <LinearGradient colors={colors.headerGradient} style={[S.header, { paddingTop: insets.top + 10 }]}>
          <View style={S.hdrGlow1} pointerEvents="none" />
          <View style={S.hdrGlow2} pointerEvents="none" />
          <View style={S.headerWatermark} pointerEvents="none">
            <AppImage source={require('../assets/images/splash-icon.png')} style={S.headerWatermarkImg} />
          </View>

          <View style={S.headerInner}>
            <TouchableOpacity accessibilityLabel="Select delivery location" accessibilityRole="button" style={S.locationRow} onPress={() => safePush('/settings')}>
              <Ionicons name="location-sharp" size={13} color="rgba(255,255,255,0.55)" />
              <Text style={S.locationTxt} numberOfLines={1}>{locationText}</Text>
              <Ionicons name="chevron-down" size={12} color="rgba(255,255,255,0.45)" />
            </TouchableOpacity>

            <View style={S.headerMainRow}>
              <Text style={S.greeting} numberOfLines={1}>
                {getGreeting()}
                {userName
                  ? <Text>{', '}<Text style={{ color: C.lime }}>{userName}</Text></Text>
                  : null}
                {' 👋'}
              </Text>
              <View style={S.headerActions}>
                <TouchableOpacity accessibilityLabel="Open cart" accessibilityRole="button" style={S.headerBtn} onPress={() => safePush('/cart')}>
                  <Ionicons name="bag-outline" size={18} color="rgba(255,255,255,0.85)" />
                  {cartCount > 0 && (
                    <View style={S.hdrBadge}>
                      <Text style={S.hdrBadgeTxt}>{cartCount > 99 ? '99+' : cartCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity accessibilityLabel="Open notifications" accessibilityRole="button" style={S.headerBtn} onPress={() => safePush('/notification')}>
                  <Ionicons name="notifications-outline" size={18} color="rgba(255,255,255,0.85)" />
                  {unreadNotifCount > 0 && (
                    <View style={S.hdrBadge}>
                      <Text style={S.hdrBadgeTxt}>{unreadNotifCount > 99 ? '99+' : unreadNotifCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
          <View style={S.headerArc} />
        </LinearGradient>

        {/* ── Scrollable body — virtualized: the Explore grid is the list, ──
            ── everything above it is the header, so cards get recycled ────── */}
        <Animated.FlatList
          data={exploreItems}
          renderItem={renderExploreItem}
          keyExtractor={exploreKeyExtractor}
          numColumns={2}
          columnWrapperStyle={S.exploreRow}
          contentContainerStyle={S.scrollContent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={6}
          maxToRenderPerBatch={8}
          windowSize={7}
          removeClippedSubviews
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
              tintColor={C.navy} colors={[C.navy]} />
          }
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
          onEndReached={() => { if (hasMoreExplore && !fetchingMoreExplore) fetchMoreExplore(); }}
          onEndReachedThreshold={0.6}
          ListFooterComponent={fetchingMoreExplore
            ? <ActivityIndicator color={C.navy} size="small" style={S.loadMoreSpinner} />
            : null}
          ListEmptyComponent={loadingExplore ? null : (
            <View style={S.exploreEmpty}>
              <Ionicons name="grid-outline" size={28} color={C.navyMid} />
              <Text style={S.exploreEmptyTxt}>Nothing to explore yet</Text>
            </View>
          )}
          ListHeaderComponent={
            <View>
          {/* Stories row */}
          <SnapsRow />

          {/* Full-bleed hero banner carousel — placeholder when no campaigns are live */}
          {activeCampaigns.length > 0 ? (
            <HeroCarousel ads={activeCampaigns as HeroAd[]} onAdPress={handleAdPress} />
          ) : (
            <View style={S.adPlaceholder}>
              <LinearGradient
                colors={['rgba(12,21,89,0.05)', 'rgba(12,21,89,0.02)']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={S.adPlaceholderContent}>
                <View style={S.adPlaceholderBadge}>
                  <Text style={S.adPlaceholderBadgeTxt}>ADS</Text>
                </View>
                <Text style={S.adPlaceholderTitle}>Your campaign here</Text>
                <Text style={S.adPlaceholderSub}>Promote your store to thousands of buyers →</Text>
              </View>
              <View style={S.adPlaceholderDots}>
                {[0, 1, 2].map(i => (
                  <View key={i} style={[S.adPlaceholderDot, i === 0 && S.adPlaceholderDotActive]} />
                ))}
              </View>
            </View>
          )}

          {/* Quick actions: Categories / Orders / Wishlist / Stores */}
          <QuickActions actions={quickActions} />

          {/* Flash sales — admin-curated, real countdown from ends_at.
              Falls back to regular deals as filler when there's no active
              sale, so "See All" must not silently open /deals as if it were
              flash-sale content — tell the buyer there's no sale instead. */}
          <FlashSaleSection
            products={flashActive ? flashProducts : dealsProducts}
            loading={loadingFlash || loadingDeals}
            onPressProduct={goToDetails}
            onSeeAll={() => {
              if (!flashActive) {
                CustomInAppToast.show({ type: 'info', title: 'No Active Flash Sale', message: 'There is no flash sale running right now. Check back later!' });
                return;
              }
              router.push('/deals' as any);
            }}
            endsAt={flashSale?.endsAt}
            saleTitle={flashSale?.title}
          />

          {/* Recently Added — horizontal scroll */}
          <ProductRow
            title="Recently Added"
            products={recentProducts}
            loading={loadingRecent}
            onPressProduct={goToDetails}
            onSeeAll={() => router.push('/recent' as any)}
            getStoreName={getStoreDisplayName}
          />

          {/* Mid-feed promo banner (Deals theme) */}
          <MidFeedBanner variant="deals" onPress={() => router.push('/deals' as any)} />

          {/* Sponsored ads row — placeholder when no campaigns are live */}
          {isManyAds ? (
            <SponsoredAdsRow
              campaigns={sponsoredCampaigns}
              onPress={handleSponsoredPress}
            />
          ) : (
            <View style={S.sponsoredPlaceholderWrap}>
              <View style={S.sponsoredPlaceholderHeader}>
                <Text style={S.sponsoredPlaceholderHeaderTxt}>Sponsored</Text>
                <View style={S.sponsoredPlaceholderDot} />
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={S.sponsoredPlaceholderList}
              >
                {[0, 1, 2].map(i => (
                  <View key={i} style={S.sponsoredPlaceholderCard}>
                    <LinearGradient
                      colors={['rgba(12,21,89,0.04)', 'rgba(12,21,89,0.02)']}
                      style={StyleSheet.absoluteFill}
                    />
                    <View style={S.sponsoredPlaceholderAdTag}>
                      <Text style={S.sponsoredPlaceholderAdTagTxt}>AD</Text>
                    </View>
                    <Text style={S.sponsoredPlaceholderCardTxt}>Your campaign here</Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Hot & Trending — horizontal scroll */}
          <ProductRow
            title="Hot & Trending"
            products={trendingProducts}
            loading={loadingTrending}
            onPressProduct={goToDetails}
            onSeeAll={() => router.push('/search?sortBy=popular' as any)}
            getStoreName={getStoreDisplayName}
          />

          {/* Recommended for You — personalised or trending fallback */}
          <RecommendedSection />

          {/* Deals for You — 2-col grid, first 6 items */}
          <ProductGrid
            title="Deals for You"
            products={dealsProducts.slice(0, 6)}
            loading={loadingDeals}
            onPressProduct={goToDetails}
            onAddToCart={handleAddToCart}
            addingId={addingId}
            favoriteIds={favoriteIds}
            onToggleFavorite={handleToggleFavorite}
            favoriteBusyId={favoriteBusyId}
            onSeeAll={() => router.push('/deals' as any)}
            getStoreName={getStoreDisplayName}
            emptyTitle="No deals right now"
            emptyIcon="tag-outline"
          />

          {/* Mid-feed promo banner (Explore theme) */}
          <MidFeedBanner variant="explore" onPress={() => router.push('/search' as any)} />

          {/* Explore — the section title; the grid itself is the FlatList body */}
          <SectionHeader title="Explore" onSeeAll={() => router.push('/search' as any)} />
            </View>
          }
        />

        {/* ── Chat FAB ─────────────────────────────────────────────────────── */}
        <TouchableOpacity
          accessibilityLabel="Open chat"
          accessibilityRole="button"
          style={S.chatFab}
          activeOpacity={0.85}
          onPress={() => router.push('/chat' as any)}
        >
          <LinearGradient colors={[C.navy, C.navyMid]} style={S.chatFabGrad}>
            <MaterialCommunityIcons name="chat-processing" size={26} color="#fff" />
          </LinearGradient>
          {unreadCount > 0 && (
            <View style={S.chatFabBadge}>
              <Text style={S.chatFabBadgeTxt}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* BottomNav is rendered globally by app/_layout.tsx for /home —
            rendering it here too mounted the whole nav (badges, hooks) twice */}
      </SafeAreaView>

      {/* One-time welcome card — persisted per device AND on the user's
          profile, so it never shows again regardless of dismissal or re-login */}
      <WelcomeCard />
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const getS = (C: LegacyPalette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.pageBg },

  // Header
  header: {
    position: 'relative', paddingBottom: 28, zIndex: 10, overflow: 'hidden',
    elevation: 10, shadowColor: C.navy,
    shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16,
  },
  headerWatermark: {
    position: 'absolute', left: -30, bottom: -10,
    width: 132, height: 132, justifyContent: 'center', alignItems: 'center', opacity: 0.03,
  },
  headerWatermarkImg: { width: 100, height: 100, resizeMode: 'contain' },
  hdrGlow1: {
    position: 'absolute', top: -30, right: -30,
    width: 150, height: 150, borderRadius: 75,
    backgroundColor: 'rgba(132,204,22,0.12)',
  },
  hdrGlow2: {
    position: 'absolute', bottom: -20, left: -10,
    width: 80, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(30,58,138,0.5)',
  },
  headerInner: { paddingHorizontal: 20, paddingBottom: 6 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10 },
  locationTxt: {
    fontSize: 12, fontFamily: 'Montserrat-SemiBold',
    color: 'rgba(255,255,255,0.55)', maxWidth: width * 0.55,
  },
  headerMainRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  greeting: {
    fontSize: 15, fontFamily: 'Montserrat-Bold',
    color: '#fff', flex: 1, marginRight: 8, lineHeight: 20,
  },
  headerActions: { flexDirection: 'row', gap: 8, marginBottom: 7 },
  headerBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.11)',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.16)',
    justifyContent: 'center', alignItems: 'center', position: 'relative',
  },
  hdrBadge: {
    position: 'absolute', top: -3, right: -3,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: '#ff0101', borderWidth: 1.5, borderColor: C.navy,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3,
  },
  hdrBadgeTxt: { fontSize: 8, fontFamily: 'Montserrat-Bold', color: '#fff' },
  headerArc: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 26,
    backgroundColor: C.pageBg, borderTopLeftRadius: 26, borderTopRightRadius: 26,
  },

  // Body
  scrollContent: { paddingBottom: 110 },


  // Load-more
  loadMoreSpinner: { paddingVertical: 24 },
  // Virtualized Explore grid cells
  exploreRow: { paddingHorizontal: 14, justifyContent: 'space-between' },
  exploreCell: { width: '48.5%' },
  exploreEmpty: { alignItems: 'center', paddingVertical: 32, gap: 10 },
  exploreEmptyTxt: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: C.muted },

  // Chat FAB
  chatFab: {
    position: 'absolute', bottom: 130, right: 18,
    width: 58, height: 58, borderRadius: 29,
    elevation: 8, shadowColor: C.navy,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
    zIndex: 100, overflow: 'visible',
  },
  chatFabGrad: {
    width: '100%', height: '100%', borderRadius: 29,
    justifyContent: 'center', alignItems: 'center',
  },
  chatFabBadge: {
    position: 'absolute', top: -2, right: -2,
    minWidth: 20, height: 20, borderRadius: 10,
    backgroundColor: '#ff0101', borderWidth: 1.5, borderColor: C.navy,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4,
  },
  chatFabBadgeTxt: { color: '#fff', fontSize: 9, fontFamily: 'Montserrat-Bold' },

  // Ad campaign placeholder (shown when no live campaigns)
  adPlaceholder: {
    marginBottom: 14,
    marginHorizontal: 16,
    height: 210,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  adPlaceholderContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  adPlaceholderBadge: {
    backgroundColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  adPlaceholderBadgeTxt: { fontSize: 9, fontFamily: 'Montserrat-Bold', color: C.muted, letterSpacing: 0.5 },
  adPlaceholderTitle: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: C.muted, marginBottom: 6 },
  adPlaceholderSub: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: C.muted },
  adPlaceholderDots: {
    flexDirection: 'row', justifyContent: 'center', gap: 6,
    position: 'absolute', bottom: 10, left: 0, right: 0,
  },
  adPlaceholderDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.border },
  adPlaceholderDotActive: { width: 24, height: 6, borderRadius: 3, backgroundColor: C.navyMid },

  // Sponsored ads row placeholder
  sponsoredPlaceholderWrap: { marginBottom: 12 },
  sponsoredPlaceholderHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, marginBottom: 10,
  },
  sponsoredPlaceholderHeaderTxt: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: C.body },
  sponsoredPlaceholderDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.border },
  sponsoredPlaceholderList: { paddingHorizontal: 16, gap: 12 },
  sponsoredPlaceholderCard: {
    width: width * 0.7, height: 130, borderRadius: 18,
    borderWidth: 1, borderColor: C.border, borderStyle: 'dashed',
    overflow: 'hidden', justifyContent: 'flex-end', padding: 14,
  },
  sponsoredPlaceholderAdTag: {
    backgroundColor: C.border, borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 3,
    alignSelf: 'flex-start', marginBottom: 5,
    borderWidth: 1, borderColor: C.border,
  },
  sponsoredPlaceholderAdTagTxt: { fontSize: 9, fontFamily: 'Montserrat-Bold', color: C.muted, letterSpacing: 0.5 },
  sponsoredPlaceholderCardTxt: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: C.muted },
});
