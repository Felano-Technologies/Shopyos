import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  RefreshControl,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import AppImage from '@/components/AppImage';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useCart } from '@/store/cartStore';
import { usePersonalizedRecommendations, useTrendingRecommendations } from '@/hooks/useRecommendations';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 44) / 2;

// ─── Card ─────────────────────────────────────────────────────────────────────

const ProductCard = React.memo(function ProductCard({ item, onPress, onAddToCart }: Readonly<{ item: any; onPress: () => void; onAddToCart: () => void }>) {
  const colors = useThemeColors();
  const S = useMemo(() => getStyles(colors), [colors]);
  return (
    <TouchableOpacity style={S.card} activeOpacity={0.9} onPress={onPress}>
      <View style={S.imageContainer}>
        <AppImage
          uri={item.images?.[0]}
          style={S.productImage}
        />
        <View style={S.forYouBadge}>
          <Ionicons name="star" size={8} color={colors.accentText} />
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
              <Ionicons name="star" size={9} color={colors.warning} />
              <Text style={S.ratingText}>{Number(item.averageRating).toFixed(1)}</Text>
            </View>
          )}
          <TouchableOpacity style={S.addBtn} onPress={onAddToCart}>
            <Ionicons name="add" size={18} color="#FFF" /* white icon on the fixed-navy add button */ />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
});

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function GridSkeleton() {
  const colors = useThemeColors();
  const S = useMemo(() => getStyles(colors), [colors]);
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
        <Animated.View key={'sk-' + i} style={[S.skeletonCard, { opacity }]}>
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
  const colors = useThemeColors();
  const S = useMemo(() => getStyles(colors), [colors]);
  const addToCart = useCart((s) => s.addToCart);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  const { data: personalized, isLoading: loadingPersonalized, refetch: refetchPersonalized } = usePersonalizedRecommendations();
  const { data: trending, refetch: refetchTrending } = useTrendingRecommendations();

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

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setToastVisible(true);
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.delay(1800),
      Animated.timing(fadeAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => setToastVisible(false));
  }, [fadeAnim]);

  const handleAddToCart = useCallback((item: any) => {
    // A hardcoded null here was the actual cause of "select pickup, still
    // billed for delivery" — checkout groups items by storeId, and a null/
    // 'unknown' group can never match the backend's per-store pickup check.
    addToCart({
      id: item._id, title: item.name, price: item.price, image: { uri: item.images?.[0] },
      storeId: item.store_id || item.business_id || item.store?._id || item.store?.id,
      storeName: item.store?.store_name || item.store?.name,
      storeLogo: item.store?.logo_url || item.store?.logo,
    });
    showToast(`${item.name} added to cart!`);
  }, [addToCart, showToast]);

  const onRefresh = useCallback(async () => {
    await Promise.all([refetchPersonalized(), refetchTrending()]);
  }, [refetchPersonalized, refetchTrending]);

  const renderItem = useCallback(({ item }: { item: any }) => (
    <ProductCard
      item={item}
      onPress={() => router.push({ pathname: '/product/details', params: { id: item._id } })}
      onAddToCart={() => handleAddToCart(item)}
    />
  ), [handleAddToCart, router]);

  return (
    <View style={S.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={S.headerWrapper}>
        <LinearGradient colors={colors.headerGradient} style={S.header}>
          <SafeAreaView edges={['top', 'left', 'right']}>
            <View style={S.headerContent}>
              <TouchableOpacity onPress={() => router.back()} style={S.backBtn}>
                <Ionicons name="arrow-back" size={24} color="#FFF" /* white icon on the fixed-navy header gradient */ />
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
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={10}
          removeClippedSubviews
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={S.emptyState}>
              <Feather name="star" size={40} color={colors.textMuted} />
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
              <Ionicons name="checkmark" size={14} color="#FFF" /* white icon on the fixed accent toast-check circle */ />
            </View>
            <Text style={S.toastText} numberOfLines={1}>{toastMessage}</Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const getStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },

  // Header
  headerWrapper: { marginBottom: 10 },
  header: {
    paddingBottom: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    elevation: 8,
    shadowColor: c.primary,
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
    backgroundColor: 'rgba(255,255,255,0.15)', // translucent overlay on the fixed-navy header gradient
    borderRadius: 12,
    width: 40,
    alignItems: 'center',
  },
  headerCenter: { alignItems: 'center' },
  headerTitle: { fontSize: 20, fontFamily: 'Montserrat-Bold', color: '#FFF' }, // white text on the fixed-navy header gradient
  headerSubtitle: { fontSize: 11, fontFamily: 'Montserrat-Medium', color: 'rgba(255,255,255,0.7)', marginTop: 2 }, // translucent white on the fixed-navy header gradient

  // List
  listContainer: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 40 },
  columnWrapper: { justifyContent: 'space-between' },

  // Card
  card: {
    width: CARD_WIDTH,
    backgroundColor: c.surface,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: c.border,
    overflow: 'hidden',
  },
  imageContainer: { height: 140, width: '100%', backgroundColor: c.border, position: 'relative' },
  productImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  forYouBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: c.accent,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  forYouText: { color: c.accentText, fontSize: 8, fontFamily: 'Montserrat-Bold' },
  productInfo: { padding: 10 },
  categoryText: {
    fontSize: 10, fontFamily: 'Montserrat-Medium', color: c.textSecondary,
    marginBottom: 2, textTransform: 'uppercase',
  },
  productTitle: { fontSize: 13, fontFamily: 'Montserrat-SemiBold', color: c.text, marginBottom: 6 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  currentPrice: { fontSize: 15, fontFamily: 'Montserrat-Bold', color: c.primary },
  oldPrice: {
    fontSize: 12, fontFamily: 'Montserrat-Regular', color: c.textMuted,
    textDecorationLine: 'line-through',
  },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ratingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    // Amber rating-badge palette has no matching theme token; kept fixed for both themes.
    backgroundColor: '#FFFBEB', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6,
  },
  ratingText: { fontSize: 10, fontFamily: 'Montserrat-Bold', color: '#92400E' }, // paired with the fixed amber ratingBadge background above
  addBtn: {
    backgroundColor: c.primary,
    width: 28, height: 28, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },

  // Skeleton
  skeletonGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 16, paddingTop: 10, gap: 12,
  },
  skeletonCard: {
    width: CARD_WIDTH, borderRadius: 16, backgroundColor: c.borderStrong, overflow: 'hidden',
  },
  skeletonImg: { width: '100%', height: 140, backgroundColor: c.textMuted },
  skeletonLine: {
    height: 12, backgroundColor: c.textMuted, borderRadius: 6,
    marginHorizontal: 10, marginTop: 10, width: '80%',
  },

  // Empty
  emptyState: { alignItems: 'center', marginTop: 60, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: c.text, marginTop: 16, marginBottom: 8 },
  emptyText: { fontSize: 13, fontFamily: 'Montserrat-Regular', color: c.textMuted, textAlign: 'center', lineHeight: 20 },

  // Toast
  toast: { position: 'absolute', bottom: 40, left: 20, right: 20, alignItems: 'center', zIndex: 100 },
  toastInner: {
    backgroundColor: c.primary, flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 20, borderRadius: 30,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  toastCheck: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: c.accent,
    justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  toastText: { color: '#FFF', fontSize: 13, fontFamily: 'Montserrat-Bold', flex: 1 }, // white text on the fixed-navy toast background
});
