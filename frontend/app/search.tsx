import React, { useState, useEffect, useCallback } from 'react';
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
  TouchableWithoutFeedback,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import BottomNav from '../components/BottomNav';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { searchProducts, getAllCategories, getActiveDeliveries } from '@/services/api';
import { useLocalSearchParams } from 'expo-router';

const { width } = Dimensions.get('window');

export default function SearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Fetch categories once
  useEffect(() => {
    const fetchCats = async () => {
      try {
        const data = await getAllCategories();
        setCategories(data.data || []);
      } catch (error) {
        console.error(error);
      }
    };
    fetchCats();
  }, []);

  // Search effect with debounce
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (!searchQuery && !selectedCategory && !params.sortBy && !params.minPrice) {
        setProducts([]);
        return;
      }

      const performSearch = async () => {
        try {
          setLoading(true);
          const res = await searchProducts({
            query: searchQuery || undefined,
            category: (selectedCategory || params.category) as string || undefined,
            sortBy: params.sortBy as string || undefined,
            minPrice: params.minPrice ? parseFloat(params.minPrice as string) : undefined,
            maxPrice: params.maxPrice ? parseFloat(params.maxPrice as string) : undefined,
            limit: 20
          });
          if (res.success) {
            setProducts(res.products);
          }
        } catch (error) {
          console.error(error);
        } finally {
          setLoading(false);
        }
      };

      performSearch();
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, selectedCategory, params.sortBy, params.category, params.minPrice, params.maxPrice]);

  const handleProductPress = (product: any) => {
    router.push({
      pathname: `/product/${product._id}`,
      params: {
        name: product.name,
        price: product.price,
        image: product.images[0]
      }
    } as any);
  };

  const renderProductCard = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.productCard}
      activeOpacity={0.9}
      onPress={() => handleProductPress(item)}
    >
      <Image
        source={{ uri: item.images[0] || 'https://via.placeholder.com/150' }}
        style={styles.productImage}
      />
      <View style={styles.productInfo}>
        <Text style={styles.productTitle} numberOfLines={2}>{item.name}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.productPrice}>₵{parseFloat(item.price).toFixed(2)}</Text>
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={12} color="#F59E0B" />
            <Text style={styles.ratingText}>{item.averageRating || '0.0'}</Text>
          </View>
        </View>
        <Text style={styles.storeName} numberOfLines={1}>by {item.store?.name || 'Shopyos'}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderCategoryItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={[
        styles.catChip,
        selectedCategory === item.name && styles.catChipActive
      ]}
      onPress={() => setSelectedCategory(selectedCategory === item.name ? null : item.name)}
    >
      <Text style={[
        styles.catText,
        selectedCategory === item.name && styles.catTextActive
      ]}>{item.name}</Text>
    </TouchableOpacity>
  );

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.mainContainer}>
        <StatusBar style="dark" />
        <SafeAreaView style={styles.safeContainer} edges={['top', 'left', 'right']}>

          <View style={styles.header}>
            <Text style={styles.headerTitle}>Explore</Text>
            <TouchableOpacity
              style={styles.filterBtn}
              onPress={() => router.push('/filter' as any)}
            >
              <Feather name="sliders" size={18} color="#0C1559" />
            </TouchableOpacity>
          </View>

          <View style={styles.searchWrapper}>
            <View style={styles.searchBar}>
              <Feather name="search" size={20} color="#0C1559" />
              <TextInput
                placeholder="What are you looking for?"
                placeholderTextColor="#94A3B8"
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={20} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Categories Horizontal List */}
          <View style={styles.categoriesWrapper}>
            <FlatList
              horizontal
              data={categories}
              keyExtractor={(item) => item.id || item.name}
              renderItem={renderCategoryItem}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.catList}
            />
          </View>

          {loading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color="#0C1559" />
              <Text style={styles.loadingText}>Finding best matches...</Text>
            </View>
          ) : (
            <FlatList
              data={products}
              keyExtractor={(item) => item._id}
              numColumns={2}
              contentContainerStyle={styles.gridContent}
              showsVerticalScrollIndicator={false}
              renderItem={renderProductCard}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <MaterialCommunityIcons
                    name={searchQuery || selectedCategory ? "magnify-close" : "store-search-outline"}
                    size={64}
                    color="#CBD5E1"
                  />
                  <Text style={styles.emptyTitle}>
                    {searchQuery || selectedCategory ? 'No matches found' : 'Start Searching'}
                  </Text>
                  <Text style={styles.emptySubtitle}>
                    {searchQuery || selectedCategory
                      ? 'Try adjusting your filters or search keywords'
                      : 'Browse thousands of unique items from local sellers'}
                  </Text>
                </View>
              }
            />
          )}

        </SafeAreaView>
        <BottomNav />
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#F8FAFC' },
  safeContainer: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginTop: 15, marginBottom: 15 },
  headerTitle: { fontSize: 28, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
  filterBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
  searchWrapper: { paddingHorizontal: 20, marginBottom: 15 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, shadowColor: '#0C1559', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 4 },
  searchInput: { flex: 1, marginLeft: 12, fontSize: 16, fontFamily: 'Montserrat-Medium', color: '#0F172A' },
  categoriesWrapper: { marginBottom: 15 },
  catList: { paddingHorizontal: 20 },
  catChip: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, backgroundColor: '#FFF', marginRight: 10, borderWidth: 1, borderColor: '#F1F5F9' },
  catChipActive: { backgroundColor: '#0C1559', borderColor: '#0C1559' },
  catText: { fontSize: 13, fontFamily: 'Montserrat-SemiBold', color: '#64748B' },
  catTextActive: { color: '#FFF' },
  gridContent: { paddingHorizontal: 15, paddingBottom: 100 },
  productCard: { flex: 1, margin: 5, backgroundColor: '#FFF', borderRadius: 20, padding: 10, shadowColor: '#0C1559', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
  productImage: { width: '100%', height: 140, borderRadius: 16, backgroundColor: '#F8FAFC', resizeMode: 'cover' },
  productInfo: { marginTop: 10 },
  productTitle: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginBottom: 4 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  productPrice: { fontSize: 15, fontFamily: 'Montserrat-Bold', color: '#84cc16' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: { fontSize: 11, fontFamily: 'Montserrat-SemiBold', color: '#64748B' },
  storeName: { fontSize: 10, fontFamily: 'Montserrat-Medium', color: '#94A3B8', marginTop: 4 },
  loadingState: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50 },
  loadingText: { marginTop: 15, fontSize: 14, fontFamily: 'Montserrat-Medium', color: '#64748B' },
  emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 80, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginTop: 20 },
  emptySubtitle: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: '#64748B', textAlign: 'center', marginTop: 8, lineHeight: 20 },
});