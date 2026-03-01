import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
  Image,
  Keyboard,
  Pressable,
} from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import BottomNav from '../components/BottomNav';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useProducts, useProductSearch } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { SearchSkeleton } from '../components/skeletons/SearchSkeleton';

const { width } = Dimensions.get('window');

export default function SearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { data: categoriesData } = useCategories();
  const categories = categoriesData || [];

  const filters = {
    category: (selectedCategory || params.category) as string | undefined,
    sortBy: params.sortBy as any,
    minPrice: params.minPrice ? parseFloat(params.minPrice as string) : undefined,
    maxPrice: params.maxPrice ? parseFloat(params.maxPrice as string) : undefined,
  };

  const { data: allProductsData, isLoading: isLoadingAll } = useProducts(filters, 50);
  const { data: searchData, isLoading: isSearching } = useProductSearch(searchQuery, filters, 50);

  const loading = searchQuery.length >= 2 ? isSearching : isLoadingAll;
  const products = searchQuery.length >= 2 
    ? (searchData?.success ? searchData.products : [])
    : (allProductsData?.success ? allProductsData.products : []);

  const handleProductPress = (product: any) => {
    router.push({
      pathname: `/product/${product._id}`,
      params: {
        name: product.name,
        price: product.price,
        image: product.images?.[0] || 'https://via.placeholder.com/150'
      }
    } as any);
  };

  const renderProductCard = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.productCard}
      activeOpacity={0.9}
      onPress={() => handleProductPress(item)}
    >
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: item.images?.[0] || 'https://via.placeholder.com/150' }}
          style={styles.productImage}
        />
        <TouchableOpacity style={styles.favoriteBtn}>
            <Ionicons name="heart-outline" size={16} color="#0C1559" />
        </TouchableOpacity>
      </View>

      <View style={styles.productInfo}>
        <Text style={styles.storeName} numberOfLines={1}>{item.store?.name || 'Shopyos'}</Text>
        <Text style={styles.productTitle} numberOfLines={2}>{item.name}</Text>
        
        <View style={styles.priceRow}>
          <Text style={styles.productPrice}>₵{parseFloat(item.price).toFixed(2)}</Text>
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={10} color="#F59E0B" />
            <Text style={styles.ratingText}>{item.averageRating || '0.0'}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderCategoryItem = ({ item }: { item: any }) => {
    const isActive = selectedCategory === item.name;
    return (
      <TouchableOpacity
        style={[styles.catChip, isActive && styles.catChipActive]}
        onPress={() => setSelectedCategory(isActive ? null : item.name)}
      >
        <Text style={[styles.catText, isActive && styles.catTextActive]}>{item.name}</Text>
      </TouchableOpacity>
    );
  };

  // === RENDER SKELETON IF LOADING ===
  if (loading) {
    return (
      <View style={styles.mainContainer}>
        <StatusBar style="dark" translucent backgroundColor="transparent" />
        <SearchSkeleton />
        <BottomNav />
      </View>
    );
  }

  return (
    <Pressable onPress={Keyboard.dismiss} style={{ flex: 1 }}>
      <View style={styles.mainContainer}>
        <StatusBar style="dark" translucent backgroundColor="transparent" />

        {/* --- BACKGROUND WATERMARK LAYER --- */}
        <View style={styles.bottomLogos}>
          <Image
            source={require('../assets/images/splash-icon.png')}
            style={styles.fadedLogo}
          />
        </View>

        <SafeAreaView style={styles.safeContainer} edges={['top', 'left', 'right']}>
          
          {/* Header */}
          <View style={styles.header}>
            <View>
                <Text style={styles.headerSubtitle}>Find your favorite</Text>
                <Text style={styles.headerTitle}>Products</Text>
            </View>
            <TouchableOpacity
              style={styles.filterBtn}
              onPress={() => router.push('/filter' as any)}
            >
              <Feather name="sliders" size={20} color="#0C1559" />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchWrapper}>
            <View style={styles.searchBar}>
              <Feather name="search" size={22} color="#94A3B8" />
              <TextInput
                placeholder="Search everything..."
                placeholderTextColor="#94A3B8"
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn}>
                  <Ionicons name="close" size={16} color="#FFF" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Categories Section */}
          <View style={styles.categoriesSection}>
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Browse Categories</Text>
            </View>
            <FlatList
              horizontal
              data={categories}
              keyExtractor={(item) => item.id || item.name}
              renderItem={renderCategoryItem}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.catList}
            />
          </View>

          {/* Product Grid */}
          <FlatList
            data={products}
            keyExtractor={(item) => item._id}
            numColumns={2}
            contentContainerStyle={styles.gridContent}
            columnWrapperStyle={styles.columnWrapper}
            showsVerticalScrollIndicator={false}
            renderItem={renderProductCard}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <View style={styles.emptyIconBg}>
                    <MaterialCommunityIcons
                      name={searchQuery || selectedCategory ? "archive-search-outline" : "shopping-search"}
                      size={50}
                      color="#0C1559"
                    />
                </View>
                <Text style={styles.emptyTitle}>
                  {searchQuery || selectedCategory ? 'No items found' : 'Start Exploring'}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {searchQuery || selectedCategory
                    ? 'Try using different keywords or removing filters to find what you need.'
                    : 'Search for products, brands, or browse our categories above.'}
                </Text>
              </View>
            }
          />

        </SafeAreaView>

        <BottomNav />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#e9f0ff' }, 
  safeContainer: { flex: 1 },

  // Background Watermark
  bottomLogos: { position: 'absolute', bottom: -10, left: -40 },
  fadedLogo: { width: 150, height: 150, resizeMode: 'contain', opacity: 0.10 },

  // Header
  header: { 
      flexDirection: 'row', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      paddingHorizontal: 20, 
      marginTop: 20, 
      marginBottom: 20 
  },
  headerSubtitle: { fontSize: 14, fontFamily: 'Montserrat-Medium', color: '#64748B', marginBottom: 2 },
  headerTitle: { fontSize: 28, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
  filterBtn: { 
      width: 48, 
      height: 48, 
      borderRadius: 16, 
      backgroundColor: '#FFF', 
      justifyContent: 'center', 
      alignItems: 'center', 
      shadowColor: '#0C1559', 
      shadowOpacity: 0.08, 
      shadowRadius: 10, 
      elevation: 4 
  },

  // Search
  searchWrapper: { paddingHorizontal: 20, marginBottom: 25 },
  searchBar: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      backgroundColor: '#FFFFFF', 
      paddingHorizontal: 16, 
      height: 56, 
      borderRadius: 16, 
      shadowColor: '#0C1559', 
      shadowOffset: { width: 0, height: 6 }, 
      shadowOpacity: 0.05, 
      shadowRadius: 12, 
      elevation: 4 
  },
  searchInput: { flex: 1, marginLeft: 12, fontSize: 15, fontFamily: 'Montserrat-Medium', color: '#0F172A' },
  clearBtn: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#CBD5E1', justifyContent: 'center', alignItems: 'center' },

  // Categories
  categoriesSection: { marginBottom: 20 },
  sectionHeader: { paddingHorizontal: 20, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
  catList: { paddingHorizontal: 20, paddingBottom: 5 },
  catChip: { 
      paddingHorizontal: 20, 
      paddingVertical: 10, 
      borderRadius: 20, 
      backgroundColor: '#FFF', 
      marginRight: 10, 
      shadowColor: '#000', 
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.03,
      shadowRadius: 4,
      elevation: 2
  },
  catChipActive: { backgroundColor: '#0C1559' },
  catText: { fontSize: 13, fontFamily: 'Montserrat-SemiBold', color: '#64748B' },
  catTextActive: { color: '#FFF' },

  // Grid
  gridContent: { paddingHorizontal: 20, paddingBottom: 100 },
  columnWrapper: { justifyContent: 'space-between' },
  
  // Product Card
  productCard: { 
      width: (width - 55) / 2, 
      backgroundColor: '#FFF', 
      borderRadius: 20, 
      marginBottom: 15,
      paddingBottom: 12,
      shadowColor: '#0C1559', 
      shadowOffset: { width: 0, height: 4 }, 
      shadowOpacity: 0.06, 
      shadowRadius: 12, 
      elevation: 4,
      overflow: 'hidden'
  },
  imageContainer: { width: '100%', height: 140, backgroundColor: '#F8FAFC', position: 'relative' },
  productImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  favoriteBtn: { 
      position: 'absolute', 
      top: 10, 
      right: 10, 
      width: 28, 
      height: 28, 
      borderRadius: 14, 
      backgroundColor: '#FFF', 
      justifyContent: 'center', 
      alignItems: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2
  },
  productInfo: { paddingHorizontal: 12, paddingTop: 12 },
  storeName: { fontSize: 10, fontFamily: 'Montserrat-SemiBold', color: '#94A3B8', marginBottom: 4, textTransform: 'uppercase' },
  productTitle: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginBottom: 8, lineHeight: 18 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  productPrice: { fontSize: 15, fontFamily: 'Montserrat-Bold', color: '#84cc16' },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, gap: 2 },
  ratingText: { fontSize: 10, fontFamily: 'Montserrat-Bold', color: '#B45309' },

  // Empty States
  emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 40, paddingHorizontal: 30 },
  emptyIconBg: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', marginBottom: 20, shadowColor: '#0C1559', shadowOpacity: 0.05, shadowRadius: 15, elevation: 5 },
  emptyTitle: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginBottom: 8 },
  emptySubtitle: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: '#64748B', textAlign: 'center', lineHeight: 20 }
});