import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import AppImage from '@/components/AppImage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFavorites, useRemoveFavorite } from '@/hooks/useFavorites';
import { CustomInAppToast } from '@/services/api';
import { useCart } from '@/store/cartStore';
import Skeleton from '../components/Skeleton';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - 48) / 2;

const COLORS = {
  navy: '#0C1559',
  navyMid: '#1e3a8a',
  lime: '#84cc16',
  limeText: '#1a2e00',
  bg: '#FFFFFF',
  card: '#FFFFFF',
  text: '#0F172A',
  muted: '#64748B',
  subtle: '#94A3B8',
  border: 'rgba(12,21,89,0.08)',
};

const SORT_OPTIONS = [
  { label: 'Newest', value: 'newest' },
  { label: 'Price ↑', value: 'price_asc' },
  { label: 'Price ↓', value: 'price_desc' },
  { label: 'A–Z', value: 'alpha' },
];

const FavoriteCard = React.memo(function FavoriteCard({
  item,
  addingToCartId,
  isRemoving,
  onPress,
  onRemove,
  onAddToCart,
}: {
  item: any;
  addingToCartId: string | null;
  isRemoving: boolean;
  onPress: (item: any) => void;
  onRemove: (id: string) => void;
  onAddToCart: (item: any) => void;
}) {
  const id = item.id || item._id;
  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.9}
      onPress={() => onPress(item)}
    >
      <View style={styles.imageContainer}>
        <AppImage
          uri={item.images?.[0] || 'https://via.placeholder.com/300'}
          style={styles.image}
        />
        <TouchableOpacity
          style={styles.removeBtn}
          onPress={() => onRemove(id)}
          disabled={isRemoving}
        >
          <Ionicons name="heart" size={18} color="#EF4444" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.price}>₵{Number.parseFloat(item.price).toFixed(2)}</Text>

        <TouchableOpacity
          style={styles.addToCartBtn}
          onPress={() => onAddToCart(item)}
          disabled={addingToCartId === id}
        >
          {addingToCartId === id ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Feather name="shopping-cart" size={14} color="#FFF" />
              <Text style={styles.addToCartTxt}>Add to Cart</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
});

