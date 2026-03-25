import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, Image, FlatList,
  TouchableOpacity, StyleSheet, Animated, RefreshControl,
  Dimensions, ScrollView, NativeSyntheticEvent,
  NativeScrollEvent, Platform,
} from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import BottomNav from '@/components/BottomNav';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { HomeSkeleton } from '@/components/skeletons/HomeSkeleton';
import { useChat } from './context/ChatContext';
import { getPromotedProducts, recordAdClick, getUserData, storage } from '@/services/api';
import { useCart } from './context/CartContext';
import { useUnreadNotificationCount } from '@/hooks/useNotifications';
import { useOnboarding } from './context/OnboardingContext';
import { SpotlightTour } from '@/components/ui/SpotlightTour';

const { width } = Dimensions.get('window');

// ─── Ad carousel constants ────────────────────────────────────────────────────
// The slide occupies the full width minus horizontal padding (16px each side).
const SLIDE_W   = width - 32;   // card width
const SLIDE_H   = 150;          // card height
const AD_DELAY  = 4000;         // ms between auto-advances

// ─── Tokens ───────────────────────────────────────────────────────────────────
const C = {
  pageBg:  '#E9F0FF',
  navy:    '#0C1559',
  navyMid: '#1e3a8a',
  lime:    '#84cc16',
  limeText:'#1a2e00',
  card:    '#FFFFFF',
  body:    '#0F172A',
  muted:   '#64748B',
  subtle:  '#94A3B8',
};

