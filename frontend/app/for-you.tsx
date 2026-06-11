import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  RefreshControl,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useCart } from '@/store/cartStore';
import { usePersonalizedRecommendations, useTrendingRecommendations } from '@/hooks/useRecommendations';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 44) / 2;

// ─── Card ─────────────────────────────────────────────────────────────────────

function ProductCard({ item, onPress, onAddToCart }: { item: any; onPress: () => void; onAddToCart: () => void }) {
  return (
    <TouchableOpacity style={S.card} activeOpacity={0.9} onPress={onPress}>
      <View style={S.imageContainer}>
        <Image
          source={{ uri: item.images?.[0] || 'https://via.placeholder.com/150' }}
          style={S.productImage}
        />
        <View style={S.forYouBadge}>
          <Ionicons name="star" size={8} color="#0C1559" />
          <Text style={S.forYouText}>FOR YOU</Text>
        </View>
      </View>

      <View style={S.productInfo}>
        <Text style={S.categoryText} numberOfLines={1}>{item.category || 'General'}</Text>
        <Text style={S.productTitle} numberOfLines={2}>{item.name}</Text>
        <View style={S.priceRow}>
          <Text style={S.currentPrice}>₵{Number(item.price || 0).toFixed(2)}</Text>
          {item.compareAtPrice && Number(item.compareAtPrice) > Number(item.price) && (
            <Text style={S.oldPrice}>₵{Number(item.compareAtPrice).toFixed(2)}</Text>
          )}
        </View>
        <View style={S.footerRow}>
          {item.averageRating > 0 && (
            <View style={S.ratingBadge}>
              <Ionicons name="star" size={9} color="#F59E0B" />
              <Text style={S.ratingText}>{Number(item.averageRating).toFixed(1)}</Text>
            </View>
          )}
          <TouchableOpacity style={S.addBtn} onPress={onAddToCart}>
            <Ionicons name="add" size={18} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function GridSkeleton() {
  const shimmer = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, [shimmer]);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.9] });

  return (
    <View style={S.skeletonGrid}>
      {Array.from({ length: 6 }).map((_, i) => (
        <Animated.View key={i} style={[S.skeletonCard, { opacity }]}>
          <View style={S.skeletonImg} />
          <View style={S.skeletonLine} />
          <View style={[S.skeletonLine, { width: '60%' }]} />
        </Animated.View>
      ))}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ForYouScreen() {
  const router = useRouter();
  const { addToCart } = useCart();
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  const { data: personalized, isLoading: loadingPersonalized, refetch: refetchPersonalized } = usePersonalizedRecommendations();
  const { data: trending, isLoading: loadingTrending, refetch: refetchTrending } = useTrendingRecommendations(undefined);

  const isLoading = loadingPersonalized;
  const source: string = personalized?.source || trending?.source || 'trending';
  const products: any[] = personalized?.products?.length
    ? personalized.products
    : (trending?.products || []);

  const subtitleMap: Record<string, string> = {
    personalized: 'Tailored to your taste',
    cf:           'Based on what others bought',
    trending:     'Popular right now',
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setToastVisible(true);
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.delay(1800),
      Animated.timing(fadeAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => setToastVisible(false));
  };

  const handleAddToCart = (item: any) => {
    addToCart({ id: item._id, title: item.name, price: item.price, image: { uri: item.images?.[0] }, storeId: null });
    showToast(`${item.name} added to cart!`);
  };

  const onRefresh = async () => {
    await Promise.all([refetchPersonalized(), refetchTrending()]);
  };

  const renderItem = ({ item }: { item: any }) => (
    <ProductCard
      item={item}
      onPress={() => router.push({ pathname: '/product/details', params: { id: item._id } })}
      onAddToCart={() => handleAddToCart(item)}
    />
  );

  return (
    <View style={S.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={S.headerWrapper}>
        <LinearGradient colors={['#0C1559', '#1e3a8a']} style={S.header}>
          <SafeAreaView edges={['top', 'left', 'right']}>
            <View style={S.headerContent}>
              <TouchableOpacity onPress={() => router.back()} style={S.backBtn}>
                <Ionicons name="arrow-back" size={24} color="#FFF" />
              </TouchableOpacity>
              <View style={S.headerCenter}>
                <Text style={S.headerTitle}>For You</Text>
                <Text style={S.headerSubtitle}>{subtitleMap[source] ?? subtitleMap.trending}</Text>
              </View>
              <View style={{ width: 40 }} />
            </View>
          </SafeAreaView>
        </LinearGradient>
      </View>

      {/* Content */}
      {isLoading ? (
        <GridSkeleton />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item._id || item.id}
          numColumns={2}
          contentContainerStyle={S.listContainer}
          columnWrapperStyle={S.columnWrapper}
          showsVerticalScrollIndicator={false}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor="#0C1559" />}
          ListEmptyComponent={
            <View style={S.emptyState}>
              <Feather name="star" size={40} color="#CBD5E1" />
              <Text style={S.emptyTitle}>Nothing yet</Text>
              <Text style={S.emptyText}>Browse and buy products to get personalised picks.</Text>
            </View>
          }
        />
      )}

      {/* Toast */}
      {toastVisible && (
        <Animated.View style={[S.toast, { opacity: fadeAnim }]}>
          <View style={S.toastInner}>
            <View style={S.toastCheck}>
              <Ionicons name="checkmark" size={14} color="#FFF" />
            </View>
            <Text style={S.toastText} numberOfLines={1}>{toastMessage}</Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#e9f0ff' },

  // Header
  headerWrapper: { marginBottom: 10 },
  header: {
    paddingBottom: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    elevation: 8,
    shadowColor: '#0C1559',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 4,
  },
  backBtn: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    width: 40,
    alignItems: 'center',
  },
  headerCenter: { alignItems: 'center' },
  headerTitle: { fontSize: 20, fontFamily: 'Montserrat-Bold', color: '#FFF' },
  headerSubtitle: { fontSize: 11, fontFamily: 'Montserrat-Medium', color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  // List
  listContainer: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 40 },
  columnWrapper: { justifyContent: 'space-between' },

  // Card
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#FFF',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
    overflow: 'hidden',
  },
  imageContainer: { height: 140, width: '100%', backgroundColor: '#F1F5F9', position: 'relative' },
  productImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  forYouBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#84cc16',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  forYouText: { color: '#0C1559', fontSize: 8, fontFamily: 'Montserrat-Bold' },
  productInfo: { padding: 10 },
  categoryText: {
    fontSize: 10, fontFamily: 'Montserrat-Medium', color: '#64748B',
    marginBottom: 2, textTransform: 'uppercase',
  },
  productTitle: { fontSize: 13, fontFamily: 'Montserrat-SemiBold', color: '#0F172A', marginBottom: 6 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  currentPrice: { fontSize: 15, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
  oldPrice: {
    fontSize: 12, fontFamily: 'Montserrat-Regular', color: '#94A3B8',
    textDecorationLine: 'line-through',
  },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ratingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#FFFBEB', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6,
  },
  ratingText: { fontSize: 10, fontFamily: 'Montserrat-Bold', color: '#92400E' },
  addBtn: {
    backgroundColor: '#0C1559',
    width: 28, height: 28, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },

  // Skeleton
  skeletonGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 16, paddingTop: 10, gap: 12,
  },
  skeletonCard: {
    width: CARD_WIDTH, borderRadius: 16, backgroundColor: '#E2E8F0', overflow: 'hidden',
  },
  skeletonImg: { width: '100%', height: 140, backgroundColor: '#CBD5E1' },
  skeletonLine: {
    height: 12, backgroundColor: '#CBD5E1', borderRadius: 6,
    marginHorizontal: 10, marginTop: 10, width: '80%',
  },

  // Empty
  emptyState: { alignItems: 'center', marginTop: 60, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#334155', marginTop: 16, marginBottom: 8 },
  emptyText: { fontSize: 13, fontFamily: 'Montserrat-Regular', color: '#94A3B8', textAlign: 'center', lineHeight: 20 },

  // Toast
  toast: { position: 'absolute', bottom: 40, left: 20, right: 20, alignItems: 'center', zIndex: 100 },
  toastInner: {
    backgroundColor: '#0C1559', flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 20, borderRadius: 30,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  toastCheck: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: '#84cc16',
    justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  toastText: { color: '#FFF', fontSize: 13, fontFamily: 'Montserrat-Bold', flex: 1 },
});
