// app/home.tsx
import React, { useEffect, useState, useRef } from 'react';
import {View,Text,Image,ImageBackground,TextInput,FlatList,TouchableOpacity, StyleSheet,useColorScheme, Animated,RefreshControl,Dimensions, ScrollView,ActivityIndicator,} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import BottomNav from '@/components/BottomNav';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';



const { width } = Dimensions.get('window');

const CATEGORIES = [
  { id: 'c1', label: 'Sneakers', image: require('../assets/images/categories/sneakers.jpg') },
  { id: 'c2', label: 'Headsets', image: require('../assets/images/categories/headset.jpg') },
  { id: 'c3', label: 'Jackets', image: require('../assets/images/categories/jacket.jpg') },
  { id: 'c4', label: 'Art', image: require('../assets/images/categories/art.jpg') },
  { id: 'c5', label: 'more', image: null },
];

const RECENT_PRODUCTS = [
  {
    id: 'p1',
    title: 'The Dad Artwork',
    category: 'Art',
    price: 250.0,
    oldPrice: 350.0,
    image: require('../assets/images/products/artwork2.jpg'),
  },
  {
    id: 'p2',
    title: 'Nike Air Force 1 (Long)',
    category: 'Sneakers',
    price: 175.0,
    oldPrice: 300.0,
    image: require('../assets/images/products/nike.jpg'),
  },
];

// Updated to include details for navigation
const FEATURED_ITEMS = [
  { id: 'f1', title: 'Summer Collection', price: 150.0, image: require('../assets/images/featured/feat1.jpg') },
  { id: 'f2', title: 'Urban Streetwear', price: 220.0, image: require('../assets/images/featured/feat2.jpg') },
  { id: 'f3', title: 'Classic Fits', price: 180.0, image: require('../assets/images/featured/feat3.jpg') },
  { id: 'f4', title: 'New Arrivals', price: 300.0, image: require('../assets/images/featured/feat4.jpg') },
];

const DEALS_FOR_YOU = [
  {
    id: 'd1',
    title: 'Limited Edition Sneakers',
    price: 199.0,
    image: require('../assets/images/products/nike.jpg'),
  },
  {
    id: 'd2',
    title: 'Artisan Jacket',
    price: 120.0,
    image: require('../assets/images/categories/jacket.jpg'),
  },
];

