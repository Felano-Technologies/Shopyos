import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  ImageBackground,
  TouchableOpacity,
  Keyboard,
  ActivityIndicator,
  Pressable
} from 'react-native';
import AppImage from '@/components/AppImage';
import { Ionicons, Feather } from '@expo/vector-icons';
import BottomNav from '../../components/BottomNav';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useCategories } from '@/hooks/useCategories';
import { searchProducts } from '@/services/api';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useThemeStore } from '@/store/themeStore';
import { ThemeColors } from '@/constants/Colors';
import { formatCurrency } from '@/utils/formatCurrency';

type LegacyPalette = {
  bg: string;
  navy: string;
  card: string;
  body: string;
  muted: string;
  subtle: string;
  border: string;
  lime: string;
};

function buildC(colors: ThemeColors): LegacyPalette {
  return {
    bg: colors.backgroundAlt,
    navy: colors.primary,
    card: colors.surface,
    body: colors.text,
    muted: colors.textSecondary,
    subtle: colors.textMuted,
    border: colors.border,
    lime: colors.accent,
  };
}

const CATEGORY_IMAGES: Record<string, any> = {
  'Grocery':         require('../../assets/images/search/fooddrinks.png'),
  'Footwear':        require('../../assets/images/search/slipper1.png'),
  'Fashion':         require('../../assets/images/search/womencloth.png'),
  'Electronics':     require('../../assets/images/search/appliances.jpeg'),
  'Home':            require('../../assets/images/search/table.jpg'),
  'Health':          require('../../assets/images/search/supplement.png'),
  'Art':             require('../../assets/images/search/Arts1.png'),
  'Accessories':     require('../../assets/images/search/accessories.png'),
  'Beauty':          require('../../assets/images/search/supplement2.jpg'),
  'Sports':          require('../../assets/images/search/sports.jpg'),
  'Home & Kitchen':  require('../../assets/images/search/table2.jpg'),
  'Kitchen and home':require('../../assets/images/search/table2.jpg'),
  'Other':           require('../../assets/images/search/arts2.jpeg'),
  'Sneakers':        require('../../assets/images/search/slipper2.jpg'),
  'Books':           require('../../assets/images/search/pencil.png'),
  'Men':             require('../../assets/images/search/men cloth.png'),
  'Women':           require('../../assets/images/search/womencloth.png'),
};

const FALLBACK_IMAGES = [
  require('../../assets/images/search/fooddrinks.png'),
  require('../../assets/images/search/womencloth.png'),
  require('../../assets/images/search/sports.jpg'),
  require('../../assets/images/search/Arts1.png'),
  require('../../assets/images/search/accessories.png'),
  require('../../assets/images/search/bag1.jpg'),
];

const getCategoryImage = (name: string, index: number) =>
  CATEGORY_IMAGES[name] ?? FALLBACK_IMAGES[index % FALLBACK_IMAGES.length];