export default function FavoritesScreen() {
  const router = useRouter();
  const addToCart = useCart((s) => s.addToCart);
  const { data: favorites, isLoading, refetch } = useFavorites();
  const { mutate: removeFavorite, isPending: isRemoving } = useRemoveFavorite();
  const [addingToCartId, setAddingToCartId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSort, setActiveSort] = useState('newest');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const categories = useMemo(() => {
    if (!favorites?.length) return [];
    const seen = new Set<string>();
    const cats: string[] = [];
    for (const item of favorites) {
      const cat = item.category || item.product?.category;
      if (cat && !seen.has(cat)) {
        seen.add(cat);
        cats.push(cat);
      }
    }
    return cats;
  }, [favorites]);

  const filteredFavorites = useMemo(() => {
    if (!favorites) return [];
    let list = [...favorites];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (item) =>
          item.name?.toLowerCase().includes(q) ||
          item.category?.toLowerCase().includes(q) ||
          item.store?.name?.toLowerCase().includes(q),
      );
    }

    if (activeCategory) {
      list = list.filter(
        (item) =>
          (item.category || item.product?.category) === activeCategory,
      );
    }

    switch (activeSort) {
      case 'price_asc':
        list.sort((a, b) => Number.parseFloat(a.price) - Number.parseFloat(b.price));
        break;
      case 'price_desc':
        list.sort((a, b) => Number.parseFloat(b.price) - Number.parseFloat(a.price));
        break;
      case 'alpha':
        list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        break;
      default:
        break;
    }

    return list;
  }, [favorites, searchQuery, activeSort, activeCategory]);

  const handleProductPress = useCallback((item: any) => {
    router.push({
      pathname: '/product/details',
      params: { id: item.id || item._id, name: item.name, price: item.price, image: item.images?.[0] || '' },
    } as any);
  }, [router]);

  const handleRemove = useCallback((productId: string) => {
    removeFavorite(productId, {
      onSuccess: () => {
        CustomInAppToast.show({
          type: 'success',
          title: 'Removed from favorites',
          message: 'Product removed successfully',
        });
      },
    });
  }, [removeFavorite]);

  const handleAddToCart = useCallback(async (item: any) => {
    setAddingToCartId(item.id || item._id);
    try {
      addToCart({
        id: item.id || item._id,
        title: item.name,
        category: item.category || 'General',
        price: Number.parseFloat(item.price) || 0,
        image: item.images?.[0] || 'https://via.placeholder.com/300',
        storeId: item.store_id || item.business_id || item.store?._id || item.store?.id || item.businessId,
      });
      CustomInAppToast.show({
        type: 'success',
        title: 'Added to cart',
        message: item.name,
      });
    } finally {
      setAddingToCartId(null);
    }
  }, [addToCart]);

  const renderItem = useCallback(({ item }: { item: any }) => (
    <FavoriteCard
      item={item}
      addingToCartId={addingToCartId}
      isRemoving={isRemoving}
      onPress={handleProductPress}
      onRemove={handleRemove}
      onAddToCart={handleAddToCart}
    />
  ), [addingToCartId, isRemoving, handleProductPress, handleRemove, handleAddToCart]);

  const hasActiveFilters = searchQuery.trim() || activeCategory || activeSort !== 'newest';

  const renderEmpty = useCallback(() => {
    if (hasActiveFilters) {
      return (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="search-outline" size={52} color={COLORS.navy} />
          </View>
          <Text style={styles.emptyTitle}>No Results Found</Text>
          <Text style={styles.emptySubtitle}>Try adjusting your search or filters.</Text>
          <TouchableOpacity
            style={styles.exploreBtn}
            onPress={() => {
              setSearchQuery('');
              setActiveCategory(null);
              setActiveSort('newest');
            }}
          >
            <Text style={styles.exploreBtnTxt}>Clear Filters</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconContainer}>
          <MaterialCommunityIcons name="heart-outline" size={60} color={COLORS.navy} />
        </View>
        <Text style={styles.emptyTitle}>No Favorites Yet</Text>
        <Text style={styles.emptySubtitle}>
          Tap the heart icon on any product to save it for later.
        </Text>
        <TouchableOpacity
          style={styles.exploreBtn}
          onPress={() => router.push('/search')}
        >
          <Text style={styles.exploreBtnTxt}>Explore Products</Text>
        </TouchableOpacity>
      </View>
    );
  }, [hasActiveFilters, router]);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={COLORS.navy} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Favorites</Text>
          <View style={{ width: 44 }} />
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          {/* Search + filter bar — always visible above the list */}
          <View style={styles.listHeader}>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color={COLORS.muted} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search favorites..."
                placeholderTextColor={COLORS.subtle}
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
                onSubmitEditing={Keyboard.dismiss}
                clearButtonMode="while-editing"
              />
              {searchQuery.length > 0 && Platform.OS === 'android' && (
                <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={18} color={COLORS.subtle} />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsRow}
              keyboardShouldPersistTaps="handled"
            >
              {SORT_OPTIONS.map((opt) => {
                const active = activeSort === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setActiveSort(opt.value)}
                  >
                    <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              {categories.length > 0 && <View style={styles.chipDivider} />}

              {categories.map((cat) => {
                const active = activeCategory === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setActiveCategory(active ? null : cat)}
                  >
                    <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>{cat}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {(favorites?.length ?? 0) > 0 && (
              <Text style={styles.resultCount}>
                {filteredFavorites.length} of {favorites?.length} saved
              </Text>
            )}
          </View>

          {isLoading ? (
            <View style={styles.listContent}>
              <View style={styles.row}>
                {[1, 2, 3, 4, 5, 6].map((item) => (
                  <View key={item} style={[styles.card, { height: 280 }]}>
                    <Skeleton width="100%" height={160} borderRadius={0} />
                    <View style={{ padding: 12 }}>
                      <Skeleton width="80%" height={14} style={{ marginBottom: 8 }} />
                      <Skeleton width="40%" height={16} style={{ marginBottom: 15 }} />
                      <Skeleton width="100%" height={40} borderRadius={12} />
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <FlatList
              data={filteredFavorites}
              renderItem={renderItem}
              keyExtractor={(item) => item.id || item._id}
              numColumns={2}
              contentContainerStyle={styles.listContent}
              columnWrapperStyle={styles.row}
              ListEmptyComponent={renderEmpty}
              showsVerticalScrollIndicator={false}
              onRefresh={refetch}
              refreshing={isLoading}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={10}
              removeClippedSubviews={Platform.OS === 'android'}
            />
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Montserrat-Bold',
    color: COLORS.navy,
  },
  listHeader: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    height: 46,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Montserrat-Medium',
    color: COLORS.text,
    paddingVertical: 0,
  },
  chipsRow: {
    paddingVertical: 4,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: {
    backgroundColor: COLORS.navy,
    borderColor: COLORS.navy,
  },
  chipTxt: {
    fontSize: 13,
    fontFamily: 'Montserrat-SemiBold',
    color: COLORS.muted,
  },
  chipTxtActive: {
    color: '#FFF',
  },
  chipDivider: {
    width: 1,
    height: 20,
    backgroundColor: COLORS.border,
    marginHorizontal: 4,
  },
  resultCount: {
    fontSize: 12,
    fontFamily: 'Montserrat-Medium',
    color: COLORS.subtle,
    marginBottom: 4,
  },
  // List
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
    flexGrow: 1,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  card: {
    width: COLUMN_WIDTH,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  imageContainer: {
    width: '100%',
    height: 160,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  removeBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  content: {
    padding: 12,
  },
  productName: {
    fontSize: 14,
    fontFamily: 'Montserrat-SemiBold',
    color: COLORS.text,
    height: 38,
    lineHeight: 18,
  },
  price: {
    fontSize: 16,
    fontFamily: 'Montserrat-Bold',
    color: COLORS.lime,
    marginTop: 4,
    marginBottom: 12,
  },
  addToCartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.navy,
    borderRadius: 12,
    paddingVertical: 10,
    gap: 6,
  },
  addToCartTxt: {
    fontSize: 12,
    fontFamily: 'Montserrat-Bold',
    color: '#FFF',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(12,21,89,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 22,
    fontFamily: 'Montserrat-Bold',
    color: COLORS.navy,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Montserrat-Medium',
    color: COLORS.muted,
    textAlign: 'center',
    paddingHorizontal: 40,
    marginBottom: 30,
    lineHeight: 20,
  },
  exploreBtn: {
    backgroundColor: COLORS.lime,
    paddingHorizontal: 30,
    paddingVertical: 14,
    borderRadius: 16,
    shadowColor: COLORS.lime,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  exploreBtnTxt: {
    fontSize: 16,
    fontFamily: 'Montserrat-Bold',
    color: COLORS.limeText,
  },
});
