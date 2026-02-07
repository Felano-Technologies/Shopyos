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
  TouchableWithoutFeedback,
  Animated, // Import Animated
  Platform,
} from 'react-native';
import { Ionicons, Feather, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useCart } from './context/CartContext';
import { searchProducts } from '@/services/api';

const { width } = Dimensions.get('window');

// Extended Mock Data
const RecentScreen = () => {
  const router = useRouter();
  const { addToCart } = useCart();

  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [activeSort, setActiveSort] = useState('created_at');

  useEffect(() => {
    fetchRecentProducts();
  }, [activeSort]);

  const fetchRecentProducts = async () => {
    try {
      setLoading(true);
      const res = await searchProducts({
        limit: 20,
        sortBy: activeSort === 'low_high' ? 'price_asc' : activeSort === 'high_low' ? 'price_desc' : 'created_at'
      });
      if (res.success) {
        // Map backend products to UI format
        const mapped = res.products.map((p: any) => ({
          id: p._id,
          title: p.name,
          category: p.category || 'General',
          price: p.price,
          oldPrice: null, // Backend doesn't have oldPrice yet
          image: p.images?.[0] ? { uri: p.images[0] } : require('../assets/images/icon.png'),
          timestamp: 'Just now' // Placeholder as created_at logic needs formatting
        }));
        setProducts(mapped);
      }
    } catch (e) {
      console.error("Failed to fetch recent products", e);
    } finally {
      setLoading(false);
    }
  };

  // --- Toast Animation State ---
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current; // Start 50px down

  // --- Navigation ---
  const handleProductPress = (item: any) => {
    router.push({
      pathname: '/product/details',
      params: {
        id: item.id,
        title: item.title,
        price: item.price,
        oldPrice: item.oldPrice,
        category: item.category,
        image: item.image
      }
    });
  };

  // --- Custom Toast Function ---
  const showToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);

    // Animate In (Fade + Slide Up)
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 8,
      }),
    ]).start();

    // Auto Hide after 2 seconds
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 50, // Slide back down
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => setToastVisible(false));
    }, 2000);
  };

  // --- Add to Cart ---
  const handleAddToCart = (item: any) => {
    const cartItem = {
      id: item.id,
      title: item.title,
      category: item.category,
      price: item.price,
      image: item.image,
      quantity: 1,
    };

    addToCart(cartItem);

    // Trigger Custom Toast
    showToast(`${item.title} added to cart!`);
  };

  // --- Sorting ---
  const applySort = (type: string) => {
    setActiveSort(type);
    setModalVisible(false);
    // useEffect will trigger fetch
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
          <Ionicons name="heart-outline" size={18} color="#0C1559" />
        </TouchableOpacity>
      </View>

      <View style={styles.productInfo}>
        <Text style={styles.categoryText}>{item.category}</Text>
        <Text style={styles.productTitle} numberOfLines={1}>{item.title}</Text>

        <View style={styles.priceRow}>
          <Text style={styles.currentPrice}>₵{item.price.toFixed(2)}</Text>
          {item.oldPrice && (
            <Text style={styles.oldPrice}>₵{item.oldPrice.toFixed(2)}</Text>
          )}
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

      {/* Header */}
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
        </SafeAreaView>
      </LinearGradient>

      {/* List */}
      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.listContainer}
        columnWrapperStyle={styles.columnWrapper}
        showsVerticalScrollIndicator={false}
        renderItem={renderItem}
      />

      {/* --- CUSTOM TOAST NOTIFICATION --- */}
      {toastVisible && (
        <Animated.View
          style={[
            styles.toastContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <View style={styles.toastContent}>
            <View style={styles.checkCircle}>
              <Ionicons name="checkmark" size={16} color="#0C1559" />
            </View>
            <Text style={styles.toastText} numberOfLines={1}>{toastMessage}</Text>
          </View>
        </Animated.View>
      )}

      {/* Filter Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
            <View style={styles.modalBackdrop} />
          </TouchableWithoutFeedback>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sort Products</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalDivider} />
            <TouchableOpacity style={styles.filterOption} onPress={() => applySort('created_at')}>
              <View style={styles.optionRow}>
                <MaterialIcons name="new-releases" size={22} color="#0C1559" />
                <Text style={[styles.optionText, activeSort === 'created_at' && styles.optionTextActive]}>Newest Arrivals (Reset)</Text>
              </View>
              {activeSort === 'created_at' && <Ionicons name="checkmark-circle" size={24} color="#84cc16" />}
            </TouchableOpacity>
            <TouchableOpacity style={styles.filterOption} onPress={() => applySort('low_high')}>
              <View style={styles.optionRow}>
                <Feather name="trending-up" size={22} color="#0C1559" />
                <Text style={[styles.optionText, activeSort === 'low_high' && styles.optionTextActive]}>Price: Low to High</Text>
              </View>
              {activeSort === 'low_high' && <Ionicons name="checkmark-circle" size={24} color="#84cc16" />}
            </TouchableOpacity>
            <TouchableOpacity style={styles.filterOption} onPress={() => applySort('high_low')}>
              <View style={styles.optionRow}>
                <Feather name="trending-down" size={22} color="#0C1559" />
                <Text style={[styles.optionText, activeSort === 'high_low' && styles.optionTextActive]}>Price: High to Low</Text>
              </View>
              {activeSort === 'high_low' && <Ionicons name="checkmark-circle" size={24} color="#84cc16" />}
            </TouchableOpacity>
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
    backgroundColor: '#F0F4FC'
  },

  // Header
  header: {
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    zIndex: 10,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 10,
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
  },

  // List
  listContainer: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 40,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },

  // Card
  card: {
    width: (width - 44) / 2,
    backgroundColor: '#FFF',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: "#0C1559",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  imageContainer: {
    height: 140,
    width: '100%',
    position: 'relative',
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
    backgroundColor: '#84cc16', // Lime Green
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  newText: {
    color: '#0F172A',
    fontSize: 10,
    fontFamily: 'Montserrat-Bold',
  },
  favBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FFF',
    width: 28,
    height: 28,
    borderRadius: 14,
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
    fontSize: 16,
    fontFamily: 'Montserrat-Bold',
    color: '#0C1559',
    marginRight: 8,
  },
  oldPrice: {
    fontSize: 12,
    fontFamily: 'Montserrat-Regular',
    color: '#94A3B8',
    textDecorationLine: 'line-through',
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

  // --- TOAST STYLES ---
  toastContainer: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 100,
  },
  toastContent: {
    backgroundColor: '#0C1559', // Deep Blue
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
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#84cc16', // Lime Green
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  toastText: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
    flex: 1, // Ensure text truncates if too long
  },

  // --- MODAL STYLES ---
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
    marginBottom: 16,
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
});