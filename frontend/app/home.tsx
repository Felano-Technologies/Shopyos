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

const FEATURED_ITEMS = [
  { id: 'f1', image: require('../assets/images/featured/feat1.jpg') },
  { id: 'f2', image: require('../assets/images/featured/feat2.jpg') },
  { id: 'f3', image: require('../assets/images/featured/feat3.jpg') },
  { id: 'f4', image: require('../assets/images/featured/feat4.jpg') },
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
  const theme = useColorScheme();
  const isDarkMode = theme === 'dark';
  const router = useRouter();

  const [locationText, setLocationText] = useState<'Locating…' | string>('Locating…');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCat, setSelectedCat] = useState<string>('All');

  const [animationValues, setAnimationValues] = useState<Animated.Value[]>([]);
  const scrollY = useRef(new Animated.Value(0)).current;



  // Derived list of chip categories
  const allCategoryNames = ['All', ...CATEGORIES.map((c) => c.label)];

  // Filtered recent products according to selected category
  const filteredRecent =
    selectedCat === 'All'
      ? RECENT_PRODUCTS
      : RECENT_PRODUCTS.filter((p) => p.category === selectedCat);

  // --- Auto-scrolling “Featured” FlatList state & ref ---
  const featuredRef = useRef<FlatList<any>>(null);
  const [featuredIndex, setFeaturedIndex] = useState(0);

  useEffect(() => {
    // Simulate data loading
    setTimeout(() => {
      setLoading(false);

      // Initialize animation values for recent products
      const vals = RECENT_PRODUCTS.map(() => new Animated.Value(0));
      setAnimationValues(vals);

      // Staggered fade-in for recent products
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

    // Fetch location once
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationText('Permission denied');
          return;
        }
        const {
          coords: { latitude, longitude },
        } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
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

  // Set up interval to auto-scroll “Featured” every 3 seconds
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
    // Simulate re-fetch
    await new Promise((r) => setTimeout(r, 1000));
    setRefreshing(false);
  };

  const renderRecent = ({
    item,
    index,
  }: {
    item: typeof RECENT_PRODUCTS[0];
    index: number;
  }) => (
    <Animated.View
      style={{
        opacity: animationValues[index],
        transform: [
          {
            scale: animationValues[index].interpolate({
              inputRange: [0, 1],
              outputRange: [0.85, 1],
            }),
          },
        ],
        marginRight: 16,
      }}
    >
      <BlurView
        intensity={40}
        tint={isDarkMode ? 'dark' : 'light'}
        style={[
          styles.productCard,
          { backgroundColor: isDarkMode ? '#1E1E1E' : '#FFF' },
        ]}
      >
        <Image source={item.image} style={styles.productImage} />
        <TouchableOpacity style={styles.heartIcon}>
          <Ionicons name="heart-outline" size={20} color="#E11D48" />
        </TouchableOpacity>
        <View style={styles.productInfo}>
          <Text
            style={[
              styles.productTitle,
              { color: isDarkMode ? '#EDEDED' : '#222' },
            ]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          <Text
            style={[
              styles.productCategory,
              { color: isDarkMode ? '#AAA' : '#666' },
            ]}
          >
            {item.category}
          </Text>
          <View style={styles.priceRow}>
            <Text
              style={[
                styles.currentPrice,
                { color: isDarkMode ? '#EDEDED' : '#222' },
              ]}
            >
              ₵{item.price.toFixed(2)}
            </Text>
            <Text style={styles.oldPrice}>₵{item.oldPrice.toFixed(2)}</Text>
          </View>
        </View>
      </BlurView>
    </Animated.View>
  );

  const renderDeal = ({ item }: { item: typeof DEALS_FOR_YOU[0] }) => (
    <TouchableOpacity
      style={[
        styles.dealCard,
        { backgroundColor: isDarkMode ? '#1E1E1E' : '#FFF' },
      ]}
    >
      <Image source={item.image} style={styles.dealImage} />
      <Text
        style={[
          styles.dealTitle,
          { color: isDarkMode ? '#EDEDED' : '#222' },
        ]}
        numberOfLines={1}
      >
        {item.title}
      </Text>
      <Text
        style={[
          styles.dealPrice,
          { color: isDarkMode ? '#EDEDED' : '#222' },
        ]}
      >
        ₵{item.price.toFixed(2)}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    // Skeleton placeholders while loading
    return (
      <SafeAreaView
        style={[
          styles.container,
          { backgroundColor: isDarkMode ? '#121212' : '#F8F8F8' },
        ]}
      >
        <View style={styles.skeletonHeader} />
        <View style={styles.skeletonBanner} />
        <View style={styles.skeletonChips} />
        <View style={styles.skeletonRow} />
        <View style={styles.skeletonRow} />
        <ActivityIndicator
          size="large"
          color={isDarkMode ? '#4F46E5' : '#4F46E5'}
        />
        <BottomNav />
      </SafeAreaView>
    );
  }

  return (
        <LinearGradient
      colors={isDarkMode ? ['#0F0F1A', '#1A1A2E'] : ['#FDFBFB', '#EBEDEE']}
      style={{ flex: 1 }}
    >
      <StatusBar style={isDarkMode ? 'light' : 'dark'} translucent backgroundColor="transparent" />
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: isDarkMode ? '#121212' : '#F8F8F8' },
      ]}
    >
      <Animated.ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
      >


        {/* Location + Search Row */}
        <View style={styles.topSection}>
          <TouchableOpacity style={styles.locationRow}>
            <Ionicons
              name="location-sharp"
              size={20}
              color={isDarkMode ? '#EDEDED' : '#222'}
            />
            <Text
              style={[
                styles.locationText,
                { color: isDarkMode ? '#EDEDED' : '#222' },
              ]}
            >
              {locationText}
            </Text>
            <Ionicons
              name="chevron-down"
              size={18}
              color={isDarkMode ? '#EDEDED' : '#222'}
            />
          </TouchableOpacity>
          <View style={styles.searchRow}>
            <BlurView
              intensity={100}
              tint={isDarkMode ? 'dark' : 'light'}
              style={[
                styles.searchInputWrapper,
                { backgroundColor: isDarkMode ? '#1E1E1E' : '#FFF' },
              ]}
            >
              <Feather
                name="search"
                size={18}
                color={isDarkMode ? '#AAA' : '#666'}
              />
              <TextInput
                placeholder="Search here..."
                placeholderTextColor={isDarkMode ? '#AAA' : '#666'}
                style={[
                  styles.searchInput,
                  { color: isDarkMode ? '#EDEDED' : '#222' },
                ]}
              />
            </BlurView>
            <TouchableOpacity onPress={() => router.push('/filter')}>
              <BlurView
                intensity={40}
                tint={isDarkMode ? 'dark' : 'light'}
                style={[
                  styles.filterBtn,
                  { backgroundColor: isDarkMode ? '#1E1E1E' : '#FFF' },
                ]}
              >
                <Feather
                  name="sliders"
                  size={20}
                  color={isDarkMode ? '#AAA' : '#666'}
                />
              </BlurView>
            </TouchableOpacity>
          </View>
        </View>

        {/* Parallax Banner with Overlay */}
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
                {
                  scale: scrollY.interpolate({
                    inputRange: [-150, 0],
                    outputRange: [1.2, 1],
                    extrapolate: 'clamp',
                  }),
                },
              ],
            },
          ]}
        >
          <ImageBackground
            source={require('../assets/images/liquidglass.jpg')}
            style={styles.bannerImage}
            imageStyle={{ borderRadius: 12 }}
          >
            <BlurView
            intensity={40}
            tint={isDarkMode ? 'dark' : 'light'}
            style={styles.bannerOverlay}>
              <Image
               source={require('../assets/images/icondark.png')}
               style={styles.bannerIcon}
              />
              <Text style={styles.bannerSubtitle}>
                Your go-to app for the latest apparels, sneakers, gadgets and
                accessories from artisans around you. Shop trendy and unique
                items from local artisans. Right here in Ghana.
              </Text>
              <TouchableOpacity style={styles.shopNowBtn}>
                <Text style={styles.shopNowText}>Shop Now</Text>
              </TouchableOpacity>
            </BlurView>
          </ImageBackground>
        </Animated.View>

        {/* Category Chips */}
        <View style={styles.chipsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {allCategoryNames.map((cat) => {
              const isActive = selectedCat === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setSelectedCat(cat)}>
                  <BlurView
                    intensity={40}
                    tint={isDarkMode ? 'dark' : 'light'}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isActive
                        ? '#4F46E5'
                        : isDarkMode
                        ? '#1E1E1E'
                        : '#FFF',
                      borderColor: isActive
                        ? '#4F46E5'
                        : isDarkMode
                        ? '#333'
                        : '#DDD',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      {
                        color: isActive
                          ? '#FFF'
                          : isDarkMode
                          ? '#AAA'
                          : '#666',
                      },
                    ]}
                  >
                    {cat}
                  </Text>
                  </BlurView>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Featured “Carousel” as simple horizontal FlatList */}
        <View style={{ paddingTop: 10 }}>
          <FlatList
            ref={featuredRef}
            data={FEATURED_ITEMS}
            keyExtractor={(item) => item.id}
            horizontal
            pagingEnabled={false}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16 }}
            renderItem={({ item }) => (
              <ImageBackground
                source={item.image}
                style={{
                  width: width - 32,
                  height: 160,
                  borderRadius: 12,
                  marginRight: 16,
                }}
                imageStyle={{ borderRadius: 12 }}
              />
            )}
            getItemLayout={(_, index) => ({
              length: width - 16,        // (width - 32) + 16 margin
              offset: (width - 16) * index,
              index,
            })}
          />
        </View>

        {/* Recently Added */}
        <View style={styles.sectionHeader}>
          <Text
            style={[
              styles.sectionTitle,
              { color: isDarkMode ? '#EDEDED' : '#222' },
            ]}
          >
            Recently Added
          </Text>
          <TouchableOpacity onPress={() => router.push('/recent')}>
            <Text style={[styles.seeAllText, { color: '#A1A1AA' }]}>
              See All
            </Text>
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
          <Text
            style={[
              styles.sectionTitle,
              { color: isDarkMode ? '#EDEDED' : '#222' },
            ]}
          >
            Deals for You
          </Text>
          <TouchableOpacity onPress={() => router.push('/deals')}>
            <Text style={[styles.seeAllText, { color: '#A1A1AA' }]}>
              See All
            </Text>
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

      {/* Bottom Navigation */}
      <BottomNav />
    </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    paddingTop: 0,
    paddingBottom: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  locationText: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 6,
    marginRight: 4,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 10,
    elevation: 2,
    backgroundColor: 'rgba(255,255,255,0.05)', 

  },
  searchInput: {
    flex: 1,
    marginLeft: 6,
    height: 36,
    fontSize: 14,
  },
  filterBtn: {
    width: 44,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
      backgroundColor: 'rgba(255,255,255,0.05)', 
  },

  // Parallax Banner
  bannerContainer: {
    marginHorizontal: 16,
    marginTop: 10,
    height: 160,
    overflow: 'hidden',
    borderRadius: 12,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerIcon: {
    width: 120,
    height: 30,
  },
  bannerOverlay: {
    flex: 1,
    padding: 12,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 12,
  },
  bannerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
    fontFamily: 'UnicialAntiqua-Regular',
  },
  bannerSubtitle: {
    fontSize: 12,
    color: '#FFF',
    marginVertical: 6,
    lineHeight: 16,
  },
  shopNowBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFF',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  shopNowText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
  },

  // Category Chips
  chipsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginRight: 8,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
  },

  // Section Headers
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '500',
  },

  // Recently Added Cards
  recentList: {
    paddingLeft: 16,
    paddingBottom: 20,
  },
  productCard: {
    width: 160,
    borderRadius: 12,
    marginRight: 16,
    elevation: 3,
    backgroundColor: 'rgba(255,255,255,0.05)', 
    padding: 8,
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: 110,
    resizeMode: 'cover',
  },
  heartIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 16,
    padding: 4,
  },
  productInfo: {
    padding: 8,
  },
  productTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  productCategory: {
    fontSize: 12,
    marginBottom: 6,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentPrice: {
    fontSize: 14,
    fontWeight: '600',
  },
  oldPrice: {
    fontSize: 12,
    textDecorationLine: 'line-through',
    color: '#A1A1AA',
    marginLeft: 6,
  },

  // Deals for You
  dealsList: {
    paddingLeft: 16,
    paddingBottom: 20,
  },
  dealCard: {
    width: 140,
    borderRadius: 12,
    marginRight: 16,
    elevation: 3,
    overflow: 'hidden',
    alignItems: 'center',
    padding: 8,
    marginBottom: 45,
    backgroundColor: 'rgba(255,255,255,0.05)', // glassy
  },
  dealImage: {
    width: '100%',
    height: 80,
    resizeMode: 'cover',
    borderRadius: 8,
  },
  dealTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 8,
  },
  dealPrice: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },

  // Floating Action Button
  fab: {
    position: 'absolute',
    bottom: 80,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
});
