import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Platform, ActivityIndicator, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { CustomInAppToast } from "@/components/InAppToastHost";

import { useCart } from '@/store/cartStore';
import {
  createOrder, addToCart as apiAddToCart, clearBackendCart,
  getUserData, getPaymentMethods, getDeliveryQuote, getProductById,
  getLoyaltyBalance, validatePromoCode,
} from '@/services/api';

const C = {
  navy: '#0C1559',
  navyMid: '#1e3a8a',
  lime: '#84cc16',
  bg: '#F8FAFC',
  card: '#FFFFFF',
  muted: '#64748B',
  subtle: '#94A3B8',
  body: '#0F172A',
};

export default function CheckoutScreen() {
  const router = useRouter();
  const cartItems = useCart((s) => s.items);
  const clearCart = useCart((s) => s.clearCart);

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const [paymentMethodType, setPaymentMethodType] = useState<'momo' | 'card'>('momo');
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [savedMethods, setSavedMethods] = useState<any[]>([]);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryPhone, setDeliveryPhone] = useState('');
  const [saveAddress, setSaveAddress] = useState(false);
  const [isOrdering, setIsOrdering] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [deliveryState, setDeliveryState] = useState('Greater Accra');
  const [prefilled, setPrefilled] = useState({ address: false, phone: false, region: false });

  // Promo code state
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{ id: string; code: string; discountAmount: number; label: string } | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [isValidatingPromo, setIsValidatingPromo] = useState(false);

  // Loyalty points state
  const [loyaltyBalance, setLoyaltyBalance] = useState(0);
  const [loyaltyValue, setLoyaltyValue] = useState(0);
  const [usePoints, setUsePoints] = useState(false);

  // Delivery fee state
  const [deliveryFee, setDeliveryFee] = useState<number>(0);
  const [isFetchingFee, setIsFetchingFee] = useState(false);
  const [isWithinRange, setIsWithinRange] = useState<boolean | null>(null);
  const [deliveryNote, setDeliveryNote] = useState<string | null>(null);
  const [buyerCoords, setBuyerCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Get buyer location once on mount
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
          setBuyerCoords(coords);
        }
      } catch {
        // Location unavailable — delivery fee will fall back to base fee
      }
    })();
  }, []);

  // Fetch delivery quote whenever buyer location is known
  useEffect(() => {
    if (cartItems.length === 0) return;

    (async () => {
      let storeId = (cartItems[0] as any).storeId ?? (cartItems[0] as any).store_id ?? (cartItems[0] as any).business_id;
      
      // Fallback for legacy cart items
      if (!storeId && cartItems[0].id) {
        try {
          const prodRes = await getProductById(cartItems[0].id);
          if (prodRes.success) {
            storeId = prodRes.product.store_id || prodRes.product.store?._id || prodRes.product.store?.id || prodRes.product.businessId || prodRes.product.business_id;
          }
        } catch { /* Fail silently */ }
      }

      if (!storeId) return;

      setIsFetchingFee(true);
      try {
        const res = await getDeliveryQuote(storeId, buyerCoords?.lat, buyerCoords?.lng, deliveryState);
        if (res?.success) {
          const { withinRange, deliveryFee: fee, note } = res.quote || {};
          setIsWithinRange(withinRange);
          setDeliveryNote(note || null);
          if (withinRange && fee !== null) {
            setDeliveryFee(fee);
          } else {
            setDeliveryFee(0);
          }
        }
      } catch {
        // Eligibility remains null (unknown) if quote fails
      } finally {
        setIsFetchingFee(false);
      }
    })();
  }, [buyerCoords, cartItems, deliveryState]);

  const tax = 1;
  const promoDiscount = appliedPromo?.discountAmount ?? 0;
  const pointsDiscount = usePoints ? loyaltyValue : 0;
  const totalDiscount = Number.parseFloat((promoDiscount + pointsDiscount).toFixed(2));
  const total = Number.parseFloat((subtotal + tax + deliveryFee - totalDiscount).toFixed(2));

  useEffect(() => {
    (async () => {
      try {
        const [profileResponse, paymentResponse, loyaltyResponse] = await Promise.all([
          getUserData(),
          getPaymentMethods(),
          getLoyaltyBalance().catch(() => null),
        ]);

        if (loyaltyResponse?.success) {
          setLoyaltyBalance(loyaltyResponse.balance);
          setLoyaltyValue(loyaltyResponse.redeemableValue);
        }

        const profile = profileResponse.user || profileResponse;
        if (profile) {
          const addr = profile.address_line1 || '';
          const phone = profile.fullPhoneNumber || profile.phone || '';
          const region = profile.state_province || 'Greater Accra';
          setDeliveryAddress(addr);
          setDeliveryPhone(phone);
          setDeliveryState(region);
          setPrefilled({ address: !!addr, phone: !!phone, region: !!profile.state_province });
          
          // Use saved coordinates as initial buyerCoords
          if (profile.latitude && profile.longitude) {
            setBuyerCoords({ lat: Number(profile.latitude), lng: Number(profile.longitude) });
          }
        }

        if (paymentResponse?.success) {
          setSavedMethods(paymentResponse.data);
          const defaultMethod = paymentResponse.data.find((m: any) => m.is_default);
          if (defaultMethod) {
            setPaymentMethodType(defaultMethod.type);
            setSelectedMethodId(defaultMethod.id);
          }
        }
      } catch (e) {
        console.log('Error loading checkout info:', e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const handleApplyPromo = async () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    setPromoError(null);
    setAppliedPromo(null);
    setIsValidatingPromo(true);
    try {
      const res = await validatePromoCode(code, subtotal);
      setAppliedPromo(res.promo);
      setPromoInput('');
    } catch (e: any) {
      setPromoError(e.message || 'Invalid promo code');
    } finally {
      setIsValidatingPromo(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (!deliveryAddress.trim() || !deliveryPhone.trim()) {
      CustomInAppToast.show({ type: 'error', title: 'Required Info', message: 'Please provide address and phone number.' });
      return;
    }

    try {
      setIsOrdering(true);
      await clearBackendCart().catch(() => {});
      for (const item of cartItems) {
        await apiAddToCart(item.id, item.quantity);
      }

      const res = await createOrder({
        deliveryAddress,
        deliveryCity: 'Accra',
        deliveryState,
        deliveryCountry: 'Ghana',
        deliveryPhone,
        paymentMethod: paymentMethodType,
        paymentMethodId: selectedMethodId,
        ...(buyerCoords && { buyerLat: buyerCoords.lat, buyerLng: buyerCoords.lng }),
        ...(appliedPromo && { promoCode: appliedPromo.code }),
        ...(usePoints && loyaltyBalance > 0 && { loyaltyPointsToRedeem: loyaltyBalance }),
      });

      if (res.success) {
        clearCart();
        await clearBackendCart().catch(() => {});
        const orderId = res.orders[0].id;
        router.replace({ pathname: `/payment/${orderId}`, params: { method: paymentMethodType, methodId: selectedMethodId } } as any);
      }
    } catch (e: any) {
      CustomInAppToast.show({ type: 'error', title: 'Order Failed', message: e.message || 'Please try again.' });
    } finally {
      setIsOrdering(false);
    }
  };


  const showAddressNudge = !prefilled.address && !deliveryAddress;
  return (
    <View style={S.container}>
      <StatusBar style="light" />

      {/* Header */}
      <LinearGradient colors={[C.navy, C.navyMid]} style={S.header}>
        <SafeAreaView edges={['top', 'left', 'right']}>
          <View style={S.headerRow}>
            <TouchableOpacity onPress={() => router.back()} style={S.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#FFF" />
            </TouchableOpacity>
            <Text style={S.headerTitle}>Checkout</Text>
            <View style={{ width: 40 }} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      {isLoading ? (
        <View style={S.centred}>
          <ActivityIndicator size="large" color={C.navy} />
        </View>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false}>

            {/* Order Summary */}
            <Text style={S.sectionTitle}>Order Summary</Text>
            <View style={S.card}>
              {cartItems.map((item) => (
                <View key={item.id} style={S.summaryRow}>
                  <Text style={S.summaryItemName} numberOfLines={1}>{item.title}</Text>
                  <Text style={S.summaryItemQty}>x{item.quantity}</Text>
                  <Text style={S.summaryItemPrice}>₵{(Number(item.price || 0) * Number(item.quantity || 1)).toFixed(2)}</Text>
                </View>
              ))}
              <View style={S.divider} />
              <View style={S.summaryRow}>
                <Text style={S.summaryItemName}>Subtotal</Text>
                <Text style={S.summaryItemPrice}>₵{Number(subtotal || 0).toFixed(2)}</Text>
              </View>
              <View style={S.summaryRow}>
                <Text style={S.summaryItemName}>Buyer Protection Fee</Text>
                <Text style={S.summaryItemPrice}>₵{Number(tax || 0).toFixed(2)}</Text>
              </View>
              <View style={S.summaryRow}>
                <Text style={S.summaryItemName}>Delivery Fee</Text>
                <Text style={[S.summaryItemPrice, isWithinRange === false && { color: '#B91C1C' }]}>
                  {isFetchingFee ? '...' : (isWithinRange === false ? 'Unavailable' : `₵${deliveryFee.toFixed(2)}`)}
                </Text>
              </View>
              {isWithinRange === false && (
                <View style={S.errorBanner}>
                  <Ionicons name="alert-circle" size={16} color="#B91C1C" />
                  <Text style={S.errorText}>Your address is outside this store&apos;s delivery zone.</Text>
                </View>
              )}
              {totalDiscount > 0 && (
                <View style={S.summaryRow}>
                  <Text style={[S.summaryItemName, { color: '#16a34a' }]}>
                    Discount{appliedPromo ? ` (${appliedPromo.code})` : ''}{usePoints && pointsDiscount > 0 ? `${appliedPromo ? ' + ' : ''}Points` : ''}
                  </Text>
                  <Text style={[S.summaryItemPrice, { color: '#16a34a' }]}>−₵{totalDiscount.toFixed(2)}</Text>
                </View>
              )}
              <View style={S.divider} />
              <View style={S.summaryRow}>
                <Text style={[S.summaryItemName, { fontFamily: 'Montserrat-Bold', color: C.navy }]}>Total Payable</Text>
                <Text style={[S.summaryItemPrice, { fontSize: 18, color: C.lime, fontFamily: 'Montserrat-Bold' }]}>₵{Number(total || 0).toFixed(2)}</Text>
              </View>
            </View>

            {/* Promo Code */}
            <Text style={S.sectionTitle}>Promo Code</Text>
            <View style={S.card}>
              {appliedPromo ? (
                <View style={S.promoApplied}>
                  <Ionicons name="checkmark-circle" size={20} color="#16a34a" />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={S.promoAppliedCode}>{appliedPromo.code}</Text>
                    <Text style={S.promoAppliedSub}>{appliedPromo.label} — saving ₵{appliedPromo.discountAmount.toFixed(2)}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setAppliedPromo(null)}>
                    <Ionicons name="close-circle" size={22} color={C.muted} />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={S.promoRow}>
                  <TextInput
                    style={S.promoInput}
                    placeholder="Enter promo code"
                    placeholderTextColor={C.subtle}
                    value={promoInput}
                    onChangeText={t => { setPromoInput(t.toUpperCase()); setPromoError(null); }}
                    autoCapitalize="characters"
                    returnKeyType="done"
                    onSubmitEditing={handleApplyPromo}
                  />
                  <TouchableOpacity
                    style={[S.promoBtn, (!promoInput.trim() || isValidatingPromo) && { opacity: 0.5 }]}
                    onPress={handleApplyPromo}
                    disabled={!promoInput.trim() || isValidatingPromo}
                  >
                    {isValidatingPromo
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={S.promoBtnTxt}>Apply</Text>
                    }
                  </TouchableOpacity>
                </View>
              )}
              {promoError && (
                <Text style={S.promoError}>{promoError}</Text>
              )}
            </View>

            {/* Loyalty Points */}
            {loyaltyBalance > 0 && (
              <>
                <Text style={S.sectionTitle}>Loyalty Points</Text>
                <TouchableOpacity style={S.card} onPress={() => setUsePoints(p => !p)} activeOpacity={0.8}>
                  <View style={S.loyaltyRow}>
                    <View style={S.loyaltyIcon}>
                      <Ionicons name="star" size={20} color={C.lime} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={S.loyaltyTitle}>{loyaltyBalance} points available</Text>
                      <Text style={S.loyaltySub}>Worth ₵{loyaltyValue.toFixed(2)} off your order</Text>
                    </View>
                    <View style={[S.toggle, usePoints && S.toggleOn]}>
                      <View style={[S.toggleThumb, usePoints && S.toggleThumbOn]} />
                    </View>
                  </View>
                  {usePoints && (
                    <View style={S.loyaltySaving}>
                      <Ionicons name="checkmark-circle" size={14} color="#16a34a" />
                      <Text style={S.loyaltySavingTxt}>−₵{pointsDiscount.toFixed(2)} applied</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </>
            )}

            {/* Delivery Info */}
            <Text style={S.sectionTitle}>Delivery Information</Text>
            <View style={S.card}>
              <View style={S.inputGroup}>
                <View style={S.labelRow}>
                  <Text style={S.inputLabel}>Delivery Address <Text style={{ color: '#ef4444' }}>*</Text></Text>
                  {prefilled.address && (
                    <View style={S.profileBadge}>
                      <Ionicons name="person-circle-outline" size={11} color={C.lime} />
                      <Text style={S.profileBadgeText}>From profile</Text>
                    </View>
                  )}
                </View>
                <View style={S.inputWrapper}>
                  <Ionicons name="location-outline" size={18} color={C.muted} style={{ marginRight: 10 }} />
                  <TextInput
                    style={S.input}
                    placeholder="House No, Street Name, Area"
                    placeholderTextColor={C.subtle}
                    value={deliveryAddress}
                    onChangeText={(t) => { setDeliveryAddress(t); setPrefilled(p => ({ ...p, address: false })); }}
                  />
                </View>
              </View>
              <View style={S.inputGroup}>
                <View style={S.labelRow}>
                  <Text style={S.inputLabel}>Phone Number <Text style={{ color: '#ef4444' }}>*</Text></Text>
                  {prefilled.phone && (
                    <View style={S.profileBadge}>
                      <Ionicons name="person-circle-outline" size={11} color={C.lime} />
                      <Text style={S.profileBadgeText}>From profile</Text>
                    </View>
                  )}
                </View>
                <View style={S.inputWrapper}>
                  <Ionicons name="call-outline" size={18} color={C.muted} style={{ marginRight: 10 }} />
                  <TextInput
                    style={S.input}
                    placeholder="024 XXX XXXX"
                    placeholderTextColor={C.subtle}
                    value={deliveryPhone}
                    onChangeText={(t) => { setDeliveryPhone(t); setPrefilled(p => ({ ...p, phone: false })); }}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>
              <View style={S.inputGroup}>
                <View style={S.labelRow}>
                  <Text style={S.inputLabel}>Region / State <Text style={{ color: '#ef4444' }}>*</Text></Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 5 }}>
                  {['Greater Accra', 'Ashanti', 'Central', 'Eastern', 'Western', 'Northern', 'Volta'].map((reg) => (
                    <TouchableOpacity
                      key={reg}
                      style={[S.regionChip, deliveryState === reg && S.regionChipActive]}
                      onPress={() => setDeliveryState(reg)}
                    >
                      <Text style={[S.regionChipTxt, deliveryState === reg && S.regionChipTxtActive]}>{reg}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              {showAddressNudge && (
                <TouchableOpacity
                  style={S.profileNudge}
                  onPress={() => router.push('/settings/Account' as any)}
                >
                  <Ionicons name="information-circle-outline" size={15} color={C.navy} />
                  <Text style={S.profileNudgeText}>Add address & phone in your profile to auto-fill next time</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={S.checkboxRow} onPress={() => setSaveAddress(!saveAddress)}>
                <View style={[S.checkbox, saveAddress && S.checkboxChecked]}>
                  {saveAddress && <Ionicons name="checkmark" size={13} color="#FFF" />}
                </View>
                <Text style={S.checkboxLabel}>Save delivery information for next time</Text>
              </TouchableOpacity>
            </View>

            {/* Payment Method */}
            <Text style={S.sectionTitle}>Payment Method</Text>
            <PaymentOption
              type="momo" icon="cellphone-nfc" label="Mobile Money" sub="MTN, Telecel, AT Money"
              paymentMethodType={paymentMethodType} savedMethods={savedMethods}
              selectedMethodId={selectedMethodId} onSelectType={setPaymentMethodType} onSelectMethodId={setSelectedMethodId}
            />
            <PaymentOption
              type="card" icon="credit-card-outline" label="Bank Card" sub="Visa, Mastercard, AMEX"
              paymentMethodType={paymentMethodType} savedMethods={savedMethods}
              selectedMethodId={selectedMethodId} onSelectType={setPaymentMethodType} onSelectMethodId={setSelectedMethodId}
            />

            {/* Status Messages for User */}
            {!isFetchingFee && isWithinRange === false && (
              <View style={[S.errorBanner, { marginTop: 20, marginBottom: -10 }]}>
                <Ionicons name="alert-circle" size={18} color="#B91C1C" />
                <Text style={S.errorText}>{deliveryNote || "Delivery unavailable: Outside store's radius."}</Text>
              </View>
            )}
            {isFetchingFee && (
              <View style={[S.profileNudge, { marginTop: 20, marginBottom: -10, backgroundColor: '#EFF6FF' }]}>
                <ActivityIndicator size="small" color="#1E40AF" style={{ marginRight: 8 }} />
                <Text style={[S.profileNudgeText, { color: '#1E40AF' }]}>Calculating delivery fee...</Text>
              </View>
            )}
            {!isFetchingFee && isWithinRange === null && (
              <View style={[S.profileNudge, { marginTop: 20, marginBottom: -10, backgroundColor: '#FFF7ED' }]}>
                <Ionicons name="location-outline" size={18} color="#C2410C" />
                <Text style={[S.profileNudgeText, { color: '#C2410C' }]}>
                  {!buyerCoords 
                    ? "Waiting for GPS location..." 
                    : "Identifying store for delivery calculation..."}
                </Text>
              </View>
            )}

            {/* Place Order */}
            <TouchableOpacity
              style={[S.placeOrderBtn, (isOrdering || isWithinRange !== true) && { opacity: 0.6 }]}
              onPress={handlePlaceOrder}
              disabled={isOrdering || isWithinRange !== true}
            >
              <LinearGradient colors={[C.navy, C.navyMid]} style={S.placeOrderGradient}>
                {isOrdering
                  ? <ActivityIndicator color="#FFF" />
                  : <Text style={S.placeOrderTxt}>Place Order · ₵{Number(total || 0).toFixed(2)}</Text>
                }
              </LinearGradient>
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  centred: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: { paddingBottom: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#FFF' },

  scroll: { padding: 16 },
  sectionTitle: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: C.muted, textTransform: 'uppercase', marginTop: 16, marginBottom: 10 },
  card: { backgroundColor: C.card, borderRadius: 18, padding: 16, marginBottom: 4, elevation: 2 },

  summaryRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  summaryItemName: { flex: 1, fontSize: 14, fontFamily: 'Montserrat-Medium', color: C.body },
  summaryItemQty: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: C.muted, marginHorizontal: 8 },
  summaryItemPrice: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: C.navy },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 12 },

  inputGroup: { marginBottom: 16 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  inputLabel: { fontSize: 12, fontFamily: 'Montserrat-Bold', color: C.muted },
  profileBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#F7FEE7', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20 },
  profileBadgeText: { fontSize: 10, fontFamily: 'Montserrat-SemiBold', color: '#65A30D' },
  profileNudge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EFF6FF', borderRadius: 10, padding: 10, marginBottom: 14 },
  profileNudgeText: { flex: 1, fontSize: 12, fontFamily: 'Montserrat-Medium', color: C.navy },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 14 },
  input: { flex: 1, paddingVertical: 13, fontSize: 14, fontFamily: 'Montserrat-Medium', color: C.body },
  checkboxRow: { flexDirection: 'row', alignItems: 'center' },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: C.navy, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  checkboxChecked: { backgroundColor: C.navy },
  checkboxLabel: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: C.muted },

  paymentOption: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#F1F5F9', elevation: 1 },
  paymentOptionSelected: { backgroundColor: C.navy, borderColor: C.navy },
  optionIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  optionLabel: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: C.navy },
  optionSub: { fontSize: 11, fontFamily: 'Montserrat-Medium', color: C.muted, marginTop: 2 },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#CBD5E1', justifyContent: 'center', alignItems: 'center' },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FFF' },
  savedBox: { backgroundColor: '#FFF', borderRadius: 14, borderWidth: 1, borderTopWidth: 0, borderColor: '#F1F5F9', padding: 8, marginTop: -4, marginBottom: 4 },
  savedItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, gap: 8 },
  savedItemActive: { backgroundColor: '#F7FEE7' },
  savedTxt: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: C.muted },
  savedTxtActive: { color: C.navy, fontFamily: 'Montserrat-SemiBold' },

  placeOrderBtn: { borderRadius: 18, overflow: 'hidden', marginTop: 20 },
  placeOrderGradient: { paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
  placeOrderTxt: { color: '#FFF', fontSize: 17, fontFamily: 'Montserrat-Bold' },
  regionChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#F1F5F9', marginRight: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  regionChipActive: { backgroundColor: C.navy, borderColor: C.navy },
  regionChipTxt: { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: C.muted },
  regionChipTxtActive: { color: '#FFF' },
  errorBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', padding: 10, borderRadius: 10, gap: 8, marginTop: 4 },
  errorText: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: '#B91C1C', flex: 1 },

  // Promo code
  promoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  promoInput: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: 'Montserrat-Medium', color: C.body },
  promoBtn: { backgroundColor: C.navy, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 13, justifyContent: 'center', alignItems: 'center' },
  promoBtnTxt: { color: '#fff', fontFamily: 'Montserrat-Bold', fontSize: 13 },
  promoApplied: { flexDirection: 'row', alignItems: 'center' },
  promoAppliedCode: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#16a34a' },
  promoAppliedSub: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: C.muted, marginTop: 2 },
  promoError: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: '#B91C1C', marginTop: 8 },

  // Loyalty points
  loyaltyRow: { flexDirection: 'row', alignItems: 'center' },
  loyaltyIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F7FEE7', justifyContent: 'center', alignItems: 'center' },
  loyaltyTitle: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: C.body },
  loyaltySub: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: C.muted, marginTop: 2 },
  loyaltySaving: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10, backgroundColor: '#F0FDF4', padding: 8, borderRadius: 8 },
  loyaltySavingTxt: { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: '#16a34a' },
  toggle: { width: 44, height: 24, borderRadius: 12, backgroundColor: '#E2E8F0', justifyContent: 'center', paddingHorizontal: 2 },
  toggleOn: { backgroundColor: C.lime },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', elevation: 2 },
  toggleThumbOn: { alignSelf: 'flex-end' },
});

