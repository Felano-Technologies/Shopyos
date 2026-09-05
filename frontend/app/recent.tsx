import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Modal,
  Pressable,
  Animated,
  TextInput
} from 'react-native';
import AppImage from '@/components/AppImage';
import { Ionicons, Feather, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useCart } from '@/store/cartStore';
import { RecentSkeleton } from '../components/skeletons/RecentSkeleton';
import { useProducts } from '@/hooks/useProducts';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';
import { formatCurrency } from '@/utils/formatCurrency';

const { width } = Dimensions.get('window');

interface RecentProduct {
  id: string;
  title: string;
  category: string;
  price: number;
  oldPrice: number | null;
  image: any;
  timestamp: string;
  storeId?: string;
  storeName?: string;
  storeLogo?: string;
}

export default function RecentScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const addToCart = useCart((s) => s.addToCart);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeSort, setActiveSort] = useState('newest');
  const [modalVisible, setModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // --- Toast Animation State ---
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  // --- TanStack Query Hook ---
  let sortByParam: string;
  if (activeSort === 'low_high') sortByParam = 'price_asc';
  else if (activeSort === 'high_low') sortByParam = 'price_desc';
  else sortByParam = 'newest';
  const { data, isLoading, refetch } = useProducts({ sortBy: sortByParam as any }, 50);
  
  const products: RecentProduct[] = data?.products?.map((p: any) => ({
    id: p._id || p.id,
    title: p.name,
    category: p.category || 'General',
    price: Number.parseFloat(p.price) || 0,
    oldPrice: null,
    image: p.images?.[0] ? { uri: p.images[0] } : require('../assets/images/icon.png'),
    timestamp: 'Just now',
    storeId: p.store_id || p.business_id || p.store?._id || p.store?.id || p.businessId,
    storeName: p.store?.store_name || p.store?.name,
    storeLogo: p.store?.logo_url || p.store?.logo,
  })) || [];

  // Filter products based on search query
  const filteredProducts = searchQuery
    ? products.filter((p: RecentProduct) => p.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : products;

  const loading = isLoading;

  const handleProductPress = useCallback((item: RecentProduct) => {
    router.push({
      pathname: '/product/details',
      params: {
        id: item.id,
        title: item.title,
        price: item.price,
        category: item.category,
        image: typeof item.image === 'string' ? item.image : item.image.uri
      }
    });
  }, [router]);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    setToastVisible(true);

    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, bounciness: 8 }),
    ]).start();

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 50, duration: 300, useNativeDriver: true }),
      ]).start(() => setToastVisible(false));
    }, 2000);
  }, [fadeAnim, slideAnim]);

  const handleAddToCart = useCallback((item: RecentProduct) => {
    addToCart({
      id: item.id,
      title: item.title,
      category: item.category,
      price: item.price,
      image: item.image,
      storeId: item.storeId,
      storeName: item.storeName,
      storeLogo: item.storeLogo,
    });
    showToast(`${item.title} added to cart!`);
  }, [addToCart, showToast]);

  const applySort = (type: string) => {
    setActiveSort(type);
    setModalVisible(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const renderItem = useCallback(({ item }: { item: RecentProduct }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.9}
      onPress={() => handleProductPress(item)}
    >
      <View style={styles.imageContainer}>
        <AppImage source={item.image} style={styles.productImage} />
        <View style={styles.newBadge}>
          <Text style={styles.newText}>NEW</Text>
        </View>
        <TouchableOpacity style={styles.favBtn}>
          <Ionicons name="heart-outline" size={16} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.productInfo}>
        <Text style={styles.categoryText}>{item.category}</Text>
        <Text style={styles.productTitle} numberOfLines={1}>{item.title}</Text>

        <View style={styles.priceRow}>
          <Text style={styles.currentPrice}>{formatCurrency(item.price)}</Text>
        </View>

        <View style={styles.footerRow}>
          <View style={styles.timeBadge}>
            <Feather name="clock" size={10} color={colors.textSecondary} />
            <Text style={styles.timeText}>{item.timestamp}</Text>
          </View>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => handleAddToCart(item)}
          >
            {/* white icon on the fixed-primary button */}
            <Ionicons name="add" size={18} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  ), [handleAddToCart, handleProductPress]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* --- Background Watermark --- */}
      <View style={StyleSheet.absoluteFillObject}>
        <View style={styles.bottomLogos}>
          <AppImage
            source={require('../assets/images/splash-icon.png')}
            style={styles.fadedLogo}
          />
        </View>
      </View>

      {/* --- Header --- */}
      <View style={styles.headerWrapper}>
        <LinearGradient colors={colors.headerGradient} style={styles.header}>
          <SafeAreaView edges={['top', 'left', 'right']}>
            <View style={styles.headerContent}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                {/* white icon on the header gradient, fixed dark navy in both themes */}
                <Ionicons name="arrow-back" size={24} color="#FFF" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Just Arrived</Text>
              <TouchableOpacity style={styles.iconBtn} onPress={() => setModalVisible(true)}>
                {/* white icon on the header gradient, fixed dark navy in both themes */}
                <Ionicons name="filter" size={22} color="#FFF" />
              </TouchableOpacity>
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <Feather name="search" size={18} color={colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search recent items..."
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          </SafeAreaView>
        </LinearGradient>
      </View>

      {/* --- Content --- */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <RecentSkeleton  />
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.listContainer}
          columnWrapperStyle={styles.columnWrapper}
          showsVerticalScrollIndicator={false}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={10}
          removeClippedSubviews
          renderItem={renderItem}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Feather name="box" size={40} color={colors.textMuted} />
              <Text style={styles.emptyText}>No items found.</Text>
            </View>
          }
        />
      )}

      {/* --- TOAST NOTIFICATION --- */}
      {toastVisible && (
        <Animated.View
          style={[
            styles.toastContainer,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
          ]}
        >
          <View style={styles.toastContent}>
            <View style={styles.checkCircle}>
              {/* white icon on the fixed-accent circle */}
              <Ionicons name="checkmark" size={14} color="#FFF" />
            </View>
            <Text style={styles.toastText} numberOfLines={1}>{toastMessage}</Text>
          </View>
        </Animated.View>
      )}

      {/* --- SORT MODAL --- */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable onPress={() => setModalVisible(false)} style={styles.modalBackdrop}>
            <View style={styles.modalBackdrop} />
          </Pressable>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sort Products</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalDivider} />

            {[
              { id: 'newest', label: 'Newest Arrivals', icon: 'new-releases' },
              { id: 'low_high', label: 'Price: Low to High', icon: 'trending-up' },
              { id: 'high_low', label: 'Price: High to Low', icon: 'trending-down' }
            ].map((opt) => (
              <TouchableOpacity
                key={opt.id}
                style={styles.filterOption}
                onPress={() => applySort(opt.id)}
              >
                <View style={styles.optionRow}>
                  <MaterialIcons
                    name={opt.icon as any}
                    size={22}
                    color={activeSort === opt.id ? colors.primary : colors.textSecondary}
                  />
                  <Text style={[styles.optionText, activeSort === opt.id && styles.optionTextActive]}>
                    {opt.label}
                  </Text>
                </View>
                {activeSort === opt.id && <Ionicons name="checkmark-circle" size={22} color={colors.accent} />}
              </TouchableOpacity>
            ))}
            <View style={{ height: 20 }} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const getStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.background
  },

  // Background Watermark
  bottomLogos: {
    position: 'absolute',
    bottom: 20,
    left: -20,
  },
  fadedLogo: {
    width: 150,
    height: 150,
    resizeMode: 'contain',
    opacity: 0.03,
  },

  // Header
  headerWrapper: {
    marginBottom: 10,
  },
  header: {
    paddingBottom: 25,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: c.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 15,
  },
  backBtn: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.15)', // translucent button on the fixed-dark header gradient
    borderRadius: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Montserrat-Bold',
    color: '#FFF', // white text on the header gradient, fixed dark navy in both themes
  },
  iconBtn: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.15)', // translucent button on the fixed-dark header gradient
    borderRadius: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    marginHorizontal: 20,
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 45,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    fontFamily: 'Montserrat-Medium',
    color: c.text,
  },

  // List
  listContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 40,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Card
  card: {
    width: (width - 44) / 2,
    backgroundColor: c.surface,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
    overflow: 'hidden',
  },
  imageContainer: {
    height: 140,
    width: '100%',
    position: 'relative',
    backgroundColor: c.border,
  },
  productImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  newBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: c.accent,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  newText: {
    color: c.accentText,
    fontSize: 9,
    fontFamily: 'Montserrat-Bold',
  },
  favBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: c.surface,
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },

  // Info
  productInfo: {
    padding: 10,
  },
  categoryText: {
    fontSize: 10,
    fontFamily: 'Montserrat-Medium',
    color: c.textSecondary,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  productTitle: {
    fontSize: 13,
    fontFamily: 'Montserrat-SemiBold',
    color: c.text,
    marginBottom: 6,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  currentPrice: {
    fontSize: 15,
    fontFamily: 'Montserrat-Bold',
    color: c.primary,
    marginRight: 8,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.border,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  timeText: {
    fontSize: 10,
    color: c.textSecondary,
    fontFamily: 'Montserrat-Medium',
  },
  addBtn: {
    backgroundColor: c.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Toast
  toastContainer: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 100,
  },
  toastContent: {
    backgroundColor: c.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: c.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  toastText: {
    color: '#FFF', // white text on the fixed-primary toast
    fontSize: 13,
    fontFamily: 'Montserrat-Bold',
    flex: 1,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: c.overlay,
  },
  modalBackdrop: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Montserrat-Bold',
    color: c.text,
  },
  modalDivider: {
    height: 1,
    backgroundColor: c.borderStrong,
    marginBottom: 10,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionText: {
    fontSize: 15,
    fontFamily: 'Montserrat-Medium',
    color: c.text,
  },
  optionTextActive: {
    color: c.primary,
    fontFamily: 'Montserrat-Bold',
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 50,
  },
  emptyText: {
    marginTop: 10,
    color: c.textMuted,
    fontFamily: 'Montserrat-Medium',
  },
});