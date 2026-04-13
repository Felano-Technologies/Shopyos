import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, Image, FlatList,
  TouchableOpacity, StyleSheet, Animated, RefreshControl,
  Dimensions, ScrollView, NativeSyntheticEvent,
  NativeScrollEvent, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import BottomNav from '@/components/BottomNav';
import { useRouter } from 'expo-router';
import { safePush } from '@/lib/navigation';
import * as Location from 'expo-location';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useProducts, useInfiniteProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { HomeSkeleton } from '@/components/skeletons/HomeSkeleton';
import Skeleton from '@/components/Skeleton';
import { getPromotedProducts, recordAdClick, getUserData, storage, CustomInAppToast } from '@/services/api';
import { useChat } from '@/context/ChatContext';
import { useCart } from '@/context/CartContext';
import { useUnreadNotificationCount } from '@/hooks/useNotifications';
import { useOnboarding } from '@/context/OnboardingContext';
import { SpotlightTour } from '@/components/ui/SpotlightTour';
import { useAddFavorite, useFavorites, useRemoveFavorite } from '@/hooks/useFavorites';

const { width } = Dimensions.get('window');

// ─── Ad carousel constants ────────────────────────────────────────────────────
// The slide occupies the full width minus horizontal padding (16px each side).
const SLIDE_W = width - 32;   // card width
const SLIDE_H = 150;          // card height
const AD_DELAY = 4000;         // ms between auto-advances

// ─── Tokens ───────────────────────────────────────────────────────────────────
const C = {
  pageBg: '#E9F0FF',
  navy: '#0C1559',
  navyMid: '#1e3a8a',
  lime: '#84cc16',
  limeText: '#1a2e00',
  card: '#FFFFFF',
  body: '#0F172A',
  muted: '#64748B',
  subtle: '#94A3B8',
};

