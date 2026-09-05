import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Platform, Image,
  Modal, TextInput, Keyboard,
} from 'react-native';
import AppImage from '@/components/AppImage';
import { ConfirmModal } from '@/components/ConfirmModal';
import { CustomInAppToast } from '@/components/InAppToastHost';
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
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';
import { formatCurrency } from '@/utils/formatCurrency';
import MapView, { UrlTile } from '@/components/MapView';
import { OSM_TILE_URL_TEMPLATE } from '@/constants/mapTiles';
import * as Location from 'expo-location';
import { requestForegroundLocationWithDisclosure } from '@/src/utils/location';
import { GlassContainer } from 'expo-glass-effect';
import { GlassSurface } from '@/components/ui/GlassSurface';

type CartItem = {
  id: string;
  title: string;
  price: number;
  quantity: number;
  image: string | number;
  category: string;
  bargain_discount?: number;
  bargain_offer_id?: string;
};

type CartItemRowProps = {
  item: CartItem;
  index: number;
  refQty: React.RefObject<View>;
  measureElement: (ref: any, key: string) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, delta: number) => void;
};

const CartItemRow = React.memo(function CartItemRow({ item, index, refQty, measureElement, removeFromCart, updateQuantity }: Readonly<CartItemRowProps>) {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  const goToDetails = () => {
    router.push({ pathname: '/product/details', params: { id: item.id } } as any);
  };

  const handleDecrement = () => {
    if (item.quantity === 1) {
      setShowRemoveConfirm(true);
    } else {
      updateQuantity(item.id, -1);
    }
  };

  const discount = Number(item.bargain_discount || 0);
  const effectivePrice = Number(item.price || 0) - discount;
  const lineTotal = effectivePrice * item.quantity;

  return (
    <View style={styles.swipeContainer}>
      <View style={styles.cartItem}>
        <TouchableOpacity
          accessibilityLabel={`View ${item.title} details`}
          accessibilityRole="button"
          activeOpacity={0.85}
          style={styles.itemTapArea}
          onPress={goToDetails}
        >
          <AppImage
            uri={typeof item.image === 'number' ? undefined : item.image}
            style={styles.itemImage}
          />
          <View style={styles.itemDetails}>
            <View style={styles.titleRow}>
              <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
            </View>
            <Text style={styles.itemCategory}>{item.category}</Text>
            <View>
              {discount > 0 ? (
                <>
                  <Text style={styles.itemPriceStrikethrough}>{formatCurrency(item.price)}</Text>
                  <Text style={styles.itemPriceBargained}>{formatCurrency(effectivePrice)}</Text>
                </>
              ) : (
                <Text style={styles.itemPrice}>{formatCurrency(item.price)}</Text>
              )}
              {item.quantity > 1 && (
                <Text style={styles.itemSubtotal}>× {item.quantity} = {formatCurrency(lineTotal)}</Text>
              )}
            </View>
          </View>
        </TouchableOpacity>
        <View style={styles.itemSideControls}>
          <TouchableOpacity accessibilityLabel="Delete item" accessibilityRole="button" onPress={() => setShowRemoveConfirm(true)} style={styles.deleteBtn}>
            <Feather name="trash-2" size={16} color={colors.error} />
          </TouchableOpacity>
          <View
            style={styles.qtyContainer}
            ref={index === 0 ? refQty : undefined}
            onLayout={index === 0 ? () => measureElement(refQty, 'qty') : undefined}
          >
            <TouchableOpacity
              accessibilityLabel="Decrease quantity"
              accessibilityRole="button"
              style={[styles.qtyBtn, item.quantity === 1 && styles.qtyBtnDanger]}
              onPress={handleDecrement}
            >
              {item.quantity === 1
                ? <Feather name="trash-2" size={12} color={colors.error} />
                : <Feather name="minus" size={14} color={colors.primary} />}
            </TouchableOpacity>
            <Text style={styles.qtyText}>{item.quantity}</Text>
            <TouchableOpacity
              accessibilityLabel="Increase quantity"
              accessibilityRole="button"
              style={[styles.qtyBtn, styles.qtyBtnActive]}
              onPress={() => updateQuantity(item.id, 1)}
            >
              <Feather name="plus" size={14} color="#FFF" />{/* white icon on primary-colored button, readable in both themes */}
            </TouchableOpacity>
          </View>
        </View>
      </View>
      <ConfirmModal
        visible={showRemoveConfirm}
        onClose={() => setShowRemoveConfirm(false)}
        title="Remove Item"
        message={`Remove "${item.title}" from your cart?`}
        icon="🗑️"
        actions={[
          { label: 'Cancel', onPress: () => setShowRemoveConfirm(false), variant: 'cancel' },
          { label: 'Remove', onPress: () => { setShowRemoveConfirm(false); removeFromCart(item.id); }, variant: 'destructive' },
        ]}
      />
    </View>
  );
});