export default function Home() {
  const router = useRouter();

  const [locationText, setLocationText] = useState<'Locating…' | string>('Locating…');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCat, setSelectedCat] = useState<string>('All');

  const [animationValues, setAnimationValues] = useState<Animated.Value[]>([]);
  const scrollY = useRef(new Animated.Value(0)).current;

  // Derived list of chip categories
  const allCategoryNames = ['All', ...CATEGORIES.filter(c => c.label !== 'more').map((c) => c.label)];

  // Filtered recent products
  const filteredRecent =
    selectedCat === 'All'
      ? RECENT_PRODUCTS
      : RECENT_PRODUCTS.filter((p) => p.category === selectedCat);

  // --- Auto-scrolling "Featured" FlatList state & ref ---
  const featuredRef = useRef<FlatList<any>>(null);
  const [featuredIndex, setFeaturedIndex] = useState(0);

  useEffect(() => {
    // Simulate data loading
    setTimeout(() => {
      setLoading(false);
      // Initialize animation values
      const vals = RECENT_PRODUCTS.map(() => new Animated.Value(0));
      setAnimationValues(vals);
      // Staggered fade-in
      const animations = vals.map((anim, i) =>
        Animated.timing(anim, {
          toValue: 1,
          duration: 500,
          delay: i * 200,
          useNativeDriver: true,
        })
      );
      Animated.stagger(150, animations).start();
    }, 2000);

    // Fetch location
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationText('Permission denied');
          return;
        }
        const { coords: { latitude, longitude } } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
        const [reverseInfo] = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (reverseInfo) {
          const { city, region, country } = reverseInfo;
          const cityPart = city ?? region ?? country ?? 'Unknown';
          const countryPart = country ?? region ?? '';
          setLocationText(`${cityPart}${countryPart ? `, ${countryPart}` : ''}`);
        } else {
          setLocationText('Unknown Location');
        }
      } catch (e) {
        console.warn('Location error:', e);
        setLocationText('Location error');
      }
    })();
  }, []);

  // Auto-scroll Featured
  useEffect(() => {
    const intervalId = setInterval(() => {
      setFeaturedIndex((prev) => {
        const next = (prev + 1) % FEATURED_ITEMS.length;
        if (featuredRef.current) {
          featuredRef.current.scrollToIndex({ index: next, animated: true });
        }
        return next;
      });
    }, 3000);
    return () => clearInterval(intervalId);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 1000));
    setRefreshing(false);
  };

  // Helper to navigate to product details
  const goToDetails = (item: any) => {
    router.push({
      pathname: '/product/details',
      params: {
        id: item.id,
        title: item.title,
        price: item.price,
        oldPrice: item.oldPrice,
        category: item.category,
        image: item.image // Passes the number (asset ID)
      }
    });
  };

  const renderRecent = ({ item, index }: { item: typeof RECENT_PRODUCTS[0]; index: number }) => (
    <Animated.View
      style={{
        opacity: animationValues[index],
        transform: [{ scale: animationValues[index].interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
        marginRight: 16,
      }}
    >
      <TouchableOpacity
        style={[styles.productCard, { backgroundColor: '#111827' }]}
        activeOpacity={0.8}
        onPress={() => goToDetails(item)}
      >
        <Image source={item.image} style={styles.productImage} />
        <View style={styles.productInfo}>
          <Text style={[styles.productTitle, { color: '#f3f4f6' }]} numberOfLines={1}>{item.title}</Text>
          <Text style={[styles.productCategory, { color: '#64748B' }]}>{item.category}</Text>
          <View style={styles.priceRow}>
            <Text style={[styles.currentPrice, { color: '#84cc16' }]}>₵{item.price.toFixed(2)}</Text>
            <Text style={styles.oldPrice}>₵{item.oldPrice.toFixed(2)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderDeal = ({ item }: { item: typeof DEALS_FOR_YOU[0] }) => (
    <TouchableOpacity 
        style={[styles.dealCard, { backgroundColor: '#111827' }]}
        activeOpacity={0.8}
        onPress={() => goToDetails(item)}
    >
      <Image source={item.image} style={styles.dealImage} />
      <Text style={[styles.dealTitle, { color: '#f3f4f6' }]} numberOfLines={2}>{item.title}</Text>
      <Text style={styles.dealPrice}>₵{item.price.toFixed(2)}</Text>
    </TouchableOpacity>
  );

  const renderFeatured = ({ item }: { item: typeof FEATURED_ITEMS[0] }) => (
    <TouchableOpacity 
      style={styles.featuredCard} 
      activeOpacity={0.9}
      onPress={() => goToDetails(item)}
    >
        <ImageBackground
            source={item.image}
            style={styles.featuredImage}
            imageStyle={{ borderRadius: 16 }}
        >
            <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.6)']}
            style={styles.featuredOverlay}
            >
                <View style={styles.featuredTextContainer}>
                    <Text style={styles.featuredTitle}>{item.title}</Text>
                    <Text style={styles.featuredPrice}>From ₵{item.price}</Text>
                </View>
            </LinearGradient>
        </ImageBackground>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: '#E9F0FF' }]}>
        <SafeAreaView style={{ flex: 1 }}>
          <ActivityIndicator size="large" color="#1e3a8a" style={{marginTop: 50}} />
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: '#E9F0FF' }]}>
      <StatusBar style="dark" translucent backgroundColor="transparent" />
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
                    placeholder="Search here..."
                    placeholderTextColor="rgba(255,255,255,0.8)"
                    style={[styles.searchInput, { color: '#FFF' }]}
                  />
                  <TouchableOpacity onPress={() => router.push('/filter')}>
                    <Feather name="sliders" size={16} color="#FFF" />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.notificationIcon} onPress={() => router.push('/cart')}>
                  <Ionicons name="cart" size={22} color="#1e3a8a" />
                  <View style={styles.notificationDot} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Enhanced Banner (Now Clickable) */}
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
                onPress={() => router.push({ pathname: '/product/details', params: { title: 'Special Offer', price: 99, image: require('../assets/images/banner1.png') }})}
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

          {/* Featured "Carousel" (Now Clickable) */}
          <View style={{ paddingTop: 10 }}>
            <FlatList
              ref={featuredRef}
              data={FEATURED_ITEMS}
              keyExtractor={(item) => item.id}
              horizontal
              pagingEnabled={false}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16 }}
              renderItem={renderFeatured}
              getItemLayout={(_, index) => ({
                length: width - 16,
                offset: (width - 16) * index,
                index,
              })}
            />
          </View>

          {/* Recently Added */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: '#222' }]}>Recently Added</Text>
            <TouchableOpacity onPress={() => router.push('/recent')}>
              <Text style={[styles.seeAllText, { color: '#64748B' }]}>See All</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={filteredRecent}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.recentList}
            renderItem={renderRecent}
          />

          {/* Deals for You */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: '#222' }]}>Deals for You</Text>
            <TouchableOpacity onPress={() => router.push('/deals')}>
              <Text style={[styles.seeAllText, { color: '#64748B' }]}>See All</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={DEALS_FOR_YOU}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dealsList}
            renderItem={renderDeal}
          />
        </Animated.ScrollView>

        {/* Bottom Background & Nav */}
        <ImageBackground source={require('../assets/images/icon.png')} style={styles.background}>
          <View style={styles.bottomLogos}>
            <Image source={require('../assets/images/splash-icon.png')} style={styles.fadedLogo} />
          </View>
        </ImageBackground>
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
  // Skeleton placeholders
  skeletonHeader: {
    height: 60,
    margin: 16,
    borderRadius: 12,
    backgroundColor: '#333',
  },
  skeletonBanner: {
    height: 160,
    marginHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#333',
  },
  skeletonChips: {
    height: 40,
    marginTop: 12,
    marginHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#333',
  },
  skeletonRow: {
    height: 120,
    marginTop: 20,
    marginHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#333',
  },


  // Top Section (Location + Search)
  topSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  locationText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
    marginRight: 2,
  },

  // Logo and Search Row
  logoSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoImage: {
    width: 99,
    height: 32,
  },

  searchAndIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 12,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    marginRight: 8,
    height: 24,
    fontSize: 13,
  },
  notificationIcon: {
    position: 'relative',
    padding: 4,
  },
  notificationDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff0101ff',
  },

  // Enhanced Banner
  bannerContainer: {
    marginHorizontal: 16,
    marginTop: 12,
    height: 180,
    overflow: 'hidden',
    borderRadius: 16,
  },
  bannerImageBg: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  bannerGradientOverlay: {
    flex: 1,
    borderRadius: 16,
  },
  bannerContent: {
    flex: 1,
    flexDirection: 'row',
    padding: 16,
  },
  bannerLeftContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  bannerIcon: {
    width: 100,
    height: 28,
    marginBottom: 8,
  },
  bannerSubtitle: {
    fontSize: 11,
    color: '#FFF',
    lineHeight: 15,
    marginBottom: 12,
    opacity: 0.95,
  },
  shopNowBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFF',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  shopNowText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111',
  },

  // Banner Illustration
  bannerIllustration: {
    width: 140,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  floatingCard1: {
    position: 'absolute',
    top: 10,
    right: -10,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 8,
    padding: 8,
  },
  floatingCard2: {
    position: 'absolute',
    bottom: 15,
    left: -15,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 8,
    padding: 8,
  },

  // Category Chips
  chipsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 10,
    borderWidth: 1,
    borderRadius: 20,
    elevation: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Featured Cards
  featuredCard: {
    width: width - 32,
    height: 150,
    borderRadius: 16,
    marginRight: 16,
    overflow: 'hidden',
    elevation: 3,
  },
  featuredImage: {
    width: '100%',
    height: '100%',
  },
  featuredOverlay: {
    flex: 1,
    borderRadius: 16,
  },

  // Section Headers
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Recently Added Cards
  recentList: {
    paddingLeft: 16,
    paddingBottom: 20,
  },
  productCard: {
    width: 160,
    borderRadius: 16,
    elevation: 4,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  productImage: {
    width: '100%',
    height: 120,
    resizeMode: 'cover',
  },
  heartIcon: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 20,
    padding: 6,
    elevation: 2,
  },
  productInfo: {
    padding: 12,
  },
  productTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  productCategory: {
    fontSize: 12,
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentPrice: {
    fontSize: 15,
    fontWeight: '700',
  },
  oldPrice: {
    fontSize: 12,
    textDecorationLine: 'line-through',
    color: '#94A3B8',
    marginLeft: 6,
  },

  // Deals for You
  dealsList: {
    paddingLeft: 16,
    paddingBottom: 30,
  },
  dealCard: {
    width: 140,
    borderRadius: 16,
    marginRight: 16,
    elevation: 4,
    overflow: 'hidden',
    alignItems: 'center',
    padding: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  dealImage: {
    width: '100%',
    height: 100,
    resizeMode: 'cover',
  },
  dealTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
    marginHorizontal: 8,
    textAlign: 'center',
  },
  dealPrice: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 6,
    marginBottom: 10,
    color: '#84cc16',
  },
background: {
  flex: 1,
  justifyContent: 'flex-end',
  alignItems: 'center',
},

bottomLogos: {
  position: 'absolute',
  bottom: -50,      // adjust distance from bottom
  left: -50,        // adjust distance from left
},

fadedLogo: {
  width: 130,
  height: 130,
  resizeMode: 'contain',
  opacity: 0.12, // soft fade
},
});