// ─── Static fallback banners ──────────────────────────────────────────────────
const FALLBACK_ADS = [
  { id: 'f1', badge: 'NEW IN',  title: 'New Arrivals',  sub: 'Fresh styles just dropped',        cta: 'Shop Now', gradient: ['#0C1559','#1e3a8a'] as [string,string], dest: '/search'  },
  { id: 'f2', badge: '50% OFF', title: 'Deals for You', sub: 'Up to 50% off today only',         cta: 'See Deals',gradient: ['#166534','#14532d'] as [string,string], dest: '/deals'   },
  { id: 'f3', badge: 'TOP',     title: 'Top Stores',    sub: 'Explore verified sellers near you', cta: 'Browse',   gradient: ['#7C3AED','#4c1d95'] as [string,string], dest: '/stores'  },
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

  const [locationText, setLocationText] = useState('Locating…');
  const [userName,     setUserName]     = useState('');
  const [selectedCat,  setSelectedCat]  = useState('All');
  const [ads,          setAds]          = useState<any[]>(FALLBACK_ADS);
  const [adIndex,      setAdIndex]      = useState(0);
  const [animValues,   setAnimValues]   = useState<Animated.Value[]>([]);

  const { buyerConversations } = useChat();
  const unreadCount = buyerConversations?.reduce(
    (acc: number, c: any) => acc + (c.unread || 0), 0
  ) || 0;

  const { items: cartItems } = useCart();
  const cartCount = cartItems.reduce((sum: number, item: any) => sum + item.quantity, 0);

  const { data: notifData } = useUnreadNotificationCount();
  const unreadNotifCount = notifData?.unreadCount ?? 0;

  const { data: categoriesData } = useCategories();
  const allCatNames    = ['All', ...(categoriesData || []).map((c: any) => c.name)];
  const categoryFilter = selectedCat !== 'All' ? selectedCat : undefined;

  const {
    data: recentData, isLoading: loadingRecent,
    refetch: refetchRecent, isRefetching: refetchingRecent,
  } = useProducts({ category: categoryFilter, sortBy: 'newest' }, 10);

  const {
    data: dealsData, isLoading: loadingDeals,
    refetch: refetchDeals, isRefetching: refetchingDeals,
  } = useProducts({ sortBy: 'price_asc' }, 5);

  const loading    = loadingRecent || loadingDeals;
  const refreshing = refetchingRecent || refetchingDeals;
  const recentProducts = recentData?.success ? recentData.products : [];
  const dealsProducts  = dealsData?.success  ? dealsData.products  : [];

  // ── Ad carousel refs ────────────────────────────────────────────────────────
  // Using a plain horizontal ScrollView instead of FlatList — pagingEnabled
  // works reliably on ScrollView and avoids the overlap / snap bug that occurs
  // when FlatList tries to reconcile virtualisation with snap offsets.
  const adScrollRef = useRef<ScrollView>(null);
  const adTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const isDragging  = useRef(false);

  const scrollY = useRef(new Animated.Value(0)).current;

  // --- Onboarding Refs & State ---
  const { startTour, markCompleted, isTourActive, activeScreen } = useOnboarding();
  const [layouts, setLayouts] = useState<any>({});
  const refGreeting = useRef<View>(null);
  const refActions = useRef<View>(null);
  const refCategories = useRef<ScrollView>(null);
  const refChat = useRef<View>(null);

  const captureLayout = (key: string) => (event: any) => {
    const { x, y, width, height } = event.nativeEvent.layout;
    // We need absolute coordinates for the spotlight.
    // For fixed elements or those at the top, relative might work,
    // but measureInWindow is safer for a global modal.
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
      
      // Auto-start if not completed
      startTour('home');
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

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
        const user  = await getUserData();
        const name  = user?.name || user?.user?.name || '';
        const first = name.split(' ')[0];
        setUserName(first);
        if (first) await storage.setItem('userName', first);
      } catch {}
    })();
  }, []);

  // ── Load promoted ads ───────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await getPromotedProducts();
        if (res?.promotedProducts?.length > 0) setAds(res.promotedProducts);
      } catch {}
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
          } catch(e) {}
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

  const onRefresh = async () => Promise.all([refetchRecent(), refetchDeals()]);

  const goToDetails = (item: any) =>
    router.push({
      pathname: '/product/details',
      params: {
        id: item._id, title: item.name, price: item.price,
        category: item.category,
        image: item.images?.[0] || '',
        description: item.description,
      },
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
            recordAdClick(ad.id).catch(() => {});
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

  // ── Render: deal card ───────────────────────────────────────────────────────
  const renderDeal = ({ item }: { item: any }) => (
    <TouchableOpacity style={S.dealCard} activeOpacity={0.82} onPress={() => goToDetails(item)}>
      <Image source={{ uri: item.images?.[0] || 'https://via.placeholder.com/150' }} style={S.dealImage} />
      <View style={S.dealInfo}>
        <Text style={S.dealTitle} numberOfLines={2}>{item.name}</Text>
        <Text style={S.dealPrice}>₵{item.price.toFixed(2)}</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={S.root}>
        <StatusBar style="dark" />
        <SafeAreaView style={{ flex: 1 }}><HomeSkeleton /></SafeAreaView>
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
                <TouchableOpacity style={S.headerBtn} onPress={() => router.push('/cart' as any)}>
                  <Ionicons name="bag-outline" size={18} color="rgba(255,255,255,0.85)" />
                  {cartCount > 0 && (
                    <View style={S.hdrBadge}><Text style={S.hdrBadgeTxt}>{cartCount > 99 ? '99+' : cartCount}</Text></View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={S.headerBtn} onPress={() => router.push('/notification' as any)}>
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

          {/* ── Deals for You ─────────────────────────────────────────────── */}
          <View style={[S.sectionHeader, { marginTop: 8 }]}>
            <Text style={S.sectionTitle}>Deals for You</Text>
            <TouchableOpacity onPress={() => router.push('/deals' as any)}>
              <Text style={S.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={dealsProducts}
            keyExtractor={(item) => item._id}
            horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={S.dealsList}
            renderItem={renderDeal}
            ListEmptyComponent={
              <View style={S.emptyH}>
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
            }
          />

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
  root:    { flex: 1, backgroundColor: C.pageBg },
  watermark:   { position: 'absolute', bottom: -10, left: -40 },
  watermarkImg:{ width: 130, height: 130, resizeMode: 'contain', opacity: 0.1 },

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
  headerInner:   { paddingHorizontal: 20 },
  locationRow:   { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10 },
  locationTxt:   { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: 'rgba(255,255,255,0.55)', maxWidth: width * 0.55 },
  headerMainRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  greeting:      { fontSize: 15, fontFamily: 'Montserrat-Bold', color: '#fff', flex: 1, marginRight: 8 },
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
    width:        SLIDE_W,
    height:       SLIDE_H,
    borderRadius: 20,
    overflow:     'hidden',
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
  adBadgeTxt: { fontSize: 9,  fontFamily: 'Montserrat-Bold',   color: C.limeText, letterSpacing: 0.5 },
  adTitle:    { fontSize: 17, fontFamily: 'Montserrat-Bold',   color: '#fff', lineHeight: 22, marginBottom: 5 },
  adSub:      { fontSize: 11, fontFamily: 'Montserrat-Medium', color: 'rgba(255,255,255,0.65)', marginBottom: 10 },
  adCta: {
    backgroundColor: '#fff', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6, alignSelf: 'flex-start',
  },
  adCtaTxt: { fontSize: 11, fontFamily: 'Montserrat-Bold', color: C.navy },

  dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 10 },
  dot:       { width: 6,  height: 6, borderRadius: 3, backgroundColor: 'rgba(12,21,89,0.18)' },
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
  chipOn:    { backgroundColor: C.lime, borderColor: C.lime },
  chipTxt:   { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: C.muted },
  chipTxtOn: { color: C.limeText },

  // Section headers
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 16, marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: C.body },
  seeAll:       { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: C.lime },

  // Recent products
  recentList: { paddingLeft: 16, paddingBottom: 20 },
  productCard: {
    width: 152, borderRadius: 18, backgroundColor: C.card, overflow: 'hidden',
    elevation: 4, shadowColor: C.navy,
    shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 10,
  },
  productImage:  { width: '100%', height: 116, resizeMode: 'cover' },
  productInfo:   { padding: 10 },
  productStore:  { fontSize: 9, fontFamily: 'Montserrat-Bold', color: C.subtle, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 },
  productTitle:  { fontSize: 13, fontFamily: 'Montserrat-Bold', color: C.body, marginBottom: 5 },
  productPrice:  { fontSize: 14, fontFamily: 'Montserrat-Bold', color: C.lime },

  // Deals
  dealsList: { paddingLeft: 16, paddingBottom: 24 },
  dealCard: {
    width: 136, borderRadius: 16, backgroundColor: C.card,
    overflow: 'hidden', marginRight: 12,
    elevation: 3, shadowColor: C.navy,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8,
  },
  dealImage: { width: '100%', height: 96, resizeMode: 'cover' },
  dealInfo:  { padding: 10 },
  dealTitle: { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: C.body, marginBottom: 5, lineHeight: 16 },
  dealPrice: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: C.lime },

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
  emptyTitle:  { fontSize: 14, fontFamily: 'Montserrat-Bold',    color: C.body,   marginBottom: 4 },
  emptySub:    { fontSize: 12, fontFamily: 'Montserrat-Regular', color: C.subtle, textAlign: 'center', marginBottom: 14, lineHeight: 18 },
  emptyBtn:    { backgroundColor: C.navyMid, paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20 },
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