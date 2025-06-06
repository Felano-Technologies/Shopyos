// app/DiosHome.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  FlatList,
  TouchableOpacity,
  ImageBackground,
  StyleSheet,
  SafeAreaView,
  useColorScheme,
  ScrollView,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import BottomNav from '@/components/BottomNav';
import { router, useRouter } from 'expo-router';
import * as Location from 'expo-location';

export default function DiosHome() {
  const theme = useColorScheme();
  const isDarkMode = theme === 'dark';
  const navigation = useRouter(); // for navigation inside renderItem

  // Location state
  const [locationText, setLocationText] = useState<'Locating…' | string>('Locating…');

  useEffect(() => {
    (async () => {
      try {
        // a) Ask user for foreground location permission
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationText('Permission denied');
          return;
        }

        // b) Get current position (latitude, longitude)
        const {
          coords: { latitude, longitude },
        } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });

        // c) Reverse-geocode into city/country
        const [reverseInfo] = await Location.reverseGeocodeAsync({ latitude, longitude });

        // d) Compose “City, Region” or “City, Country”
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

  // Colors
  const bgColor = isDarkMode ? '#121212' : '#F8F8F8';
  const cardBg = isDarkMode ? '#1E1E1E' : '#FFF';
  const primaryText = isDarkMode ? '#EDEDED' : '#222';
  const secondaryText = isDarkMode ? '#AAA' : '#666';
  const inputBg = isDarkMode ? '#1E1E1E' : '#FFF';

  // Sample category data (replace image sources with your own)
  const categories = [
    {
      id: 'c1',
      label: 'Sneakers',
      image: require('../assets/images/categories/sneakers.jpg'),
    },
    {
      id: 'c2',
      label: 'Headsets',
      image: require('../assets/images/categories/headset.jpg'),
    },
    {
      id: 'c3',
      label: 'Jackets',
      image: require('../assets/images/categories/jacket.jpg'),
    },
    {
      id: 'c4',
      label: 'Art',
      image: require('../assets/images/categories/art.jpg'),
    },
  ];

  // Sample “Recently Added” products (replace images/prices as needed)
  const recentProducts = [
    {
      id: 'p1',
      title: 'Artwork 1',
      category: 'Art',
      price: 195.0,
      oldPrice: 244.0,
      image: require('../assets/images/products/artwork2.jpg'),
    },
    {
      id: 'p2',
      title: 'Nike Air Force 1 (Long)',
      category: 'Sneakers',
      price: 195.0,
      oldPrice: 285.0,
      image: require('../assets/images/products/nike.jpg'),
    },
  ];

  return (
  
    <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      {/* ─────────── Location + Search Row ─────────── */}
      <View style={styles.topSection}>
        {/* Location */}
        <TouchableOpacity
          style={styles.locationRow}
          onPress={() => {
            // If you want a manual “refresh” of location when tapping, re-run the same logic
          }}
        >
          <Ionicons name="location-sharp" size={20} color={primaryText} />
          <Text style={[styles.locationText, { color: primaryText }]}>
            {locationText}
          </Text>
          <Ionicons name="chevron-down" size={18} color={primaryText} />
        </TouchableOpacity>

        {/* Search Bar + Filter Button */}
        <View style={styles.searchRow}>
          <View style={[styles.searchInputWrapper, { backgroundColor: inputBg }]}>
            <Feather name="search" size={18} color={secondaryText} />
            <TextInput
              placeholder="Search here..."
              placeholderTextColor={secondaryText}
              style={[styles.searchInput, { color: primaryText }]}
            />
          </View>

          <TouchableOpacity
            style={[styles.filterBtn, { backgroundColor: inputBg }]}
            onPress={() => {
              // Navigate to filter screen (if implemented)
              router.push('/filter');
            }}
          >
            <Feather name="sliders" size={20} color={secondaryText} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ─────────── Promotional Banner ─────────── */}
      <View style={styles.bannerContainer}>
        <ImageBackground
          source={require('../assets/images/products/artwork.jpg')}
          style={styles.bannerImage}
          imageStyle={{ borderRadius: 12 }}
        >
          <View style={styles.bannerOverlay}>
            <Text style={styles.bannerTitle}>DIOS</Text>
            <Text style={styles.bannerSubtitle}>
              Your go-to app for the latest apparels, sneakers, gadgets and accessories from artisans around you. Shop trendy and unique items from local artisans. Right here in Ghana.
            </Text>
            <TouchableOpacity style={styles.shopNowBtn}>
              <Text style={styles.shopNowText}>Shop Now</Text>
            </TouchableOpacity>
          </View>
        </ImageBackground>
      </View>

      {/* ─────────── Categories Section ─────────── */}
      <View style={styles.categoriesHeader}>
        <Text style={[styles.sectionTitle, { color: primaryText }]}>
          Categories
        </Text>
        {/* Updated the route to /categories/categories */}
        <TouchableOpacity onPress={() => navigation.push('/categories/categories')}>
          <Text style={[styles.seeAllText, { color: '#A1A1AA' }]}>
            See All
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={categories}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoriesList}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.categoryCard}
            onPress={() => {
              // Navigate to /categories/categories/{item.id}
              navigation.push(`/categories/categories/${item.id}`);
            }}
          >
            <View style={styles.categoryCircle}>
              <Image source={item.image} style={styles.categoryImage} />
            </View>
            <Text style={[styles.categoryLabel, { color: primaryText }]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* ─────────── Recently Added Section ─────────── */}
      <View style={styles.recentHeader}>
        <Text style={[styles.sectionTitle, { color: primaryText }]}>
          Recently Added
        </Text>
        <TouchableOpacity onPress={() => router.push('/recent')}>
          <Text style={[styles.seeAllText, { color: '#A1A1AA' }]}>
            See All
          </Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={recentProducts}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.recentList}
        renderItem={({ item }) => (
          <View style={[styles.productCard, { backgroundColor: cardBg }]}>
            <Image source={item.image} style={styles.productImage} />
            <TouchableOpacity style={styles.heartIcon}>
              <Ionicons name="heart-outline" size={20} color="#E11D48" />
            </TouchableOpacity>
            <View style={styles.productInfo}>
              <Text
                style={[styles.productTitle, { color: primaryText }]}
                numberOfLines={1}
              >
                {item.title}
              </Text>
              <Text style={[styles.productCategory, { color: secondaryText }]}>
                {item.category}
              </Text>
              <View style={styles.priceRow}>
                <Text style={[styles.currentPrice, { color: primaryText }]}>
                  ${item.price.toFixed(2)}
                </Text>
                <Text style={styles.oldPrice}>${item.oldPrice.toFixed(2)}</Text>
              </View>
            </View>
          </View>
        )}
      />
    </ScrollView>
      {/* ─────────── Bottom Navigation ─────────── */}
      <BottomNav />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingBottom: 70, // leave space for BottomNav
  },

  // ───── Top Section ─────
  topSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
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
  },

  // ───── Promotional Banner ─────
  bannerContainer: {
    marginHorizontal: 16,
    marginVertical: 10,
  },
  bannerImage: {
    width: '100%',
    height: 150,
    justifyContent: 'flex-end',
  },
  bannerOverlay: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    padding: 12,
  },
  bannerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
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

  // ───── Categories ─────
  categoriesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '500',
  },
  categoriesList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  categoryCard: {
    marginRight: 16,
    alignItems: 'center',
  },
  categoryCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    overflow: 'hidden',
    marginBottom: 6,
    backgroundColor: '#EFEFEF',
  },
  categoryImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  categoryLabel: {
    fontSize: 13,
    fontWeight: '500',
  },

  // ───── Recently Added ─────
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 24,
    marginBottom: 8,
  },
  recentList: {
    paddingLeft: 16,
    paddingBottom: 16,
  },
  productCard: {
    width: 160,
    borderRadius: 12,
    marginRight: 16,
    elevation: 3,
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
});
