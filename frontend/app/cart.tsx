import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Platform,
  Animated, PanResponder, Alert,
} from 'react-native';
import AppImage from '@/components/AppImage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useNavigation } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useCart } from '@/store/cartStore';
import { useOnboarding } from '@/context/OnboardingContext';
import { SpotlightTour } from '@/components/ui/SpotlightTour';
import { HeroAd } from '@/components/home/HeroCarousel';
import { CompactAdCarousel } from '@/components/home/CompactAdCarousel';
import { getActiveBanners, recordAdClick } from '@/services/api';

type CartItem = {
  id: string;
  title: string;
  price: number;
  quantity: number;
  image: string | number;
  category: string;
};

type SwipeableProps = {
  item: CartItem;
  index: number;
  refQty: React.RefObject<View>;
  measureElement: (ref: any, key: string) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, delta: number) => void;
};

function SwipeableCartItem({ item, index, refQty, measureElement, removeFromCart, updateQuantity }: Readonly<SwipeableProps>) {
  const translateX = useRef(new Animated.Value(0)).current;
  const SWIPE_THRESHOLD = -60;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8,
      onPanResponderMove: (_, { dx }) => {
        if (dx < 0) translateX.setValue(Math.max(dx, -90));
      },
      onPanResponderRelease: (_, { dx }) => {
        if (dx < SWIPE_THRESHOLD) {
          Animated.spring(translateX, { toValue: -90, useNativeDriver: true }).start();
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  const handleDelete = () => {
    Animated.timing(translateX, { toValue: -500, duration: 220, useNativeDriver: true }).start(() => {
      removeFromCart(item.id);
    });
  };

  const handleDecrement = () => {
    if (item.quantity === 1) {
      Alert.alert(
        'Remove Item',
        `Remove "${item.title}" from your cart?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: () => removeFromCart(item.id) },
        ]
      );
    } else {
      updateQuantity(item.id, -1);
    }
  };

  const lineTotal = Number(item.price || 0) * item.quantity;

  return (
    <View style={styles.swipeContainer}>
      <View style={styles.deleteBackground}>
        <TouchableOpacity onPress={handleDelete} style={styles.deleteAction}>
          <Feather name="trash-2" size={22} color="#FFF" />
          <Text style={styles.deleteActionText}>Remove</Text>
        </TouchableOpacity>
      </View>

      <Animated.View
        style={[styles.cartItem, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        <AppImage
          uri={typeof item.image === 'number' ? undefined : item.image}
          style={styles.itemImage}
        />
        <View style={styles.itemDetails}>
          <View style={styles.titleRow}>
            <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
            <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
              <Feather name="trash-2" size={16} color="#EF4444" />
            </TouchableOpacity>
          </View>
          <Text style={styles.itemCategory}>{item.category}</Text>
          <View style={styles.priceControlRow}>
            <View>
              <Text style={styles.itemPrice}>₵{Number(item.price || 0).toFixed(2)}</Text>
              {item.quantity > 1 && (
                <Text style={styles.itemSubtotal}>× {item.quantity} = ₵{lineTotal.toFixed(2)}</Text>
              )}
            </View>
            <View
              style={styles.qtyContainer}
              ref={index === 0 ? refQty : undefined}
              onLayout={index === 0 ? () => measureElement(refQty, 'qty') : undefined}
            >
              <TouchableOpacity
                style={[styles.qtyBtn, item.quantity === 1 && styles.qtyBtnDanger]}
                onPress={handleDecrement}
              >
                {item.quantity === 1
                  ? <Feather name="trash-2" size={12} color="#EF4444" />
                  : <Feather name="minus" size={14} color="#0C1559" />}
              </TouchableOpacity>
              <Text style={styles.qtyText}>{item.quantity}</Text>
              <TouchableOpacity
                style={[styles.qtyBtn, styles.qtyBtnActive]}
                onPress={() => updateQuantity(item.id, 1)}
              >
                <Feather name="plus" size={14} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

export default function CartScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { items: cartItems, removeFromCart, updateQuantity } = useCart();
  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const [cartAds, setCartAds] = useState<HeroAd[]>([]);
  const total = subtotal;

  useEffect(() => {
    (async () => {
      try {
        const res = await getActiveBanners();
        if (res?.banners?.length > 0) setCartAds(res.banners);
      } catch { }
    })();
  }, []);

  const handleAdPress = useCallback((ad: HeroAd) => {
    recordAdClick(ad.id).catch(() => {});
    if (ad.product?.id) {
      router.push({ pathname: '/product/details', params: { id: ad.product.id } } as any);
    } else if (ad.store_id) {
      router.push({ pathname: '/stores/details', params: { id: ad.store_id } } as any);
    }
  }, [router]);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const { startTour, markCompleted, isTourActive, activeScreen } = useOnboarding();
  const [layouts, setLayouts] = useState<any>({});
  const refQty = useRef<View>(null);
  const refCheckout = useRef<View>(null);

  const measureElement = (ref: any, key: string) => {
    if (ref.current) {
      ref.current.measureInWindow((x: number, y: number, width: number, height: number) => {
        setLayouts((prev: any) => ({ ...prev, [key]: { x, y, width, height } }));
      });
    }
  };

  useEffect(() => {
    if (cartItems.length > 0) {
      const timer = setTimeout(() => {
        measureElement(refQty, 'qty');
        measureElement(refCheckout, 'checkout');
        startTour('cart');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [cartItems.length, startTour]);

  const onboardingSteps = [
    {
      targetLayout: layouts.qty,
      title: 'Adjust Quantities',
      description: 'Need more or less? Quickly update item counts here.',
    },
    {
      targetLayout: layouts.checkout,
      title: 'Ready to Order?',
      description: 'Proceed to checkout to choose your delivery and payment options.',
    },
  ].filter(s => !!s.targetLayout);

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor="#0C1559" />
      <LinearGradient colors={['#0C1559', '#1e3a8a']} style={styles.header}>
        <SafeAreaView edges={['top', 'left', 'right']} style={styles.headerSafe}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>My Cart</Text>
            <View style={styles.cartCountBadge}>
              <Text style={styles.cartCountText}>{cartItems.length}</Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {cartAds.length > 0 && (
        <CompactAdCarousel ads={cartAds} onAdPress={handleAdPress} />
      )}

      <FlatList
        data={cartItems}
        keyExtractor={item => item.id}
        renderItem={({ item, index }) => (
          <SwipeableCartItem
            item={item}
            index={index}
            refQty={refQty}
            measureElement={measureElement}
            removeFromCart={removeFromCart}
            updateQuantity={updateQuantity}
          />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="cart-outline" size={80} color="#CBD5E1" />
            <Text style={styles.emptyText}>Your cart is empty</Text>
            <TouchableOpacity style={styles.shopBtn} onPress={() => router.back()}>
              <Text style={styles.shopBtnText}>Start Shopping</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {cartItems.length > 0 && (
        <View style={styles.summaryContainer}>
          {/* Total + Checkout */}
          <View style={styles.summaryRow}>
            <View>
              <Text style={styles.summaryLabel}>Order Total</Text>
              <Text style={styles.totalValue}>₵{total.toFixed(2)}</Text>
            </View>
            <TouchableOpacity
              style={styles.checkoutBtn}
              onPress={() => router.push('/checkout' as any)}
              ref={refCheckout}
              onLayout={() => measureElement(refCheckout, 'checkout')}
            >
              <LinearGradient colors={['#0C1559', '#1e3a8a']} style={styles.checkoutGradient}>
                <Text style={styles.checkoutText}>Checkout</Text>
                <Feather name="arrow-right" size={20} color="#FFF" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <SpotlightTour
        visible={isTourActive && activeScreen === 'cart'}
        steps={onboardingSteps}
        onComplete={() => markCompleted('cart')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: { paddingBottom: 25 },
  headerSafe: { width: '100%' },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 10,
  },
  backBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12 },
  headerTitle: { fontSize: 20, fontFamily: 'Montserrat-Bold', color: '#FFF' },
  cartCountBadge: { backgroundColor: '#A3E635', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  cartCountText: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#0C1559' },

  listContent: { paddingVertical: 12, paddingBottom: 200 },

  // Swipe-to-delete
  swipeContainer: { marginBottom: 10, overflow: 'hidden' },
  deleteBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#EF4444',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 8,
  },
  deleteAction: { alignItems: 'center', justifyContent: 'center', width: 70, paddingVertical: 12 },
  deleteActionText: { color: '#FFF', fontSize: 11, fontFamily: 'Montserrat-Bold', marginTop: 4 },

  // Cart item
  cartItem: {
    flexDirection: 'row', backgroundColor: '#FFF',
    padding: 12, elevation: 1,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  itemImage: { width: 95, height: 95, borderRadius: 10, backgroundColor: '#F1F5F9' },
  itemDetails: { flex: 1, marginLeft: 12, justifyContent: 'space-between' },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  itemTitle: { flex: 1, fontSize: 13, fontFamily: 'Montserrat-Bold', color: '#0F172A', lineHeight: 18 },
  deleteBtn: { padding: 4, backgroundColor: '#FEF2F2', borderRadius: 6, marginLeft: 6 },
  itemCategory: { fontSize: 11, fontFamily: 'Montserrat-Medium', color: '#94A3B8', marginTop: 2 },
  priceControlRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginTop: 6,
  },
  itemPrice: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
  itemSubtotal: { fontSize: 10, fontFamily: 'Montserrat-Medium', color: '#64748B', marginTop: 1 },
  qtyContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC',
    borderRadius: 10, padding: 3, borderWidth: 1, borderColor: '#F1F5F9',
  },
  qtyBtn: {
    width: 26, height: 26, borderRadius: 7,
    justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF',
  },
  qtyBtnActive: { backgroundColor: '#0C1559' },
  qtyBtnDanger: { backgroundColor: '#FEF2F2' },
  qtyText: { marginHorizontal: 10, fontSize: 13, fontFamily: 'Montserrat-Bold', color: '#0F172A' },

  // Summary panel
  summaryContainer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFF',
    borderTopWidth: 1, borderTopColor: '#F1F5F9',
    paddingHorizontal: 20, paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    elevation: 25,
  },


  // Total row
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: 11, fontFamily: 'Montserrat-Medium', color: '#64748B' },
  totalValue: { fontSize: 19, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
  checkoutBtn: { borderRadius: 10, overflow: 'hidden', flex: 1, marginLeft: 20 },
  checkoutGradient: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    paddingVertical: 16, gap: 10,
  },
  checkoutText: { color: '#FFF', fontSize: 16, fontFamily: 'Montserrat-Bold' },

  // Empty state
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
  emptyText: { fontSize: 18, fontFamily: 'Montserrat-SemiBold', color: '#94A3B8', marginTop: 20, marginBottom: 30 },
  shopBtn: { backgroundColor: '#0C1559', paddingHorizontal: 30, paddingVertical: 15, borderRadius: 20 },
  shopBtnText: { color: '#FFF', fontFamily: 'Montserrat-Bold' },
});