export default function CartScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const cartItems = useCart((s) => s.items);
  const removeFromCart = useCart((s) => s.removeFromCart);
  const updateQuantity = useCart((s) => s.updateQuantity);
  const deliveryCoords = useCart((s) => s.deliveryCoords);
  const setDeliveryCoords = useCart((s) => s.setDeliveryCoords);
  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const [cartAds, setCartAds] = useState<HeroAd[]>([]);
  const total = subtotal;

  // Delivery-location map picker — asked here, before checkout, since a
  // delivery can take days and the buyer's position at checkout time isn't
  // where the order ships. Same pattern as business/businessRegistration.tsx's
  // store-location picker: fixed center pin, Nominatim search-to-jump.
  const [mapVisible, setMapVisible] = useState(false);
  const [mapSearchQuery, setMapSearchQuery] = useState('');
  const [tempMapCoords, setTempMapCoords] = useState({ latitude: 5.6037, longitude: -0.1870 }); // Accra fallback only
  const [liveCoords, setLiveCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const mapRef = useRef<MapView>(null);

  // Fetch the buyer's live position early so the map opens centered on
  // roughly where they are, instead of a fixed Accra default they'd have to
  // search/scroll away from every time.
  useEffect(() => {
    (async () => {
      try {
        const { status } = await requestForegroundLocationWithDisclosure();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setLiveCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        }
      } catch {
        // Falls back to the fixed default center — buyer can still search/drag.
      }
    })();
  }, []);

  const openDeliveryMap = () => {
    if (deliveryCoords) {
      setTempMapCoords({ latitude: deliveryCoords.lat, longitude: deliveryCoords.lng });
    } else if (liveCoords) {
      setTempMapCoords(liveCoords);
    }
    setMapVisible(true);
  };

  const confirmDeliveryLocation = () => {
    setDeliveryCoords({ lat: tempMapCoords.latitude, lng: tempMapCoords.longitude });
    setMapVisible(false);
    router.push('/checkout' as any);
  };

  const handleMapSearch = async () => {
    const query = mapSearchQuery.trim();
    if (!query) return;
    Keyboard.dismiss();
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
        { headers: { 'User-Agent': 'ShopyosApp/1.0' } }
      );
      const results = await res.json();
      if (!results?.[0]) {
        CustomInAppToast.show({ type: 'info', title: 'No Results', message: `Couldn't find "${query}". Try a more specific address.` });
        return;
      }
      const { lat, lon } = results[0];
      mapRef.current?.animateToRegion({
        latitude: Number.parseFloat(lat),
        longitude: Number.parseFloat(lon),
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }, 1000);
    } catch (error) {
      console.warn('Map search failed:', error);
      CustomInAppToast.show({ type: 'error', title: 'Search Failed', message: 'Could not reach the map search service. Please drag the pin manually.' });
    }
  };

  const handleCheckoutPress = () => {
    if (deliveryCoords) {
      router.push('/checkout' as any);
    } else {
      openDeliveryMap();
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await getActiveBanners();
        if (res?.banners?.length > 0) setCartAds(res.banners);
      } catch (e) {
        console.error('Failed to load banner ads:', e);
      }
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
      <StatusBar style="light" backgroundColor={colors.primary} />
      <LinearGradient colors={colors.headerGradient} style={styles.header}>
        <SafeAreaView edges={['top', 'left', 'right']} style={styles.headerSafe}>
          <View style={styles.headerRow}>
            <TouchableOpacity accessibilityLabel="Go back" accessibilityRole="button" onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />{/* white icon on header gradient, fixed dark navy in both themes */}
            </TouchableOpacity>
            <Text style={styles.headerTitle}>My Cart</Text>
            <View style={styles.cartCountBadge}>
              <Text style={styles.cartCountText}>{cartItems.length}</Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {cartAds.length > 0 ? (
        <CompactAdCarousel ads={cartAds} onAdPress={handleAdPress} />
      ) : (
        <View style={styles.adPlaceholder}>
          <Image
            source={require('@/assets/images/Shopyos Banner.png')}
            style={styles.adPlaceholderImg}
            resizeMode="cover"
          />
        </View>
      )}

      <FlatList
        data={cartItems}
        keyExtractor={item => item.id}
        renderItem={({ item, index }) => (
          <CartItemRow
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
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={8}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="cart-outline" size={80} color={colors.textMuted} />
            <Text style={styles.emptyText}>Your cart is empty</Text>
            <TouchableOpacity accessibilityLabel="Start shopping" accessibilityRole="button" style={styles.shopBtn} onPress={() => router.back()}>
              <Text style={styles.shopBtnText}>Start Shopping</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {cartItems.length > 0 && (
        <View style={styles.summaryContainer}>
          {deliveryCoords && (
            <TouchableOpacity accessibilityLabel="Change delivery location" accessibilityRole="button" style={styles.deliveryLocationRow} onPress={openDeliveryMap}>
              <Ionicons name="location" size={13} color={colors.primary} />
              <Text style={styles.deliveryLocationText}>Delivering to a pinned location</Text>
              <Text style={styles.deliveryLocationChange}>Change</Text>
            </TouchableOpacity>
          )}
          {/* Total + Checkout */}
          <View style={styles.summaryRow}>
            <View>
              <Text style={styles.summaryLabel}>Order Total</Text>
              <Text style={styles.totalValue}>{formatCurrency(total)}</Text>
            </View>
            <TouchableOpacity
              accessibilityLabel="Proceed to checkout"
              accessibilityRole="button"
              style={styles.checkoutBtn}
              onPress={handleCheckoutPress}
              ref={refCheckout}
              onLayout={() => measureElement(refCheckout, 'checkout')}
            >
              <LinearGradient colors={colors.headerGradient} style={styles.checkoutGradient}>
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

      {/* --- DELIVERY LOCATION MAP PICKER --- */}
      <Modal visible={mapVisible} animationType="slide">
        <View style={{ flex: 1 }}>
          <MapView
            ref={mapRef}
            style={{ flex: 1 }}
            initialRegion={{
              latitude: tempMapCoords.latitude,
              longitude: tempMapCoords.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
            onRegionChangeComplete={(region) => {
              setTempMapCoords({ latitude: region.latitude, longitude: region.longitude });
            }}
          >
            <UrlTile
              urlTemplate={OSM_TILE_URL_TEMPLATE}
              maximumZ={19}
              flipY={false}
              zIndex={-1}
            />
          </MapView>

          <View style={styles.mapMarkerFixed} pointerEvents="none">
            <View style={styles.markerCircle}><Ionicons name="location" size={26} color="#FFF" /></View>
            <View style={styles.markerArrow} />
          </View>
          <SafeAreaView style={styles.mapOverlay} pointerEvents="box-none">
            <GlassContainer style={styles.mapSearchContainer} spacing={0}>
              <TouchableOpacity onPress={() => setMapVisible(false)}>
                <GlassSurface style={styles.mapSearchClose} isInteractive>
                  <Ionicons name="arrow-back" size={24} color="#0C1559" />
                </GlassSurface>
              </TouchableOpacity>
              <GlassSurface style={styles.mapSearchWrapper}>
                <Ionicons name="search" size={18} color="#94A3B8" />
                <TextInput
                  style={styles.mapSearchInput}
                  placeholder="Search street or landmark..."
                  placeholderTextColor="#94A3B8"
                  value={mapSearchQuery}
                  onChangeText={setMapSearchQuery}
                  onSubmitEditing={handleMapSearch}
                  returnKeyType="search"
                />
                {mapSearchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setMapSearchQuery('')}>
                    <Ionicons name="close-circle" size={18} color="#94A3B8" />
                  </TouchableOpacity>
                )}
              </GlassSurface>
            </GlassContainer>

            <TouchableOpacity onPress={confirmDeliveryLocation}>
              <GlassSurface style={styles.mapConfirmBtn} tintColor={colors.primary} isInteractive>
                <LinearGradient colors={colors.headerGradient} style={styles.mapConfirmGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  <Text style={styles.mapConfirmText}>Confirm Delivery Location</Text>
                  <Feather name="check" size={20} color="#FFF" style={{ marginLeft: 10 }} />
                </LinearGradient>
              </GlassSurface>
            </TouchableOpacity>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingBottom: 25 },
  headerSafe: { width: '100%' },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 10,
  },
  backBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12 }, // on the fixed header gradient
  headerTitle: { fontSize: 20, fontFamily: 'Montserrat-Bold', color: '#FFF' }, // header text, fixed navy gradient
  cartCountBadge: { backgroundColor: '#A3E635', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }, // fixed accent badge on header
  cartCountText: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#0C1559' }, // text on the fixed accent badge

  listContent: { paddingVertical: 12, paddingBottom: 200 },

  swipeContainer: { marginBottom: 10, overflow: 'hidden' },

  // Cart item
  cartItem: {
    flexDirection: 'row', backgroundColor: colors.surface,
    padding: 12, elevation: 1,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  itemTapArea: { flex: 1, flexDirection: 'row' },
  itemSideControls: { alignItems: 'flex-end', justifyContent: 'space-between', marginLeft: 6 },
  itemImage: { width: 95, height: 95, borderRadius: 10, backgroundColor: colors.border },
  itemDetails: { flex: 1, marginLeft: 12, justifyContent: 'space-between' },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  itemTitle: { flex: 1, fontSize: 13, fontFamily: 'Montserrat-Bold', color: colors.text, lineHeight: 18 },
  deleteBtn: { padding: 4, backgroundColor: colors.errorBg, borderRadius: 6, marginBottom: 6 },
  itemCategory: { fontSize: 11, fontFamily: 'Montserrat-Medium', color: colors.textMuted, marginTop: 2 },
  itemPrice: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: colors.primary },
  itemPriceStrikethrough: { fontSize: 11, fontFamily: 'Montserrat-Medium', color: colors.textMuted, textDecorationLine: 'line-through' },
  itemPriceBargained: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: colors.success },
  itemSubtotal: { fontSize: 10, fontFamily: 'Montserrat-Medium', color: colors.textSecondary, marginTop: 1 },
  qtyContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceElevated,
    borderRadius: 10, padding: 3, borderWidth: 1, borderColor: colors.border,
  },
  qtyBtn: {
    width: 26, height: 26, borderRadius: 7,
    justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface,
  },
  qtyBtnActive: { backgroundColor: colors.primary },
  qtyBtnDanger: { backgroundColor: colors.errorBg },
  qtyText: { marginHorizontal: 10, fontSize: 13, fontFamily: 'Montserrat-Bold', color: colors.text },

  // Summary panel
  summaryContainer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.border,
    paddingHorizontal: 20, paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    elevation: 25,
  },


  // Total row
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: 11, fontFamily: 'Montserrat-Medium', color: colors.textSecondary },
  totalValue: { fontSize: 19, fontFamily: 'Montserrat-Bold', color: colors.primary },
  checkoutBtn: { borderRadius: 10, overflow: 'hidden', flex: 1, marginLeft: 20 },
  checkoutGradient: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    paddingVertical: 16, gap: 10,
  },
  checkoutText: { color: '#FFF', fontSize: 16, fontFamily: 'Montserrat-Bold' }, // white text on the fixed accent gradient button

  deliveryLocationRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 10,
  },
  deliveryLocationText: { flex: 1, fontSize: 12, fontFamily: 'Montserrat-Medium', color: colors.textSecondary },
  deliveryLocationChange: { fontSize: 12, fontFamily: 'Montserrat-Bold', color: colors.primary, textDecorationLine: 'underline' },

  // This chrome floats over the live map itself (always rendered in its own
  // light street-map style, regardless of app theme) — like the QR scanner's
  // camera overlay elsewhere in the app, it uses fixed high-contrast colors
  // rather than theme tokens, which are tuned for the app's own background.
  mapMarkerFixed: { position: 'absolute', top: '50%', left: '50%', marginLeft: -24, marginTop: -48, alignItems: 'center', zIndex: 1 },
  markerCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#0C1559', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#FFF', elevation: 10 },
  markerArrow: { width: 0, height: 0, borderLeftWidth: 8, borderRightWidth: 8, borderBottomWidth: 12, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#0C1559', transform: [{ rotate: '180deg' }], marginTop: -2 },
  mapOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'space-between', padding: 20 },
  mapSearchContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  mapSearchWrapper: { flex: 1, height: 50, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 15, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, elevation: 5, shadowColor: '#000', shadowOpacity: 0.1 },
  mapSearchInput: { flex: 1, marginLeft: 10, fontFamily: 'Montserrat-Medium', color: '#0F172A', fontSize: 14 },
  mapSearchClose: { width: 50, height: 50, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 15, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  mapConfirmBtn: { borderRadius: 18, overflow: 'hidden', elevation: 10, marginBottom: 20 },
  mapConfirmGradient: { paddingVertical: 18, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  mapConfirmText: { color: '#FFF', fontFamily: 'Montserrat-Bold', fontSize: 16 },

  // Empty state
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
  emptyText: { fontSize: 18, fontFamily: 'Montserrat-SemiBold', color: colors.textMuted, marginTop: 20, marginBottom: 30 },
  shopBtn: { backgroundColor: colors.primary, paddingHorizontal: 30, paddingVertical: 15, borderRadius: 20 },
  shopBtnText: { color: '#FFF', fontFamily: 'Montserrat-Bold' }, // white text on the fixed primary button

  // Ad slot placeholder
  adPlaceholder: {
    height: 80,
    overflow: 'hidden',
  },
  adPlaceholderImg: {
    width: '100%',
    height: '100%',
  },
});
