import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  RefreshControl, Dimensions, ScrollView, ActivityIndicator,
} from 'react-native';
import AppImage from '@/components/AppImage';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import BottomNav from '@/components/BottomNav';
import { useRouter } from 'expo-router';
import { safePush } from '@/lib/navigation';
import * as Location from 'expo-location';
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
import { useOnboarding } from '@/context/OnboardingContext';
import { SpotlightTour } from '@/components/ui/SpotlightTour';
import { useAddFavorite, useFavorites, useRemoveFavorite } from '@/hooks/useFavorites';
import { SnapsRow } from '@/components/SnapsRow';
// Home section components
import { HeroCarousel, HeroAd } from '@/components/home/HeroCarousel';
import { QuickActions, QuickAction } from '@/components/home/QuickActions';
import { FlashSaleSection } from '@/components/home/FlashSaleSection';
import { MidFeedBanner } from '@/components/home/MidFeedBanner';
import { ProductRow } from '@/components/home/ProductRow';
import { ProductGrid } from '@/components/home/ProductGrid';
import { SponsoredAdsRow } from '@/components/home/SponsoredAdsRow';
import { RecommendedSection } from '@/components/home/RecommendedSection';

const { width } = Dimensions.get('window');

// Show sponsored section when more than this many campaigns are active
const AD_THRESHOLD = 0;


const C = {
  pageBg: '#FFFFFF',
  navy: '#0C1559',
  navyMid: '#1e3a8a',
  lime: '#84cc16',
  limeText: '#1a2e00',
  muted: '#64748B',
};

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

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const MIN_SKELETON_MS = 450;

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [locationText, setLocationText] = useState('Locating…');
  const [userName, setUserName] = useState('');
  const [showStartupSkeleton, setShowStartupSkeleton] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [favoriteBusyId, setFavoriteBusyId] = useState<string | null>(null);

  // ── Remote data ───────────────────────────────────────────────────────────────
  const { data: unreadCount = 0 } = useBuyerUnreadCount();
  const { items: cartItems, addToCart } = useCart();
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

  // ── Onboarding refs ────────────────────────────────────────────────────────────
  const scrollY = useRef(new Animated.Value(0)).current;
  const [layouts, setLayouts] = useState<any>({});
  const refGreeting = useRef<View>(null);
  const refActions = useRef<View>(null);
const refChat = useRef<View>(null);
  const { startTour, markCompleted, isCompleted, isTourActive, activeScreen, user, isLoading: onboardingLoading } = useOnboarding();

  const measureElement = (ref: any, key: string) => {
    if (ref.current) {
      ref.current.measureInWindow((x: number, y: number, w: number, h: number) => {
        setLayouts((prev: any) => ({ ...prev, [key]: { x, y, width: w, height: h } }));
      });
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      measureElement(refGreeting, 'greeting');
      measureElement(refActions, 'actions');
measureElement(refChat, 'chat');
      const shouldAutoStart = async () => {
        if (onboardingLoading || !user) return;
        if (isCompleted('home')) return;
        const createdDate = new Date(user.created_at || Date.now());
        if (createdDate < new Date('2026-04-01') && (user.role === 'buyer' || user.role === 'customer')) {
          markCompleted('home'); return;
        }
        startTour('home');
      };
      shouldAutoStart();
    }, 1500);
    return () => clearTimeout(timer);
  }, [markCompleted, onboardingLoading, startTour, user, isCompleted]);

  const onboardingSteps = [
    { targetLayout: layouts.greeting, title: 'Welcome to Shopyos!', description: "We've personalized your dashboard based on your location and preferences." },
    { targetLayout: layouts.actions, title: 'Easy Access', description: 'Quickly check your cart or see notifications from your favourite stores.' },
{ targetLayout: layouts.chat, title: 'Real-time Chat', description: 'Have a question? Chat with sellers instantly to get more details or negotiate.' },
  ].filter(s => !!s.targetLayout);

  // ── User name ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const name = profileData?.name || profileData?.email || user?.name || user?.email || '';
    setUserName(name.split(' ')[0]);
  }, [profileData, user]);

