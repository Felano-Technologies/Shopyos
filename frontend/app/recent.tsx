import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Modal,
  Pressable,
  Animated,
  TextInput,
  ActivityIndicator
} from 'react-native';
import { Ionicons, Feather, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useCart } from './context/CartContext';
import { RecentSkeleton } from '../components/skeletons/RecentSkeleton';
import { useProducts } from '@/hooks/useProducts';

const { width } = Dimensions.get('window');

export default function RecentScreen() {
  const router = useRouter();
  const { addToCart } = useCart();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeSort, setActiveSort] = useState('created_at');
  const [modalVisible, setModalVisible] = useState(false);

  // --- Toast Animation State ---
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  // --- TanStack Query Hook ---
  const sortByParam = activeSort === 'low_high' ? 'price_asc' : activeSort === 'high_low' ? 'price_desc' : 'created_at';
  const { data, isLoading } = useProducts({ limit: 50, sortBy: sortByParam });
  
  const products = data?.products?.map((p: any) => ({
    id: p._id,
    title: p.name,
    category: p.category || 'General',
    price: p.price,
    oldPrice: null,
    image: p.images?.[0] ? { uri: p.images[0] } : require('../assets/images/icon.png'),
    timestamp: 'Just now'
  })) || [];

  // Filter products based on search query
  const filteredProducts = searchQuery
    ? products.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : products;

  const loading = isLoading;

  const handleProductPress = (item: any) => {
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
  };

  // --- Custom Toast Function ---
  const showToast = (message: string) => {
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
  };

  const handleAddToCart = (item: any) => {
    addToCart({
      id: item.id,
      title: item.title,
      category: item.category,
      price: item.price,
      image: item.image,
    });
    showToast(`${item.title} added to cart!`);
  };

  const applySort = (type: string) => {
    setActiveSort(type);
    setModalVisible(false);
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.9}
      onPress={() => handleProductPress(item)}
    >
      <View style={styles.imageContainer}>
        <Image source={item.image} style={styles.productImage} />
        <View style={styles.newBadge}>
          <Text style={styles.newText}>NEW</Text>
        </View>
        <TouchableOpacity style={styles.favBtn}>
          <Ionicons name="heart-outline" size={16} color="#0C1559" />
        </TouchableOpacity>
      </View>

      <View style={styles.productInfo}>
        <Text style={styles.categoryText}>{item.category}</Text>
        <Text style={styles.productTitle} numberOfLines={1}>{item.title}</Text>

        <View style={styles.priceRow}>
          <Text style={styles.currentPrice}>₵{item.price.toFixed(2)}</Text>
        </View>

        <View style={styles.footerRow}>
          <View style={styles.timeBadge}>
            <Feather name="clock" size={10} color="#64748B" />
            <Text style={styles.timeText}>{item.timestamp}</Text>
          </View>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => handleAddToCart(item)}
          >
            <Ionicons name="add" size={18} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* --- Background Watermark --- */}
      <View style={StyleSheet.absoluteFillObject}>
        <View style={styles.bottomLogos}>
          <Image
            source={require('../assets/images/splash-icon.png')}
            style={styles.fadedLogo}
          />
        </View>
      </View>

      {/* --- Header --- */}
      <View style={styles.headerWrapper}>
        <LinearGradient colors={['#0C1559', '#1e3a8a']} style={styles.header}>
          <SafeAreaView edges={['top', 'left', 'right']}>
            <View style={styles.headerContent}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={24} color="#FFF" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Just Arrived</Text>
              <TouchableOpacity style={styles.iconBtn} onPress={() => setModalVisible(true)}>
                <Ionicons name="filter" size={22} color="#FFF" />
              </TouchableOpacity>
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <Feather name="search" size={18} color="#94A3B8" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search recent items..."
                placeholderTextColor="#94A3B8"
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
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Feather name="box" size={40} color="#CBD5E1" />
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
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalDivider} />

            {[
              { id: 'created_at', label: 'Newest Arrivals', icon: 'new-releases' },
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
                    color={activeSort === opt.id ? "#0C1559" : "#64748B"}
                  />
                  <Text style={[styles.optionText, activeSort === opt.id && styles.optionTextActive]}>
                    {opt.label}
                  </Text>
                </View>
                {activeSort === opt.id && <Ionicons name="checkmark-circle" size={22} color="#84cc16" />}
              </TouchableOpacity>
            ))}
            <View style={{ height: 20 }} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e9f0ff'
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
    opacity: 0.08,
  },

  // Header
  headerWrapper: {
    marginBottom: 10,
  },
  header: {
    paddingBottom: 25,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: "#0C1559",
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
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Montserrat-Bold',
    color: '#FFF',
  },
  iconBtn: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
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
    color: '#0F172A',
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
    backgroundColor: '#FFF',
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
    backgroundColor: '#F1F5F9',
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
    backgroundColor: '#84cc16',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  newText: {
    color: '#0F172A',
    fontSize: 9,
    fontFamily: 'Montserrat-Bold',
  },
  favBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FFF',
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
    color: '#64748B',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  productTitle: {
    fontSize: 13,
    fontFamily: 'Montserrat-SemiBold',
    color: '#0F172A',
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
    color: '#0C1559',
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
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  timeText: {
    fontSize: 10,
    color: '#64748B',
    fontFamily: 'Montserrat-Medium',
  },
  addBtn: {
    backgroundColor: '#0C1559',
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
    backgroundColor: '#0C1559',
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
    backgroundColor: '#84cc16',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  toastText: {
    color: '#FFF',
    fontSize: 13,
    fontFamily: 'Montserrat-Bold',
    flex: 1,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalBackdrop: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: '#FFF',
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
    color: '#0F172A',
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginBottom: 10,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionText: {
    fontSize: 15,
    fontFamily: 'Montserrat-Medium',
    color: '#334155',
  },
  optionTextActive: {
    color: '#0C1559',
    fontFamily: 'Montserrat-Bold',
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 50,
  },
  emptyText: {
    marginTop: 10,
    color: '#94A3B8',
    fontFamily: 'Montserrat-Medium',
  },
});