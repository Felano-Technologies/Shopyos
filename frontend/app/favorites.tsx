import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFavorites, useRemoveFavorite } from '@/hooks/useFavorites';
import { CustomInAppToast } from '@/services/api';
import { useCart } from '@/context/CartContext';
import Skeleton from '../components/Skeleton';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - 48) / 2;

const COLORS = {
  navy: '#0C1559',
  navyMid: '#1e3a8a',
  lime: '#84cc16',
  limeText: '#1a2e00',
  bg: '#F8FAFC',
  card: '#FFFFFF',
  text: '#0F172A',
  muted: '#64748B',
  border: 'rgba(12,21,89,0.08)',
};

export default function FavoritesScreen() {
  const router = useRouter();
  const { addToCart } = useCart();
  const { data: favorites, isLoading, refetch } = useFavorites();
  const { mutate: removeFavorite, isPending: isRemoving } = useRemoveFavorite();
  const [addingToCartId, setAddingToCartId] = useState<string | null>(null);

  const handleProductPress = (item: any) => {
    router.push({
      pathname: `/product/${item.id || item._id}`,
      params: { name: item.name, price: item.price, image: item.images?.[0] || '' },
    } as any);
  };

  const handleRemove = (productId: string) => {
    removeFavorite(productId, {
      onSuccess: () => {
        CustomInAppToast.show({
          type: 'success',
          title: 'Removed from favorites',
          message: 'Product removed successfully',
        });
      },
    });
  };

  const handleAddToCart = async (item: any) => {
    setAddingToCartId(item.id || item._id);
    try {
      addToCart({
        id: item.id || item._id,
        title: item.name,
        category: item.category || 'General',
        price: parseFloat(item.price) || 0,
        image: item.images?.[0] || 'https://via.placeholder.com/300'
      });
      CustomInAppToast.show({
        type: 'success',
        title: 'Added to cart',
        message: item.name
      });
    } finally {
      setAddingToCartId(null);
    }
  };

  const renderFavoriteItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.9}
      onPress={() => handleProductPress(item)}
    >
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: item.images?.[0] || 'https://via.placeholder.com/300' }}
          style={styles.image}
        />
        <TouchableOpacity
          style={styles.removeBtn}
          onPress={() => handleRemove(item.id || item._id)}
          disabled={isRemoving}
        >
          <Ionicons name="heart" size={18} color="#EF4444" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.content}>
        <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.price}>₵{parseFloat(item.price).toFixed(2)}</Text>
        
        <TouchableOpacity
          style={styles.addToCartBtn}
          onPress={() => handleAddToCart(item)}
          disabled={addingToCartId === (item.id || item._id)}
        >
          {addingToCartId === (item.id || item._id) ? (
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

  const renderEmpty = () => (
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
            data={favorites}
            renderItem={renderFavoriteItem}
            keyExtractor={(item) => item.id || item._id}
            numColumns={2}
            contentContainerStyle={styles.listContent}
            columnWrapperStyle={styles.row}
            ListEmptyComponent={renderEmpty}
            showsVerticalScrollIndicator={false}
            onRefresh={refetch}
            refreshing={isLoading}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontFamily: 'Montserrat-Medium',
    color: COLORS.muted,
  },
  listContent: {
    padding: 16,
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
    paddingTop: 100,
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