export default function CategoryScreen() {
  const router = useRouter();
  const themeColors = useThemeColors();
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);
  const C = useMemo(() => buildC(themeColors), [themeColors]);
  const styles = useMemo(() => getStyles(C), [C]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const { data: categoriesData, isLoading: loadingCats } = useCategories();
  const categories = categoriesData || [];
  // Search logic
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await searchProducts({ query: searchQuery });
        if (res.success) {
          setSearchResults(res.products.map((p: any) => ({
            ...p,
            id: p._id,
            type: 'product',
            title: p.name,
            image: { uri: p.images?.[0] }
          })));
        }
      } catch (e) {
        console.error('Search error:', e);
      } finally {
        setIsSearching(false);
      }
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);
  const displayData = searchQuery.length < 2
    ? categories.map((c: any) => ({ ...c, title: c.name, type: 'category' }))
    : searchResults;
  const handlePress = (item: any) => {
    if (item.type === 'category') {
      router.push({
        pathname: '/search',
        params: { category: item.name }
      } as any);
    } else {
      router.push({
        pathname: `/product/${item.id}`,
        params: {
          name: item.title,
          price: item.price,
          image: item.images?.[0] || ''
        }
      } as any);
    }
  };
  // --- Renderers ---
  const renderCategoryCard = (item: any, index: number) => {
    const displayImage = item.image_url ? { uri: item.image_url } : getCategoryImage(item.name || item.title, index);
    
    return (
      <TouchableOpacity
        style={styles.cardContainer}
        activeOpacity={0.9}
        onPress={() => handlePress(item)}
      >
        <ImageBackground source={displayImage} style={styles.image} imageStyle={{ borderRadius: 16 }}>
          <LinearGradient
            colors={['transparent', 'rgba(12, 21, 89, 0.9)']}
            style={styles.gradientOverlay}
          >
            <Text style={styles.categoryText}>{item.title}</Text>
            <View style={styles.arrowContainer}>
              <Feather name="grid" size={12} color="#FFF" />
            </View>
          </LinearGradient>
        </ImageBackground>
      </TouchableOpacity>
    );
  };
  const renderProductCard = (item: any) => (
    <TouchableOpacity
      style={styles.productCard}
      activeOpacity={0.9}
      onPress={() => handlePress(item)}
    >
      <AppImage source={item.image} style={styles.productImage} />
      <View style={styles.productInfo}>
        <Text style={styles.productTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.productPrice}>{formatCurrency(item.price)}</Text>
        <View style={styles.productTag}>
          <Text style={styles.productTagText}>Product</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
  return (
    <Pressable onPress={Keyboard.dismiss} style={{ flex: 1 }}>
      <View style={styles.mainContainer}>
        <StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'} />
        <SafeAreaView style={styles.safeContainer} edges={['top', 'left', 'right']}>
          {/* 🟢 Header */}
          <View style={styles.headerContainer}>
            <Text style={styles.headerTitle}>Explore</Text>
            <Text style={styles.headerSubtitle}>
              {searchQuery.length > 0 ? `Searching for "${searchQuery}"` : 'Find items by category'}
            </Text>
          </View>
          {/* 🔍 Search Bar */}
          <View style={styles.searchWrapper}>
            <View style={styles.searchBar}>
              <Feather name="search" size={20} color={C.navy} />
              <TextInput
                placeholder="Search products & categories..."
                placeholderTextColor={C.subtle}
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={20} color={C.subtle} />
                </TouchableOpacity>
              )}
            </View>
          </View>
          {/* 📦 Grid List */}
          <FlatList
            data={displayData}
            keyExtractor={(item) => item.id || item.slug}
            numColumns={2}
            contentContainerStyle={styles.gridContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item, index }) =>
              item.type === 'category' ? renderCategoryCard(item, index) : renderProductCard(item)
            }
            ListEmptyComponent={
              loadingCats || isSearching ? (
                <View style={styles.emptyState}><ActivityIndicator size="large" color={C.navy} /></View>
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons name="search-outline" size={48} color={C.subtle} />
                  <Text style={styles.emptyText}>No items found matching &quot;{searchQuery}&quot;</Text>
                </View>
              )
            }
          />
        </SafeAreaView>
        <BottomNav />
      </View>
    </Pressable>
  );
}
const getStyles = (C: LegacyPalette) => StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: C.bg,
  },
  safeContainer: {
    flex: 1,
  },
  // Header
  headerContainer: {
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 15,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: 'Montserrat-Bold',
    color: C.navy,
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: 'Montserrat-Medium',
    color: C.muted,
    marginTop: 2,
  },
  // Search
  searchWrapper: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 30,
    shadowColor: C.navy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1,
    borderColor: C.border,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 15,
    fontFamily: 'Montserrat-Medium',
    color: C.body,
  },
  // Grid
  gridContent: {
    paddingHorizontal: 12,
    paddingBottom: 100,
  },
  // 1. Category Card Style
  cardContainer: {
    flex: 1,
    margin: 8,
    height: 160,
    borderRadius: 16,
    backgroundColor: C.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
    borderRadius: 16,
    overflow: 'hidden',
  },
  gradientOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 12,
  },
  categoryText: {
    color: '#FFF',
    fontFamily: 'Montserrat-Bold',
    fontSize: 16,
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  arrowContainer: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 4,
    borderRadius: 8,
  },
  // 2. Product Card Style
  productCard: {
    flex: 1,
    margin: 8,
    height: 180,
    borderRadius: 16,
    backgroundColor: C.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    padding: 8,
  },
  productImage: {
    width: '100%',
    height: 100,
    borderRadius: 12,
    resizeMode: 'cover',
    backgroundColor: C.border,
  },
  productInfo: {
    marginTop: 8,
    flex: 1,
    justifyContent: 'space-between',
  },
  productTitle: {
    fontSize: 13,
    fontFamily: 'Montserrat-Bold',
    color: C.body,
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
    color: C.lime,
  },
  productTag: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: C.border,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  productTagText: {
    fontSize: 10,
    color: C.muted,
    fontFamily: 'Montserrat-Medium',
  },
  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: C.muted,
    fontFamily: 'Montserrat-Medium',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});