// ─── Static fallback banners ──────────────────────────────────────────────────
const FALLBACK_ADS = [
  { id: 'f1', badge: 'NEW IN', title: 'New Arrivals', sub: 'Fresh styles just dropped', cta: 'Shop Now', gradient: ['#0C1559', '#1e3a8a'] as [string, string], dest: '/search' },
  { id: 'f2', badge: '50% OFF', title: 'Deals for You', sub: 'Up to 50% off today only', cta: 'See Deals', gradient: ['#166534', '#14532d'] as [string, string], dest: '/deals' },
  { id: 'f3', badge: 'TOP', title: 'Top Stores', sub: 'Explore verified sellers near you', cta: 'Browse', gradient: ['#7C3AED', '#4c1d95'] as [string, string], dest: '/stores' },
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const MIN_SKELETON_MS = 450;

  const [locationText, setLocationText] = useState('Locating…');
  const [userName, setUserName] = useState('');
  const [selectedCat, setSelectedCat] = useState('All');
  const [ads, setAds] = useState<any[]>(FALLBACK_ADS);
  const [adIndex, setAdIndex] = useState(0);
  const [animValues, setAnimValues] = useState<Animated.Value[]>([]);
  const [showStartupSkeleton, setShowStartupSkeleton] = useState(true);

  const { buyerConversations } = useChat();
  const unreadCount = buyerConversations?.reduce(
    (acc: number, c: any) => acc + (c.unread || 0), 0
  ) || 0;

  const { items: cartItems, addToCart } = useCart();
  const cartCount = cartItems.reduce((sum: number, item: any) => sum + item.quantity, 0);

  const [addingId, setAddingId] = useState<string | null>(null);
  const [favoriteBusyId, setFavoriteBusyId] = useState<string | null>(null);
  const { data: favoriteProducts = [] } = useFavorites();
  const addFavoriteMutation = useAddFavorite();
  const removeFavoriteMutation = useRemoveFavorite();

  const favoriteIds = useMemo(
    () => new Set((favoriteProducts || []).map((p: any) => String(p.id || p._id || p.productId))),
    [favoriteProducts]
  );

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

  const handleToggleFavorite = (item: any) => {
    const productId = String(item._id || item.id || '');
    if (!productId || favoriteBusyId === productId) return;

    setFavoriteBusyId(productId);
    const isFavorite = favoriteIds.has(productId);

    const onSettled = () => setFavoriteBusyId(null);

    if (isFavorite) {
      removeFavoriteMutation.mutate(productId, { onSettled });
      return;
    }

    addFavoriteMutation.mutate(productId, {
      onSuccess: () => {
        CustomInAppToast.show({
          type: 'success',
          title: 'Added to favorites',
          message: item.name || 'Product added to favorites',
        });
      },
      onSettled,
    });
  };

  const { data: notifData } = useUnreadNotificationCount(false);
  const unreadNotifCount = notifData?.unreadCount ?? 0;

  const { data: categoriesData } = useCategories();
  const allCatNames = ['All', ...(categoriesData || []).map((c: any) => c.name)];
  const categoryFilter = selectedCat !== 'All' ? selectedCat : undefined;

  const {
    data: recentData, isLoading: loadingRecent,
    refetch: refetchRecent, isRefetching: refetchingRecent,
  } = useProducts({ category: categoryFilter, sortBy: 'newest' }, 10);

  const {
    data: trendingData, isLoading: loadingTrending,
    refetch: refetchTrending, isRefetching: refetchingTrending,
  } = useProducts({ category: categoryFilter, sortBy: 'popular' }, 10);

  const {
    data: dealsData, isLoading: loadingDeals,
    refetch: refetchDeals, isRefetching: refetchingDeals,
  } = useProducts({ category: categoryFilter, sortBy: 'price_asc' }, 20);

  const {
    data: exploreData, isLoading: loadingExplore,
    refetch: refetchExplore, isRefetching: refetchingExplore,
    fetchNextPage: fetchMoreExplore, hasNextPage: hasMoreExplore,
    isFetchingNextPage: fetchingMoreExplore
  } = useInfiniteProducts({ category: categoryFilter }, 24);

  const loading = loadingRecent || loadingDeals || loadingTrending || loadingExplore;
  const refreshing = refetchingRecent || refetchingDeals || refetchingTrending || refetchingExplore;
  const recentProducts = recentData?.success ? recentData.products : [];
  const trendingProducts = trendingData?.success ? trendingData.products : [];
  const dealsProducts = dealsData?.success ? dealsData.products : [];
  const exploreProducts = exploreData?.pages?.flatMap((p: any) => p.products || []) || [];

  // ── Ad carousel refs ────────────────────────────────────────────────────────
  // Using a plain horizontal ScrollView instead of FlatList — pagingEnabled
  // works reliably on ScrollView and avoids the overlap / snap bug that occurs
  // when FlatList tries to reconcile virtualisation with snap offsets.
  const adScrollRef = useRef<ScrollView>(null);
  const adTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isDragging = useRef(false);

  const scrollY = useRef(new Animated.Value(0)).current;

  // --- Onboarding Refs & State ---
  const { startTour, markCompleted, isTourActive, activeScreen, user, isLoading: onboardingLoading } = useOnboarding();
  const [layouts, setLayouts] = useState<any>({});
  const refGreeting = useRef<View>(null);
  const refActions = useRef<View>(null);
  const refCategories = useRef<ScrollView>(null);
  const refChat = useRef<View>(null);

  const captureLayout = (key: string) => (event: any) => {
    const { x, y, width, height } = event.nativeEvent.layout;
  };

  const measureElement = (ref: any, key: string) => {
    if (ref.current) {
      ref.current.measureInWindow((x: number, y: number, width: number, height: number) => {
        setLayouts((prev: any) => ({ ...prev, [key]: { x, y, width, height } }));
      });
    }
  };

  useEffect(() => {
    // Delay slightly to ensure measurements are accurate after initial render
    const timer = setTimeout(() => {
      measureElement(refGreeting, 'greeting');
      measureElement(refActions, 'actions');
      measureElement(refCategories, 'categories');
      measureElement(refChat, 'chat');

      // Auto-start logic with safety checks for returning users
      const shouldAutoStart = async () => {
        // 1. Wait for onboarding context to load
        if (onboardingLoading || !user) return;

        // 2. Check if already completed
        const state = await storage.getItem('HAS_SEEN_HOME_TOUR');
        if (state === 'true') return;

        // 3. LEGACY USER PROTECTION:
        // If account created before April 2026 (when tour was added), 
        // and they are a buyer, we don't force it.
        const createdDate = new Date(user.created_at || Date.now());
        const tourReleaseDate = new Date('2026-04-01');

        if (createdDate < tourReleaseDate && (user.role === 'buyer' || user.role === 'customer')) {
          // Silent marker so they don't see it next time either
          markCompleted('home');
          return;
        }

        // Auto-start for new users or sellers
        startTour('home');
      };

      shouldAutoStart();
    }, 1500);
    return () => clearTimeout(timer);
  }, [onboardingLoading, user]);

  const onboardingSteps = [
    {
      targetLayout: layouts.greeting,
      title: `Welcome to Shopyos!`,
      description: `We've personalized your dashboard based on your location and preferences.`,
    },
    {
      targetLayout: layouts.actions,
      title: 'Easy Access',
      description: 'Quickly check your cart or see notifications from your favorite stores.',
    },
    {
      targetLayout: layouts.categories,
      title: 'Shop by Category',
      description: 'Find exactly what you need by browsing our curated categories.',
    },
    {
      targetLayout: layouts.chat,
      title: 'Real-time Chat',
      description: 'Have a question? Chat with sellers instantly to get more details or negotiate.',
    },
  ].filter(s => !!s.targetLayout);

  const handleOnboardingComplete = () => {
    markCompleted('home');
  };

  // ── Load user name ──────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const cached = await storage.getItem('userName');
        if (cached) { setUserName(cached); return; }
        const user = await getUserData();
        const name = user?.name || user?.user?.name || '';
        const first = name.split(' ')[0];
        setUserName(first);
        if (first) await storage.setItem('userName', first);
      } catch { }
    })();
  }, []);

  // ── Load promoted ads ───────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await getPromotedProducts();
        if (res?.promotedProducts?.length > 0) setAds(res.promotedProducts);
      } catch { }
    })();
  }, []);

  // ── Auto-advance ad carousel ────────────────────────────────────────────────
  const goToAd = useCallback((idx: number) => {
    const clamped = Math.max(0, Math.min(idx, ads.length - 1));
    // scrollTo with x = slide index × slide width
    adScrollRef.current?.scrollTo({ x: clamped * SLIDE_W, animated: true });
    setAdIndex(clamped);
  }, [ads.length]);

  const startTimer = useCallback(() => {
    if (ads.length <= 1) return;
    adTimerRef.current = setInterval(() => {
      if (!isDragging.current) {
        setAdIndex((prev) => {
          const next = (prev + 1) % ads.length;
          adScrollRef.current?.scrollTo({ x: next * SLIDE_W, animated: true });
          return next;
        });
      }
    }, AD_DELAY);
  }, [ads.length]);

  const stopTimer = useCallback(() => {
    if (adTimerRef.current) { clearInterval(adTimerRef.current); adTimerRef.current = null; }
  }, []);

  useEffect(() => {
    startTimer();
    return stopTimer;
  }, [startTimer, stopTimer]);

  // ── Detect which slide is visible after the user lets go ───────────────────
  const onAdScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    isDragging.current = false;
    const idx = Math.round(e.nativeEvent.contentOffset.x / SLIDE_W);
    setAdIndex(idx);
    // Restart timer so it counts from now (not mid-cycle)
    stopTimer();
    startTimer();
  };

  // ── Location ────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      // 1. Set from cached text instantly
      const cachedTxt = await storage.getItem('CACHED_LOCATION_TEXT');
      const cachedCoordsStr = await storage.getItem('CACHED_LOCATION_COORDS');
      if (cachedTxt) setLocationText(cachedTxt);

      // 2. Try fetching Live GPS first
      let liveCoords = null;
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        try {
          const currentLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          liveCoords = { latitude: currentLoc.coords.latitude, longitude: currentLoc.coords.longitude };
        } catch (e) {
          console.log('Live GPS error', e);
        }
      }

      // 3. Fallback to profile Data if no live GPS
      if (!liveCoords) {
        try {
          const userData = await getUserData();
          if (userData?.latitude && userData?.longitude) {
            liveCoords = { latitude: userData.latitude, longitude: userData.longitude };
          } else if (userData?.city) {
            const profileLoc = userData.city + (userData.country ? `, ${userData.country}` : '');
            if (profileLoc !== cachedTxt) {
              setLocationText(profileLoc);
              await storage.setItem('CACHED_LOCATION_TEXT', profileLoc);
            }
            return; // We have a city, no need to geocode.
          }
        } catch (err) {
          console.log('Profile location fallback error', err);
        }
      }

      // 4. Reverse Geocode ONLY if moved significantly or no cache
      if (liveCoords) {
        let shouldGeocode = !cachedTxt;
        if (cachedCoordsStr) {
          try {
            const cachedCoords = JSON.parse(cachedCoordsStr);
            // ~500m threshold difference
            const latDiff = Math.abs(cachedCoords.latitude - liveCoords.latitude);
            const lonDiff = Math.abs(cachedCoords.longitude - liveCoords.longitude);
            if (latDiff > 0.005 || lonDiff > 0.005) {
              shouldGeocode = true;
            }
          } catch (e) { }
        } else {
          shouldGeocode = true;
        }

        if (shouldGeocode) {
          try {
            const [info] = await Location.reverseGeocodeAsync({
              latitude: liveCoords.latitude,
              longitude: liveCoords.longitude
            });

            if (info) {
              const txt = `${info.city ?? info.region ?? info.country ?? 'Unknown'}${info.country ? `, ${info.country}` : ''}`;
              setLocationText(txt);
              await storage.setItem('CACHED_LOCATION_TEXT', txt);
              await storage.setItem('CACHED_LOCATION_COORDS', JSON.stringify(liveCoords));
            }
          } catch (e) {
            console.log('Geocoding rate limit hit / failed', e);
          }
        }
      } else if (!cachedTxt) {
        setLocationText('Location unavailable');
      }
    })();
  }, []);

  // ── Card stagger animation ──────────────────────────────────────────────────
  useEffect(() => {
    if (recentProducts.length > 0) {
      const vals = recentProducts.map(() => new Animated.Value(0));
      setAnimValues(vals);
      Animated.stagger(
        70,
        vals.map((v: Animated.Value) =>
          Animated.timing(v, { toValue: 1, duration: 380, useNativeDriver: true })
        )
      ).start();
    }
  }, [recentProducts.length]);

  const onRefresh = async () => Promise.all([refetchRecent(), refetchDeals(), refetchTrending(), refetchExplore()]);

  const goToDetails = (item: any) =>
    safePush('/product/details', {
      id: item._id, title: item.name, price: item.price,
      category: item.category,
      image: item.images?.[0] || '',
      description: item.description,
    });

  // ── Render: single ad slide ─────────────────────────────────────────────────
  const renderAdSlide = (ad: any, i: number) => {
    const isPromoted = !ad.id?.startsWith('f');

    if (isPromoted) {
      return (
        <TouchableOpacity
          key={ad.id}
          style={S.adSlide}
          activeOpacity={0.9}
          onPress={() => {
            recordAdClick(ad.id).catch(() => { });
            if (ad.product?._id)
              router.push({ pathname: '/product/details', params: { id: ad.product._id } });
          }}
        >
          <Image
            source={{ uri: ad.product?.images?.[0] || ad.imageUrl || '' }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['rgba(12,21,89,0.8)', 'transparent']}
            start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={S.adContent}>
            <View style={S.adBadge}><Text style={S.adBadgeTxt}>{ad.badge || 'AD'}</Text></View>
            <Text style={S.adTitle} numberOfLines={2}>{ad.title || ad.product?.name}</Text>
            <View style={S.adCta}><Text style={S.adCtaTxt}>Shop Now →</Text></View>
          </View>
        </TouchableOpacity>
      );
    }

    // Static fallback slide
    return (
      <TouchableOpacity
        key={ad.id}
        style={S.adSlide}
        activeOpacity={0.9}
        onPress={() => router.push(ad.dest as any)}
      >
        <LinearGradient colors={ad.gradient} style={StyleSheet.absoluteFill} />
        {/* Decorative angled panel */}
        <View style={S.adPanel} />
        <View style={S.adContent}>
          <View style={S.adBadge}><Text style={S.adBadgeTxt}>{ad.badge}</Text></View>
          <Text style={S.adTitle}>{ad.title}</Text>
          <Text style={S.adSub}>{ad.sub}</Text>
          <View style={S.adCta}><Text style={S.adCtaTxt}>{ad.cta} →</Text></View>
        </View>
      </TouchableOpacity>
    );
  };

  // ── Render: recent card ─────────────────────────────────────────────────────
  const renderRecent = ({ item, index }: { item: any; index: number }) => (
    <Animated.View
      style={{
        opacity: animValues[index] ?? 1,
        transform: [{
          scale: (animValues[index] ?? new Animated.Value(1)).interpolate({
            inputRange: [0, 1], outputRange: [0.88, 1],
          }),
        }],
        marginRight: 14,
      }}
    >
      <TouchableOpacity style={S.productCard} activeOpacity={0.82} onPress={() => goToDetails(item)}>
        <Image
          source={{ uri: item.images?.[0] || 'https://via.placeholder.com/150' }}
          style={S.productImage}
        />
        <View style={S.productInfo}>
          <Text style={S.productStore} numberOfLines={1}>{item.store?.store_name || 'Shopyos'}</Text>
          <Text style={S.productTitle} numberOfLines={1}>{item.name}</Text>
          <Text style={S.productPrice}>₵{item.price.toFixed(2)}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  // ── Render: trending card ───────────────────────────────────────────────────
  const renderTrending = ({ item }: { item: any }) => (
    <View style={{ marginRight: 14 }}>
      <TouchableOpacity style={S.productCard} activeOpacity={0.82} onPress={() => goToDetails(item)}>
        <Image
          source={{ uri: item.images?.[0] || 'https://via.placeholder.com/150' }}
          style={S.productImage}
        />
        <View style={S.productInfo}>
          <Text style={S.productStore} numberOfLines={1}>{item.store?.store_name || 'Shopyos'}</Text>
          <Text style={S.productTitle} numberOfLines={1}>{item.name}</Text>
          <Text style={S.productPrice}>₵{item.price.toFixed(2)}</Text>
        </View>
      </TouchableOpacity>
    </View>
  );

  const renderHorizontalSkeleton = (count: number = 4) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.recentList}>
      {Array.from({ length: count }).map((_, idx) => (
        <View key={`hs-${idx}`} style={{ marginRight: 14 }}>
          <View style={S.productCard}>
            <Skeleton width={152} height={116} borderRadius={0} />
            <View style={S.productInfo}>
              <Skeleton width={90} height={9} style={{ marginBottom: 6 }} />
              <Skeleton width={120} height={13} style={{ marginBottom: 8 }} />
              <Skeleton width={64} height={14} />
            </View>
          </View>
        </View>
      ))}
    </ScrollView>
  );

  const renderGridSkeleton = (count: number = 4) => (
    <View style={S.dealsGrid}>
      {Array.from({ length: count }).map((_, idx) => (
        <View key={`gs-${idx}`} style={S.gridCard}>
          <Skeleton width="100%" height={136} borderRadius={0} />
          <View style={S.gridInfo}>
            <Skeleton width={80} height={9} style={{ marginBottom: 6 }} />
            <Skeleton width="90%" height={13} style={{ marginBottom: 8 }} />
            <Skeleton width={70} height={15} />
          </View>
        </View>
      ))}
    </View>
  );

  // ── Helper: Grid Card ────────────────────────────────────────────────────────
  const renderGridCard = (item: any) => (
    <TouchableOpacity
      key={item._id}
      style={S.gridCard}
      activeOpacity={0.88}
      onPress={() => goToDetails(item)}
    >
      <View style={S.gridImgWrap}>
        <Image
          source={{ uri: item.images?.[0] || 'https://via.placeholder.com/300' }}
          style={S.gridImg}
        />
        <TouchableOpacity
          style={S.favBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={(e: any) => {
            e?.stopPropagation?.();
            handleToggleFavorite(item);
          }}
          disabled={favoriteBusyId === String(item._id || item.id || '')}
        >
          {favoriteBusyId === String(item._id || item.id || '') ? (
            <ActivityIndicator size="small" color={C.navy} />
          ) : (
            <Ionicons
              name={favoriteIds.has(String(item._id || item.id || '')) ? 'heart' : 'heart-outline'}
              size={13}
              color={favoriteIds.has(String(item._id || item.id || '')) ? '#EF4444' : C.navy}
            />
          )}
        </TouchableOpacity>
        {item.isNew && (
          <View style={S.badgeNew}><Text style={S.badgeNewTxt}>NEW</Text></View>
        )}
      </View>
      <View style={S.gridInfo}>
        <Text style={S.storeLbl} numberOfLines={1}>
          {item.store?.name || item.store?.store_name || 'Shopyos'}
        </Text>
        <Text style={S.productLbl} numberOfLines={2}>{item.name}</Text>
        <View style={S.priceRow}>
          <Text style={S.priceLbl}>₵{parseFloat(item.price).toFixed(2)}</Text>
          <TouchableOpacity
            style={S.addBtn}
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

  const isInitialLoading = loading && recentProducts.length === 0 && dealsProducts.length === 0 && trendingProducts.length === 0 && exploreProducts.length === 0;

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowStartupSkeleton(false);
    }, MIN_SKELETON_MS);

    return () => clearTimeout(timer);
  }, []);

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

  // ── Root ────────────────────────────────────────────────────────────────────
  return (
    <View style={S.root}>
      <StatusBar style="light" />

      {/* Watermark */}
      <View style={S.watermark}>
        <Image source={require('../assets/images/splash-icon.png')} style={S.watermarkImg} />
      </View>

      <SafeAreaView style={{ flex: 1 }} edges={['left', 'right']}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <LinearGradient colors={[C.navy, C.navyMid]} style={[S.header, { paddingTop: insets.top + 10 }]}>
          <View style={S.hdrGlow1} pointerEvents="none" />
          <View style={S.hdrGlow2} pointerEvents="none" />

          <View style={S.headerInner} ref={refGreeting} onLayout={() => measureElement(refGreeting, 'greeting')}>
            <TouchableOpacity style={S.locationRow}>
              <Ionicons name="location-sharp" size={13} color="rgba(255,255,255,0.55)" />
              <Text style={S.locationTxt} numberOfLines={1}>{locationText}</Text>
              <Ionicons name="chevron-down" size={12} color="rgba(255,255,255,0.45)" />
            </TouchableOpacity>

            <View style={S.headerMainRow}>
              <Text style={S.greeting} numberOfLines={1}>
                {getGreeting()}
                {userName ? (
                  <Text>{', '}<Text style={{ color: C.lime }}>{userName}</Text></Text>
                ) : null}
                {' 👋'}
              </Text>

              <View style={S.headerActions} ref={refActions} onLayout={() => measureElement(refActions, 'actions')}>
                <TouchableOpacity style={S.headerBtn} onPress={() => safePush('/cart')}>
                  <Ionicons name="bag-outline" size={18} color="rgba(255,255,255,0.85)" />
                  {cartCount > 0 && (
                    <View style={S.hdrBadge}><Text style={S.hdrBadgeTxt}>{cartCount > 99 ? '99+' : cartCount}</Text></View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={S.headerBtn} onPress={() => safePush('/notification')}>
                  <Ionicons name="notifications-outline" size={18} color="rgba(255,255,255,0.85)" />
                  {unreadNotifCount > 0 && (
                    <View style={S.hdrBadge}><Text style={S.hdrBadgeTxt}>{unreadNotifCount > 99 ? '99+' : unreadNotifCount}</Text></View>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={S.headerArc} />
        </LinearGradient>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <Animated.ScrollView
          contentContainerStyle={S.scrollContent}
          showsVerticalScrollIndicator={false}
          style={{ opacity: 1 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
              tintColor={C.navy} colors={[C.navy]} />
          }
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
        >

          {/* ── Ad carousel — ScrollView + pagingEnabled (no overlap) ─── */}
          <View style={S.carouselWrap}>
            <ScrollView
              ref={adScrollRef}
              horizontal
              pagingEnabled                   // ← snaps exactly one SLIDE_W per page
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={16}
              onScrollBeginDrag={() => { isDragging.current = true; stopTimer(); }}
              onMomentumScrollEnd={onAdScrollEnd}
              // disableIntervalMomentum ensures one page at a time on iOS
              disableIntervalMomentum
              // contentContainerStyle has NO padding/gap — slides must be
              // exactly SLIDE_W each so paging aligns perfectly
              contentContainerStyle={{ flexDirection: 'row' }}
              style={{ width: SLIDE_W }}      // viewport = one slide wide
            >
              {ads.map(renderAdSlide)}
            </ScrollView>

            {/* Dot indicators */}
            {ads.length > 1 && (
              <View style={S.dots}>
                {ads.map((_, i) => (
                  <TouchableOpacity key={i} style={[S.dot, i === adIndex && S.dotActive]}
                    onPress={() => goToAd(i)} />
                ))}
              </View>
            )}
          </View>

          {/* ── Category chips ────────────────────────────────────────────── */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            ref={refCategories}
            onLayout={() => measureElement(refCategories, 'categories')}
            contentContainerStyle={S.chipStrip}>
            {allCatNames.map((cat) => {
              const on = selectedCat === cat;
              return (
                <TouchableOpacity key={cat} style={[S.chip, on && S.chipOn]}
                  onPress={() => setSelectedCat(cat)}>
                  <Text style={[S.chipTxt, on && S.chipTxtOn]}>{cat}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* ── Recently Added ─────────────────────────────────────────────── */}
          <View style={S.sectionHeader}>
            <Text style={S.sectionTitle}>Recently Added</Text>
            <TouchableOpacity onPress={() => router.push('/recent' as any)}>
              <Text style={S.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>
          {loadingRecent
            ? renderHorizontalSkeleton()
            : (
              <FlatList
                data={recentProducts}
                keyExtractor={(item) => item._id}
                horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={S.recentList}
                renderItem={renderRecent}
                ListEmptyComponent={
                  <View style={S.emptyH}>
                    <View style={S.emptyCircle}>
                      <Feather name="shopping-bag" size={26} color={C.navyMid} />
                    </View>
                    <Text style={S.emptyTitle}>Nothing here yet</Text>
                    <Text style={S.emptySub}>New products will show up soon</Text>
                    <TouchableOpacity style={S.emptyBtn} onPress={() => router.push('/stores' as any)}>
                      <Text style={S.emptyBtnTxt}>Browse Stores</Text>
                    </TouchableOpacity>
                  </View>
                }
              />
            )}

          {/* ── Hot & Trending ─────────────────────────────────────────────── */}
          <View style={[S.sectionHeader, { marginTop: 8 }]}>
            <Text style={S.sectionTitle}>Hot & Trending</Text>
            <TouchableOpacity onPress={() => router.push('/search?sortBy=popular' as any)}>
              <Text style={S.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>
          {loadingTrending
            ? renderHorizontalSkeleton()
            : (
              <FlatList
                data={trendingProducts}
                keyExtractor={(item) => item._id}
                horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={S.recentList}
                renderItem={renderTrending}
                ListEmptyComponent={
                  <View style={S.emptyH}>
                    <View style={S.emptyCircle}>
                      <Feather name="trending-up" size={26} color={C.navyMid} />
                    </View>
                    <Text style={S.emptyTitle}>No trending items</Text>
                    <Text style={S.emptySub}>Trending products will appear here soon.</Text>
                  </View>
                }
              />
            )}

          {/* ── Deals for You ─────────────────────────────────────────────── */}
          <View style={[S.sectionHeader, { marginTop: 8 }]}>
            <Text style={S.sectionTitle}>Deals for You</Text>
            <TouchableOpacity onPress={() => router.push('/deals' as any)}>
              <Text style={S.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>
          {loadingDeals
            ? renderGridSkeleton()
            : (
              <View style={S.dealsGrid}>
                {dealsProducts.length > 0 ? (
                  dealsProducts.map(renderGridCard)
                ) : (
                  <View style={[S.emptyH, { width: '100%' }]}>
                    <View style={[S.emptyCircle, { backgroundColor: '#f0fdf4' }]}>
                      <MaterialCommunityIcons name="tag-outline" size={26} color="#16a34a" />
                    </View>
                    <Text style={S.emptyTitle}>No deals right now</Text>
                    <Text style={S.emptySub}>Check back later for great prices</Text>
                    <TouchableOpacity style={[S.emptyBtn, { backgroundColor: C.lime }]}
                      onPress={() => router.push('/filter' as any)}>
                      <Text style={[S.emptyBtnTxt, { color: C.limeText }]}>Explore Products</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

          {/* ── Explore ─────────────────────────────────────────────── */}
          <View style={[S.sectionHeader, { marginTop: 8 }]}>
            <Text style={S.sectionTitle}>Explore</Text>
            <TouchableOpacity onPress={() => router.push('/search' as any)}>
              <Text style={S.seeAll}>More</Text>
            </TouchableOpacity>
          </View>
          {loadingExplore
            ? renderGridSkeleton()
            : (
              <View style={S.dealsGrid}>
                {exploreProducts.length > 0 ? (
                  exploreProducts.map(renderGridCard)
                ) : (
                  <View style={[S.emptyH, { width: '100%' }]}>
                    <View style={S.emptyCircle}>
                      <Feather name="grid" size={26} color={C.navyMid} />
                    </View>
                    <Text style={S.emptyTitle}>Nothing to explore yet</Text>
                    <Text style={S.emptySub}>New products will be added soon.</Text>
                  </View>
                )}
              </View>
            )}
          {hasMoreExplore && (
            <TouchableOpacity 
              style={[S.emptyBtn, { alignSelf: 'center', marginBottom: 30, paddingHorizontal: 30, paddingVertical: 12 }]} 
              onPress={() => fetchMoreExplore()}
              disabled={fetchingMoreExplore}
            >
              {fetchingMoreExplore ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={[S.emptyBtnTxt, { fontSize: 13 }]}>Load More</Text>
              )}
            </TouchableOpacity>
          )}

        </Animated.ScrollView>

        {/* ── Chat FAB — moved up from bottom: 88 → 140 ─────────────────── */}
        <TouchableOpacity
          style={S.chatFab}
          onPress={() => router.push('/chat' as any)}
          activeOpacity={0.85}
          ref={refChat}
          onLayout={() => measureElement(refChat, 'chat')}
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
        onComplete={handleOnboardingComplete}
      />
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.pageBg },
  watermark: { position: 'absolute', bottom: -10, left: -40 },
  watermarkImg: { width: 130, height: 130, resizeMode: 'contain', opacity: 0.1 },

  // Header
  header: {
    position: 'relative', paddingBottom: 28, zIndex: 10,
    elevation: 10, shadowColor: C.navy,
    shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16,
  },
  hdrGlow1: {
    position: 'absolute', top: -30, right: -30,
    width: 150, height: 150, borderRadius: 75,
    backgroundColor: 'rgba(132,204,22,0.12)',
  },
  hdrGlow2: {
    position: 'absolute', bottom: -20, left: -10,
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(30,58,138,0.5)',
  },
  headerInner: { paddingHorizontal: 20 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10 },
  locationTxt: { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: 'rgba(255,255,255,0.55)', maxWidth: width * 0.55 },
  headerMainRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  greeting: { fontSize: 15, fontFamily: 'Montserrat-Bold', color: '#fff', flex: 1, marginRight: 8 },
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

  scrollContent: { paddingBottom: 110 },

  // ── Ad carousel ─────────────────────────────────────────────────────────────
  carouselWrap: {
    // Centre the scroll view horizontally with 16px margins each side
    paddingHorizontal: 16,
    paddingTop: 6,
    marginBottom: 4,
  },
  // Each slide is exactly SLIDE_W × SLIDE_H — no margin, no gap
  // The ScrollView viewport is also SLIDE_W, so exactly one slide shows at a time
  adSlide: {
    width: SLIDE_W,
    height: SLIDE_H,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: C.navy,
    // No marginRight — paging relies on slides being exactly one viewport wide
  },
  adPanel: {
    position: 'absolute', right: -20, top: 0, bottom: 0, width: '50%',
    backgroundColor: 'rgba(255,255,255,0.06)',
    transform: [{ skewX: '-12deg' }],
  },
  adContent: {
    position: 'absolute', left: 18, top: 0, bottom: 0,
    justifyContent: 'center', maxWidth: '62%',
  },
  adBadge: {
    backgroundColor: C.lime, borderRadius: 20,
    paddingHorizontal: 9, paddingVertical: 3,
    alignSelf: 'flex-start', marginBottom: 7,
  },
  adBadgeTxt: { fontSize: 9, fontFamily: 'Montserrat-Bold', color: C.limeText, letterSpacing: 0.5 },
  adTitle: { fontSize: 17, fontFamily: 'Montserrat-Bold', color: '#fff', lineHeight: 22, marginBottom: 5 },
  adSub: { fontSize: 11, fontFamily: 'Montserrat-Medium', color: 'rgba(255,255,255,0.65)', marginBottom: 10 },
  adCta: {
    backgroundColor: '#fff', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6, alignSelf: 'flex-start',
  },
  adCtaTxt: { fontSize: 11, fontFamily: 'Montserrat-Bold', color: C.navy },

  dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(12,21,89,0.18)' },
  dotActive: { width: 20, height: 6, borderRadius: 3, backgroundColor: C.navy },

  // Chips
  chipStrip: { paddingHorizontal: 16, paddingVertical: 14, gap: 8, flexDirection: 'row' },
  chip: {
    height: 34, paddingHorizontal: 16, borderRadius: 17,
    borderWidth: 1, borderColor: C.navyMid, backgroundColor: C.card,
    justifyContent: 'center', alignItems: 'center',
    elevation: 1, shadowColor: C.navy,
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2,
  },
  chipOn: { backgroundColor: C.lime, borderColor: C.lime },
  chipTxt: { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: C.muted },
  chipTxtOn: { color: C.limeText },

  // Section headers
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 16, marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: C.body },
  seeAll: { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: C.lime },

  // Recent products
  recentList: { paddingLeft: 16, paddingBottom: 20 },
  productCard: {
    width: 152, borderRadius: 18, backgroundColor: C.card, overflow: 'hidden',
    elevation: 4, shadowColor: C.navy,
    shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 10,
  },
  productImage: { width: '100%', height: 116, resizeMode: 'cover' },
  productInfo: { padding: 10 },
  productStore: { fontSize: 9, fontFamily: 'Montserrat-Bold', color: C.subtle, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 },
  productTitle: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: C.body, marginBottom: 5 },
  productPrice: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: C.lime },

  // Deals
  dealsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 14, justifyContent: 'space-between', paddingBottom: 24 },
  gridCard: {
    width: (width - 42) / 2, // Matches search grid calculation
    backgroundColor: C.card,
    borderRadius: 22,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: C.navy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    marginBottom: 14,
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
    backgroundColor: C.lime,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeNewTxt: { fontSize: 9, fontFamily: 'Montserrat-Bold', color: C.limeText, letterSpacing: 0.4 },
  gridInfo: { padding: 11 },
  storeLbl: {
    fontSize: 9,
    fontFamily: 'Montserrat-Bold',
    color: C.subtle,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  productLbl: {
    fontSize: 13,
    fontFamily: 'Montserrat-Bold',
    color: C.body,
    lineHeight: 18,
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceLbl: { fontSize: 15, fontFamily: 'Montserrat-Bold', color: C.lime },
  addBtn: {
    width: 28, height: 28,
    borderRadius: 10,
    backgroundColor: C.navy,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: C.navy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },

  // Empty states
  emptyH: {
    width: width - 64, marginLeft: 16, backgroundColor: C.card, borderRadius: 20,
    paddingVertical: 28, paddingHorizontal: 20, alignItems: 'center',
    elevation: 2, shadowColor: C.navy,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8,
  },
  emptyCircle: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center', marginBottom: 10,
  },
  emptyTitle: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: C.body, marginBottom: 4 },
  emptySub: { fontSize: 12, fontFamily: 'Montserrat-Regular', color: C.subtle, textAlign: 'center', marginBottom: 14, lineHeight: 18 },
  emptyBtn: { backgroundColor: C.navyMid, paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20 },
  emptyBtnTxt: { color: '#fff', fontSize: 12, fontFamily: 'Montserrat-Bold' },

  // Chat FAB — bottom: 140 gives more breathing room above BottomNav
  chatFab: {
    position: 'absolute',
    bottom: 140,   // ← moved up (was 88)
    right: 18,
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
});