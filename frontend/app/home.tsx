import React, { useEffect, useState, useRef } from 'react';
import { View, Text,Image,ImageBackground,TextInput,FlatList,TouchableOpacity,StyleSheet, useColorScheme, Animated,RefreshControl, Dimensions, ScrollView, ActivityIndicator,} from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import BottomNav from '@/components/BottomNav';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useProducts, useProductSearch } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { HomeSkeleton } from '@/components/skeletons/HomeSkeleton';

const { width } = Dimensions.get('window');

export default function Home() {
  const router = useRouter();

  const [locationText, setLocationText] = useState<'Locating…' | string>('Locating…');
  const [selectedCat, setSelectedCat] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [animationValues, setAnimationValues] = useState<Animated.Value[]>([]);
  const scrollY = useRef(new Animated.Value(0)).current;

  const { data: categoriesData } = useCategories();
  const categories = categoriesData || [];
  const allCategoryNames = ['All', ...categories.map((c: any) => c.name)];

  const categoryFilter = selectedCat !== 'All' ? selectedCat : undefined;
  
  const { data: recentData, isLoading: isLoadingRecent, refetch: refetchRecent, isRefetching: isRefetchingRecent } = useProducts({ 
    category: categoryFilter,
    sortBy: 'newest'
  }, 10);
  
  const { data: dealsData, isLoading: isLoadingDeals, refetch: refetchDeals, isRefetching:  isRefetchingDeals } = useProducts({ 
    sortBy: 'price_asc'
  }, 5);
  
  const { data: searchData } = useProductSearch(searchQuery, undefined, 10);

  const loading = isLoadingRecent || isLoadingDeals;
  const refreshing = isRefetchingRecent || isRefetchingDeals;
  const recentProducts = recentData?.success ? recentData.products : [];
  const dealsProducts = dealsData?.success ? dealsData.products : [];
  const searchResults = searchQuery.length > 2 && searchData?.success ? searchData.products : [];

  useEffect(() => {
    if (recentProducts.length > 0) {
      const vals = recentProducts.map(() => new Animated.Value(0));
      setAnimationValues(vals);
      const animations = vals.map((anim: any, i: number) =>
        Animated.timing(anim, {
          toValue: 1,
          duration: 500,
          delay: i * 100,
          useNativeDriver: true,
        })
      );
      Animated.stagger(100, animations).start();
    }
  }, [recentProducts]);

  // ── Location: read cache immediately, then subscribe to live position updates
  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;

    (async () => {
      // 1. Show the cached text right away (written by the geofence background task)
      const cached = await AsyncStorage.getItem('CACHED_LOCATION_TEXT');
      if (cached) setLocationText(cached);

      // 2. Request foreground permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (!cached) setLocationText('Permission denied');
        return;
      }

      // 3. Subscribe to live position updates (updates whenever the user moves ≥ 100 m)
      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 100,   // fire after 100 m movement
          timeInterval: 60_000,    // or every 60 s at most
        },
        async ({ coords: { latitude, longitude } }) => {
          try {
            const [reverseInfo] = await Location.reverseGeocodeAsync({ latitude, longitude });
            if (reverseInfo) {
              const { city, region, country } = reverseInfo;
              const text = `${city ?? region ?? country ?? 'Unknown'}${country ? `, ${country}` : ''}`;
              setLocationText(text);
              // Keep the cache fresh so next mount is instant
              await AsyncStorage.setItem('CACHED_LOCATION_TEXT', text);
            }
          } catch {
            // Ignore reverse-geocode errors silently
          }
        }
      );
    })();

    return () => { subscription?.remove(); };
  }, []);

  const onRefresh = async () => {
    await Promise.all([refetchRecent(), refetchDeals()]);
  };

  const goToDetails = (item: any) => {
    router.push({
      pathname: '/product/details',
      params: {
        id: item._id,
        title: item.name,
        price: item.price,
        category: item.category,
        image: item.images?.[0] || 'https://via.placeholder.com/150',
        description: item.description
      }
    });
  };

  // --- Render Components ---

  const renderRecent = ({ item, index }: { item: any; index: number }) => (
    <Animated.View
      style={{
        opacity: animationValues[index] || 1,
        transform: [{ scale: animationValues[index]?.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) || 1 }],
        marginRight: 16,
      }}
    >
      <TouchableOpacity
        style={[styles.productCard, { backgroundColor: '#FFF' }]}
        activeOpacity={0.8}
        onPress={() => goToDetails(item)}
      >
        <Image source={{ uri: item.images?.[0] || 'https://via.placeholder.com/150' }} style={styles.productImage} />
        <View style={styles.productInfo}>
          <Text style={[styles.productTitle, { color: '#0F172A' }]} numberOfLines={1}>{item.name}</Text>
          <Text style={[styles.productCategory, { color: '#64748B' }]}>{item.category}</Text>
          <View style={styles.priceRow}>
            <Text style={[styles.currentPrice, { color: '#0d3804' }]}>₵{item.price.toFixed(2)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderDeal = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={[styles.dealCard, { backgroundColor: '#FFF' }]}
      activeOpacity={0.8}
      onPress={() => goToDetails(item)}
    >
      <Image source={{ uri: item.images?.[0] || 'https://via.placeholder.com/150' }} style={styles.dealImage} />
      <Text style={[styles.dealTitle, { color: '#0F172A' }]} numberOfLines={2}>{item.name}</Text>
      <Text style={styles.dealPrice}>₵{item.price.toFixed(2)}</Text>
    </TouchableOpacity>
  );

  const renderSearchItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.searchResultCard}
      onPress={() => goToDetails(item)}
      activeOpacity={0.8}
    >
      <Image source={{ uri: item.images?.[0] || 'https://via.placeholder.com/150' }} style={styles.searchResultImage} />
      <View style={styles.searchResultInfo}>
        <Text style={styles.searchResultTitle} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.searchResultPrice}>₵{item.price.toFixed(2)}</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    
    return (
      <View style={[styles.container, { backgroundColor: '#E9F0FF' }]}>
        <SafeAreaView style={{ flex: 1 }}>
          <HomeSkeleton />
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: '#E9F0FF' }]}>
      <StatusBar style="dark" translucent backgroundColor="transparent" />

      {/* --- BACKGROUND WATERMARK LAYER --- */}
      <View style={styles.bottomLogos}>
        <Image
          source={require('../assets/images/splash-icon.png')}
          style={styles.fadedLogo}
        />
      </View>

      <SafeAreaView style={styles.container}>
        <Animated.ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
        >
          {/* Location + App Logo + Search Row */}
          <View style={styles.topSection}>
            <TouchableOpacity style={styles.locationRow}>
              <Ionicons name="location-sharp" size={18} color="#222" />
              <Text style={[styles.locationText, { color: '#222' }]}>{locationText}</Text>
              <Ionicons name="chevron-down" size={16} color="#222" />
            </TouchableOpacity>

            <View style={styles.logoSearchRow}>
              <View style={styles.logoContainer}>
                <Image source={require('../assets/images/icondark.png')} style={styles.logoImage} resizeMode="contain" />
              </View>

              <View style={styles.searchAndIcons}>
                <View style={[styles.searchInputWrapper, { backgroundColor: '#1e3a8a' }]}>
                  <Feather name="search" size={16} color="#FFF" />
                  <TextInput
                    placeholder="Search items..."
                    placeholderTextColor="rgba(255,255,255,0.8)"
                    style={[styles.searchInput, { color: '#FFF' }]}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                  {searchQuery.length > 0 ? (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                      <Feather name="x" size={16} color="#FFF" />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity onPress={() => router.push('/filter')}>
                      <Feather name="sliders" size={16} color="#FFF" />
                    </TouchableOpacity>
                  )}
                </View>

                <TouchableOpacity style={styles.notificationIcon} onPress={() => router.push('/cart')}>
                  <Ionicons name="cart" size={22} color="#1e3a8a" />
                  <View style={styles.notificationDot} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* === Conditional Rendering based on Search === */}
          {searchQuery.length > 0 ? (
            // --- SEARCH RESULTS VIEW ---
            <View style={styles.searchResultsContainer}>
              <Text style={styles.sectionTitle}>
                Found {searchResults.length} Result{searchResults.length !== 1 ? 's' : ''}
              </Text>
              {searchResults.length === 0 ? (
                <View style={styles.noResultsContainer}>
                  <Feather name="frown" size={40} color="#64748B" />
                  <Text style={styles.noResultsText}>No items found for "{searchQuery}"</Text>
                </View>
              ) : (
                <FlatList
                  data={searchResults}
                  keyExtractor={(item) => item._id}
                  renderItem={renderSearchItem}
                  numColumns={2}
                  scrollEnabled={false} 
                  columnWrapperStyle={{ justifyContent: 'space-between' }}
                  contentContainerStyle={{ marginTop: 10 }}
                />
              )}
            </View>
          ) : (
            // --- DEFAULT HOME VIEW ---
            <>
              {/* Banner */}
              <Animated.View
                style={[
                  styles.bannerContainer,
                  {
                    transform: [
                      {
                        translateY: scrollY.interpolate({
                          inputRange: [-100, 0, 100],
                          outputRange: [-50, 0, 50],
                          extrapolate: 'clamp',
                        }),
                      },
                    ],
                  },
                ]}
              >
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => router.push({ pathname: '/product/details', params: { title: 'Special Offer', price: 99, image: require('../assets/images/banner1.png') } })}
                  style={{ flex: 1 }}
                >
                  <ImageBackground
                    source={require('../assets/images/banner1.png')}
                    style={styles.bannerImageBg}
                    imageStyle={{ borderRadius: 16 }}
                  />
                </TouchableOpacity>
              </Animated.View>

              {/* Category Chips */}
              <View style={styles.chipsContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {allCategoryNames.map((cat) => {
                    const isActive = selectedCat === cat;
                    return (
                      <TouchableOpacity key={cat} onPress={() => setSelectedCat(cat)}>
                        <View style={[styles.chip, { backgroundColor: isActive ? '#84cc16' : '#FFF', borderColor: isActive ? '#84cc16' : '#1e3a8a' }]}>
                          <Text style={[styles.chipText, { color: isActive ? '#111827' : '#64748B' }]}>{cat}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Recently Added (Now primary list) */}
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: '#222' }]}>Recently Added</Text>
                <TouchableOpacity onPress={() => router.push('/recent')}>
                  <Text style={[styles.seeAllText, { color: '#64748B' }]}>See All</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={recentProducts}
                keyExtractor={(item) => item._id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.recentList}
                renderItem={renderRecent}
                ListEmptyComponent={
                  <View style={styles.emptyHorizontal}>
                    <View style={styles.emptyIconCircle}>
                      <Feather name="shopping-bag" size={28} color="#1e3a8a" />
                    </View>
                    <Text style={styles.emptyTitle}>Nothing here yet</Text>
                    <Text style={styles.emptySubtitle}>New products will show up soon</Text>
                    <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/stores')}>
                      <Text style={styles.emptyBtnText}>Browse Stores</Text>
                    </TouchableOpacity>
                  </View>
                }
              />

              {/* Deals for You */}
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: '#222' }]}>Deals for You</Text>
                <TouchableOpacity onPress={() => router.push('/deals')}>
                  <Text style={[styles.seeAllText, { color: '#64748B' }]}>See All</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={dealsProducts}
                keyExtractor={(item) => item._id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.dealsList}
                renderItem={renderDeal}
                ListEmptyComponent={
                  <View style={styles.emptyHorizontal}>
                    <View style={[styles.emptyIconCircle, { backgroundColor: '#f0fdf4' }]}>
                      <MaterialCommunityIcons name="tag-outline" size={28} color="#16a34a" />
                    </View>
                    <Text style={styles.emptyTitle}>No deals right now</Text>
                    <Text style={styles.emptySubtitle}>Check back later for great prices</Text>
                    <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: '#84cc16' }]} onPress={() => router.push('/filter')}>
                      <Text style={styles.emptyBtnText}>Explore Products</Text>
                    </TouchableOpacity>
                  </View>
                }
              />
            </>
          )}
        </Animated.ScrollView>

        {/* Floating Chat Button */}
        <TouchableOpacity
          style={styles.floatingChatBtn}
          onPress={() => router.push('/chat')}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#0C1559', '#1e3a8a']}
            style={styles.floatingGradient}
          >
            <MaterialCommunityIcons name="chat-processing" size={28} color="#FFF" />
            <View style={styles.unreadChatDot} />
          </LinearGradient>
        </TouchableOpacity>

        <BottomNav />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e9f0ff',
  },
  
  // Top Section
  topSection: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  locationText: { fontSize: 14, fontWeight: '500', marginLeft: 4, marginRight: 2 },

  logoSearchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logoContainer: { flexDirection: 'row', alignItems: 'center' },
  logoImage: { width: 99, height: 32 },

  searchAndIcons: { flexDirection: 'row', alignItems: 'center', flex: 1, marginLeft: 12 },
  searchInputWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginRight: 10 },
  searchInput: { flex: 1, marginLeft: 8, marginRight: 8, height: 24, fontSize: 13 },

  notificationIcon: { position: 'relative', padding: 4 },
  notificationDot: { position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: 4, backgroundColor: '#ff0101ff' },

  // Banner
  bannerContainer: { marginHorizontal: 16, marginTop: 12, height: 180, overflow: 'hidden', borderRadius: 16 },
  bannerImageBg: { flex: 1, width: '100%', height: '100%' },

  // Chips
  chipsContainer: { paddingHorizontal: 16, paddingVertical: 12 },
  chip: { paddingVertical: 8, paddingHorizontal: 16, marginRight: 10, borderWidth: 1, borderRadius: 20, elevation: 1 },
  chipText: { fontSize: 13, fontWeight: '600' },

  // Headers
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 16, marginTop: 24, marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  seeAllText: { fontSize: 13, fontWeight: '600' },

  // Recent
  recentList: { paddingLeft: 16, paddingBottom: 20 },
  productCard: { width: 160, borderRadius: 16, elevation: 4, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8 },
  productImage: { width: '100%', height: 120, resizeMode: 'cover' },
  productInfo: { padding: 12 },
  productTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  productCategory: { fontSize: 12, marginBottom: 8 },
  priceRow: { flexDirection: 'row', alignItems: 'center' },
  currentPrice: { fontSize: 15, fontWeight: '700' },

  // Deals
  dealsList: { paddingLeft: 16, paddingBottom: 30 },
  dealCard: { width: 140, borderRadius: 16, marginRight: 16, elevation: 4, overflow: 'hidden', alignItems: 'center', padding: 0, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8 },
  dealImage: { width: '100%', height: 100, resizeMode: 'cover' },
  dealTitle: { fontSize: 13, fontWeight: '600', marginTop: 10, marginHorizontal: 8, textAlign: 'center' },
  dealPrice: { fontSize: 14, fontWeight: '700', marginTop: 6, marginBottom: 10, color: '#0d3804' },

  // Empty state (horizontal)
  emptyHorizontal: { width: width - 64, marginLeft: 16, backgroundColor: '#FFF', borderRadius: 20, paddingVertical: 32, paddingHorizontal: 24, alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
  emptyIconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  emptyTitle: { fontSize: 15, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginBottom: 4 },
  emptySubtitle: { fontSize: 13, fontFamily: 'Montserrat-Regular', color: '#94A3B8', textAlign: 'center', marginBottom: 16, lineHeight: 18 },
  emptyBtn: { backgroundColor: '#1e3a8a', paddingHorizontal: 20, paddingVertical: 9, borderRadius: 20 },
  emptyBtnText: { color: '#FFF', fontSize: 13, fontFamily: 'Montserrat-Bold' },

  // Search Results
  searchResultsContainer: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 20 },
  searchResultCard: {
    width: (width - 48) / 2,
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  searchResultImage: { width: '100%', height: 120, resizeMode: 'cover' },
  searchResultInfo: { padding: 8 },
  searchResultTitle: { fontSize: 13, fontWeight: '600', color: '#0F172A', marginBottom: 4 },
  searchResultPrice: { fontSize: 14, fontWeight: '700', color: '#0d3804' },
  noResultsContainer: { alignItems: 'center', marginTop: 50 },
  noResultsText: { marginTop: 10, fontSize: 16, color: '#64748B', fontFamily: 'Montserrat-Medium' },

  // Bottom Area
  bottomLogos: { position: 'absolute', bottom: -10, left: -50 },
  fadedLogo: { width: 130, height: 130, resizeMode: 'contain', opacity: 0.12 },

  // Floating Chat
  floatingChatBtn: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    shadowColor: "#0C1559",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
    zIndex: 100,
  },
  floatingGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadChatDot: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#84cc16',
    borderWidth: 1.5,
    borderColor: '#0C1559',
  }
});