// ── Location ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const cachedTxt = await storage.getItem('CACHED_LOCATION_TEXT');
      const cachedCoordsStr = await storage.getItem('CACHED_LOCATION_COORDS');
      if (cachedTxt) setLocationText(cachedTxt);

      let liveCoords: { latitude: number; longitude: number } | null = null;
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        try {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          liveCoords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        } catch { }
      }
      if (!liveCoords && profileData?.city) {
        const txt = profileData.city + (profileData.country ? `, ${profileData.country}` : '');
        setLocationText(txt);
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
          } catch { }
        } else shouldGeocode = true;
        if (shouldGeocode) {
          try {
            const [info] = await Location.reverseGeocodeAsync(liveCoords);
            if (info) {
              const txt = `${info.city ?? info.region ?? info.country ?? 'Unknown'}${info.country ? `, ${info.country}` : ''}`;
              setLocationText(txt);
              await storage.setItem('CACHED_LOCATION_TEXT', txt);
              await storage.setItem('CACHED_LOCATION_COORDS', JSON.stringify(liveCoords));
            }
          } catch { }
        }
      } else if (!cachedTxt) setLocationText('Location unavailable');
    })();
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
        price: parseFloat(item.price) || 0,
        image: item.images?.[0] || 'https://via.placeholder.com/300',
        storeId: item.store_id || item.business_id || item.store?._id || item.store?.id,
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
        <LinearGradient colors={[C.navy, C.navyMid]} style={[S.header, { paddingTop: insets.top + 10 }]}>
          <View style={S.hdrGlow1} pointerEvents="none" />
          <View style={S.hdrGlow2} pointerEvents="none" />
          <View style={S.headerWatermark} pointerEvents="none">
            <AppImage source={require('../assets/images/splash-icon.png')} style={S.headerWatermarkImg} />
          </View>

          <View
            style={S.headerInner}
            ref={refGreeting}
            onLayout={() => measureElement(refGreeting, 'greeting')}
          >
            <TouchableOpacity style={S.locationRow} onPress={() => safePush('/settings')}>
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
              <View
                style={S.headerActions}
                ref={refActions}
                onLayout={() => measureElement(refActions, 'actions')}
              >
                <TouchableOpacity style={S.headerBtn} onPress={() => safePush('/cart')}>
                  <Ionicons name="bag-outline" size={18} color="rgba(255,255,255,0.85)" />
                  {cartCount > 0 && (
                    <View style={S.hdrBadge}>
                      <Text style={S.hdrBadgeTxt}>{cartCount > 99 ? '99+' : cartCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={S.headerBtn} onPress={() => safePush('/notification')}>
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

        {/* ── Scrollable body ──────────────────────────────────────────────── */}
        <Animated.ScrollView
          contentContainerStyle={S.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
              tintColor={C.navy} colors={[C.navy]} />
          }
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            {
              useNativeDriver: true,
              // Auto-fetch next Explore page when user is 500px from bottom
              listener: (e: any) => {
                const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
                const nearBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 500;
                if (nearBottom && hasMoreExplore && !fetchingMoreExplore) fetchMoreExplore();
              },
            }
          )}
          scrollEventThrottle={16}
        >
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

          {/* Flash sales — admin-curated, real countdown from ends_at */}
          <FlashSaleSection
            products={flashActive ? flashProducts : dealsProducts}
            loading={loadingFlash || loadingDeals}
            onPressProduct={goToDetails}
            onSeeAll={() => router.push('/deals' as any)}
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

          {/* Explore — 2-col infinite grid (auto-loads via onScroll) */}
          <ProductGrid
            title="Explore"
            products={exploreProducts}
            loading={loadingExplore}
            onPressProduct={goToDetails}
            onAddToCart={handleAddToCart}
            addingId={addingId}
            favoriteIds={favoriteIds}
            onToggleFavorite={handleToggleFavorite}
            favoriteBusyId={favoriteBusyId}
            onSeeAll={() => router.push('/search' as any)}
            getStoreName={getStoreDisplayName}
            injectedAds={isManyAds ? sponsoredCampaigns : []}
            emptyTitle="Nothing to explore yet"
            emptyIcon="grid-outline"
          />

          {/* Subtle auto-load spinner at the very bottom */}
          {fetchingMoreExplore && (
            <ActivityIndicator color={C.navy} size="small" style={S.loadMoreSpinner} />
          )}
        </Animated.ScrollView>

        {/* ── Chat FAB ─────────────────────────────────────────────────────── */}
        <TouchableOpacity
          style={S.chatFab}
          activeOpacity={0.85}
          ref={refChat}
          onLayout={() => measureElement(refChat, 'chat')}
          onPress={() => router.push('/chat' as any)}
        >
          <LinearGradient colors={[C.navy, C.navyMid]} style={S.chatFabGrad}>
            <MaterialCommunityIcons name="chat-processing" size={26} color="#fff" />
            {unreadCount > 0 && (
              <View style={S.chatFabBadge}>
                <Text style={S.chatFabBadgeTxt}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <BottomNav />
      </SafeAreaView>

      <SpotlightTour
        visible={isTourActive && activeScreen === 'home'}
        steps={onboardingSteps}
        onComplete={() => markCompleted('home')}
      />
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
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

  // Chat FAB
  chatFab: {
    position: 'absolute', bottom: 140, right: 18,
    width: 58, height: 58, borderRadius: 29,
    elevation: 8, shadowColor: C.navy,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
    zIndex: 100,
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
    borderColor: 'rgba(12,21,89,0.1)',
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  adPlaceholderContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  adPlaceholderBadge: {
    backgroundColor: 'rgba(12,21,89,0.08)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  adPlaceholderBadgeTxt: { fontSize: 9, fontFamily: 'Montserrat-Bold', color: C.muted, letterSpacing: 0.5 },
  adPlaceholderTitle: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: C.muted, marginBottom: 6 },
  adPlaceholderSub: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: 'rgba(100,116,139,0.7)' },
  adPlaceholderDots: {
    flexDirection: 'row', justifyContent: 'center', gap: 6,
    position: 'absolute', bottom: 10, left: 0, right: 0,
  },
  adPlaceholderDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(12,21,89,0.15)' },
  adPlaceholderDotActive: { width: 24, height: 6, borderRadius: 3, backgroundColor: 'rgba(12,21,89,0.25)' },

  // Sponsored ads row placeholder
  sponsoredPlaceholderWrap: { marginBottom: 12 },
  sponsoredPlaceholderHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, marginBottom: 10,
  },
  sponsoredPlaceholderHeaderTxt: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
  sponsoredPlaceholderDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(12,21,89,0.15)' },
  sponsoredPlaceholderList: { paddingHorizontal: 16, gap: 12 },
  sponsoredPlaceholderCard: {
    width: width * 0.7, height: 130, borderRadius: 18,
    borderWidth: 1, borderColor: 'rgba(12,21,89,0.1)', borderStyle: 'dashed',
    overflow: 'hidden', justifyContent: 'flex-end', padding: 14,
  },
  sponsoredPlaceholderAdTag: {
    backgroundColor: 'rgba(12,21,89,0.08)', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 3,
    alignSelf: 'flex-start', marginBottom: 5,
    borderWidth: 1, borderColor: 'rgba(12,21,89,0.08)',
  },
  sponsoredPlaceholderAdTagTxt: { fontSize: 9, fontFamily: 'Montserrat-Bold', color: C.muted, letterSpacing: 0.5 },
  sponsoredPlaceholderCardTxt: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: C.muted },
});