type PaymentOptionProps = Readonly<{
  type: 'momo' | 'card';
  icon: any;
  label: string;
  sub: string;
  paymentMethodType: 'momo' | 'card';
  savedMethods: any[];
  selectedMethodId: string | null;
  onSelectType: (type: 'momo' | 'card') => void;
  onSelectMethodId: (id: string | null) => void;
}>;

const PaymentOption = ({
  type, icon, label, sub,
  paymentMethodType, savedMethods, selectedMethodId,
  onSelectType, onSelectMethodId,
}: PaymentOptionProps) => {
  const isSelected = paymentMethodType === type;
  const filteredSaved = savedMethods.filter((m) => m.type === type);

  return (
    <View style={{ marginBottom: 12 }}>
      <TouchableOpacity
        style={[S.paymentOption, isSelected && S.paymentOptionSelected]}
        onPress={() => {
          onSelectType(type);
          const def = filteredSaved.find((m) => m.is_default) || filteredSaved[0];
          onSelectMethodId(def?.id ?? null);
        }}
      >
        <View style={[S.optionIcon, isSelected && { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
          <MaterialCommunityIcons name={icon} size={22} color={isSelected ? '#FFF' : C.navy} />
        </View>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={[S.optionLabel, isSelected && { color: '#FFF' }]}>{label}</Text>
          <Text style={[S.optionSub, isSelected && { color: 'rgba(255,255,255,0.7)' }]}>{sub}</Text>
        </View>
        <View style={[S.radioOuter, isSelected && { borderColor: '#FFF' }]}>
          {isSelected && <View style={S.radioInner} />}
        </View>
      </TouchableOpacity>

      {isSelected && filteredSaved.length > 0 && (
        <View style={S.savedBox}>
          {filteredSaved.map((m) => (
            <TouchableOpacity
              key={m.id}
              style={[S.savedItem, selectedMethodId === m.id && S.savedItemActive]}
              onPress={() => onSelectMethodId(m.id)}
            >
              <Ionicons
                name={selectedMethodId === m.id ? 'checkmark-circle' : 'ellipse-outline'}
                size={18}
                color={selectedMethodId === m.id ? '#A3E635' : C.muted}
              />
              <Text style={[S.savedTxt, selectedMethodId === m.id && S.savedTxtActive]}>
                {m.title} ({m.type === 'card' ? `**** ${m.identifier.slice(-4)}` : m.identifier})
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};
