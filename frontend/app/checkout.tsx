import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Platform, ActivityIndicator, KeyboardAvoidingView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { CustomInAppToast } from '@/components/InAppToastHost';

import { useCart } from '@/context/CartContext';
import {
  createOrder, addToCart as apiAddToCart, clearBackendCart,
  getUserData, getPaymentMethods, getDeliveryQuote,
} from '@/services/api';

const WalletImage = require('@/assets/images/momo.png');
const CardBrandImage = require('@/assets/images/mcvisa.png');

// ─── Palette ────────────────────────────────────────────────────────────────
const C = {
  navy:    '#0C1559',
  navyMid: '#1e3a8a',
  lime:    '#84cc16',
  bg:      '#F8FAFC',
  card:    '#FFFFFF',
  receipt: '#FFFEF5',
  receiptBorder: '#E0DDC7',
  receiptMuted:  '#888',
  receiptDivider:'#CCCCCC',
  muted:   '#64748B',
  subtle:  '#94A3B8',
  body:    '#0F172A',
  error:   '#B91C1C',
  errorBg: '#FEF2F2',
  inkBlue: '#0A2463',
  cardSoft: '#F6F8FC',
  cream: '#FBF7E9',
  creamEdge: '#E6DDC5',
};



// ─── Perforated edge ─────────────────────────────────────────────────────────
const PerforatedEdge = ({ flip = false }: { flip?: boolean }) => {
  const dots = Array.from({ length: 15 });
  return (
    <View style={[S.perforated, flip && S.perforatedBottom]}>
      {dots.map((_, i) => (
        <View key={i} style={[S.perfDot, flip && S.perfDotBottom]} />
      ))}
    </View>
  );
};

// ─── Barcode ─────────────────────────────────────────────────────────────────
const Barcode = () => {
  const bars = [3,1,2,1,3,2,1,1,3,1,2,3,1,2,1,3,1,2,1,1,3,2,1,3,2,1,1,2,3,1];
  const heights = [28,20,32,24,28,18,30,22,28,20,26,32,18,28,24,30,20,28,22,26,30,18,28,24,20,32,18,26,28,22];
  return (
    <View style={S.barcodeWrap}>
      <View style={S.barcodeLines}>
        {bars.map((w, i) => (
          <View key={i} style={{ width: w, height: heights[i % heights.length], backgroundColor: '#1a1a1a', borderRadius: 1 }} />
        ))}
      </View>
      <Text style={S.barcodeText}>*** THANK YOU FOR SHOPPING ***</Text>
    </View>
  );
};

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function CheckoutScreen() {
  const router = useRouter();
  const { items: cartItems, clearCart } = useCart();

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const [paymentMethodType, setPaymentMethodType] = useState<'momo' | 'card'>('momo');
  const [selectedMethodId, setSelectedMethodId]   = useState<string | null>(null);
  const [savedMethods, setSavedMethods]           = useState<any[]>([]);
  const [deliveryAddress, setDeliveryAddress]     = useState('');
  const [deliveryPhone, setDeliveryPhone]         = useState('');
  const [saveAddress, setSaveAddress]             = useState(false);
  const [isOrdering, setIsOrdering]               = useState(false);
  const [isLoading, setIsLoading]                 = useState(true);
  const [deliveryState, setDeliveryState]         = useState('Greater Accra');
  const [prefilled, setPrefilled]                 = useState({ address: false, phone: false, region: false });

  const [deliveryFee, setDeliveryFee]             = useState<number>(0);
  const [isFetchingFee, setIsFetchingFee]         = useState(false);
  const [isWithinRange, setIsWithinRange]         = useState<boolean | null>(null);
  const [buyerCoords, setBuyerCoords]             = useState<{ lat: number; lng: number } | null>(null);

  const tax   = 1.00;
  const total = subtotal + tax + deliveryFee;

  // Get buyer location once on mount
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setBuyerCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
        }
      } catch { /* fallback to base fee */ }
    })();
  }, []);

  // Fetch delivery quote when buyer location is known
  useEffect(() => {
    if (!buyerCoords || cartItems.length === 0) return;
    const storeId = (cartItems[0] as any).storeId ?? (cartItems[0] as any).store_id;
    if (!storeId) return;

    (async () => {
      setIsFetchingFee(true);
      try {
        const res = await getDeliveryQuote(storeId, buyerCoords.lat, buyerCoords.lng);
        if (res?.success) {
          const { withinRange, deliveryFee: fee } = res.quote || {};
          setIsWithinRange(withinRange);
          setDeliveryFee(withinRange && fee !== null ? fee : 0);
        }
      } catch { /* eligibility remains null */ }
      finally { setIsFetchingFee(false); }
    })();
  }, [buyerCoords, cartItems]);

  // Load profile + payment methods
  useEffect(() => {
    (async () => {
      try {
        const [profileResponse, paymentResponse] = await Promise.all([
          getUserData(),
          getPaymentMethods(),
        ]);
        const profile = profileResponse.user || profileResponse;
        if (profile) {
          const addr   = profile.address_line1 || '';
          const phone  = profile.fullPhoneNumber || profile.phone || '';
          const region = profile.state_province || 'Greater Accra';
          setDeliveryAddress(addr);
          setDeliveryPhone(phone);
          setDeliveryState(region);
          setPrefilled({ address: !!addr, phone: !!phone, region: !!profile.state_province });
        }
        if (paymentResponse?.success) {
          setSavedMethods(paymentResponse.data);
          const def = paymentResponse.data.find((m: any) => m.is_default);
          if (def) { setPaymentMethodType(def.type); setSelectedMethodId(def.id); }
        }
      } catch (e) { console.log('Error loading checkout info:', e); }
      finally { setIsLoading(false); }
    })();
  }, []);

  const handlePlaceOrder = async () => {
    if (!deliveryAddress.trim() || !deliveryPhone.trim()) {
      CustomInAppToast.show({ type: 'error', title: 'Required Info', message: 'Please provide address and phone number.' });
      return;
    }
    try {
      setIsOrdering(true);
      await clearBackendCart().catch(() => {});
      for (const item of cartItems) await apiAddToCart(item.id, item.quantity);
      const res = await createOrder({
        deliveryAddress, deliveryCity: 'Accra', deliveryState,
        deliveryCountry: 'Ghana', deliveryPhone,
        paymentMethod: paymentMethodType, paymentMethodId: selectedMethodId,
        ...(buyerCoords && { buyerLat: buyerCoords.lat, buyerLng: buyerCoords.lng }),
      });
      if (res.success) {
        clearCart();
        await clearBackendCart().catch(() => {});
        const orderId = res.orders[0].id;
        router.replace({ pathname: `/payment/${orderId}`, params: { method: paymentMethodType, methodId: selectedMethodId } } as any);
      }
    } catch (e: any) {
      CustomInAppToast.show({ type: 'error', title: 'Order Failed', message: e.message || 'Please try again.' });
    } finally { setIsOrdering(false); }
  };

  // ─── Payment Option ─────────────────────────────────────────────────────────
  const PaymentOption = ({ type, label, sub }: { type: 'momo' | 'card'; label: string; sub: string }) => {
    const active        = paymentMethodType === type;
    const filteredSaved = savedMethods.filter((m) => m.type === type);

    return (
      <View style={S.payWrap}>
        <TouchableOpacity
          style={[S.payCard, active && S.payCardActive]}
          onPress={() => {
            setPaymentMethodType(type);
            const def = filteredSaved.find((m) => m.is_default) || filteredSaved[0];
            setSelectedMethodId(def?.id ?? null);
          }}
          activeOpacity={0.85}
        >
          {/* Hero image */}
          <View style={[S.payHeroWrap, active && S.payHeroWrapActive]}>
            {type === 'momo'
              ? <Image source={WalletImage} style={S.payHeroImage} resizeMode="contain" />
              : <Image source={CardBrandImage} style={S.payHeroImage} resizeMode="contain" />
            }
          </View>

          {/* Info */}
          <View style={S.payInfo}>
            <Text style={[S.payTitle, active && S.payTitleActive]}>{label}</Text>
            <Text style={[S.paySub, active && S.paySubActive]}>{sub}</Text>
          </View>

          {/* Radio */}
          <View style={[S.radioOuter, active && S.radioOuterActive]}>
            {active && <View style={S.radioInner} />}
          </View>
        </TouchableOpacity>

        {/* Saved methods */}
        {active && filteredSaved.length > 0 && (
          <View style={S.savedBox}>
            {filteredSaved.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={[S.savedItem, selectedMethodId === m.id && S.savedItemActive]}
                onPress={() => setSelectedMethodId(m.id)}
              >
                <Ionicons
                  name={selectedMethodId === m.id ? 'checkmark-circle' : 'ellipse-outline'}
                  size={18}
                  color={selectedMethodId === m.id ? C.lime : C.muted}
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

  // ─── Render ─────────────────────────────────────────────────────────────────
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

            {/* ── Order Summary (Receipt) ─────────────────────────────── */}
            <Text style={S.sectionTitle}>Order Summary</Text>
            <View style={S.receiptOuter}>
              <PerforatedEdge />
              <View style={S.receiptInner}>

                {/* Store header */}
                <Text style={S.receiptStoreName}>
                  {(cartItems[0] as any)?.storeName ?? 'Your Order'}
                </Text>
                <Text style={S.receiptDate}>
                  {new Date().toDateString()} · Receipt
                </Text>
                <View style={S.receiptDivider} />

                {/* Line items */}
                {cartItems.map((item) => (
                  <View key={item.id} style={S.rRow}>
                    <Text style={S.rName} numberOfLines={1}>{item.title}</Text>
                    <Text style={S.rQty}>x{item.quantity}</Text>
                    <Text style={S.rPrice}>₵{(Number(item.price || 0) * Number(item.quantity || 1)).toFixed(2)}</Text>
                  </View>
                ))}

                <View style={S.receiptDivider} />

                {/* Subtotals */}
                <View style={S.rRow}>
                  <Text style={[S.rName, S.rMuted]}>Subtotal</Text>
                  <Text style={[S.rPrice, S.rMuted]}>₵{Number(subtotal || 0).toFixed(2)}</Text>
                </View>
                <View style={S.rRow}>
                  <Text style={[S.rName, S.rMuted]}>Buyer Protection Fee</Text>
                  <Text style={[S.rPrice, S.rMuted]}>₵{Number(tax || 0).toFixed(2)}</Text>
                </View>
                <View style={S.rRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 6 }}>
                    <Text style={[S.rName, S.rMuted]}>Delivery Fee</Text>
                    {isFetchingFee && <ActivityIndicator size="small" color={C.receiptMuted} />}
                  </View>
                  <Text style={[S.rPrice, S.rMuted, isWithinRange === false && { color: C.error }]}>
                    {isFetchingFee ? '...' : isWithinRange === false ? 'Out of Range' : `₵${Number(deliveryFee || 0).toFixed(2)}`}
                  </Text>
                </View>

                {isWithinRange === false && (
                  <View style={S.errorBanner}>
                    <Ionicons name="alert-circle" size={15} color={C.error} />
                    <Text style={S.errorText}>Your address is outside this store's delivery zone.</Text>
                  </View>
                )}

                {/* Total */}
                <View style={S.receiptTotalDivider} />
                <View style={S.rRow}>
                  <Text style={S.rTotalLabel}>TOTAL PAYABLE</Text>
                  <Text style={S.rTotalPrice}>₵{Number(total || 0).toFixed(2)}</Text>
                </View>

                <Barcode />
              </View>
              <PerforatedEdge flip />
            </View>

            {/* ── Delivery Info ────────────────────────────────────────── */}
            <Text style={S.sectionTitle}>Delivery Information</Text>
            <View style={S.card}>

              {/* Address */}
              <View style={S.inputGroup}>
                <View style={S.labelRow}>
                  <Text style={S.inputLabel}>
                    Delivery Address <Text style={{ color: '#ef4444' }}>*</Text>
                  </Text>
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

              {/* Phone */}
              <View style={S.inputGroup}>
                <View style={S.labelRow}>
                  <Text style={S.inputLabel}>
                    Phone Number <Text style={{ color: '#ef4444' }}>*</Text>
                  </Text>
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

              {/* Region chips */}
              <View style={S.inputGroup}>
                <Text style={S.inputLabel}>Region / State <Text style={{ color: '#ef4444' }}>*</Text></Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
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

              {/* Profile nudge */}
              {!prefilled.address && !deliveryAddress && (
                <TouchableOpacity style={S.profileNudge} onPress={() => router.push('/settings/Account' as any)}>
                  <Ionicons name="information-circle-outline" size={15} color={C.navy} />
                  <Text style={S.profileNudgeText}>Add address & phone in your profile to auto-fill next time</Text>
                </TouchableOpacity>
              )}

              {/* Save address checkbox */}
              <TouchableOpacity style={S.checkboxRow} onPress={() => setSaveAddress(!saveAddress)}>
                <View style={[S.checkbox, saveAddress && S.checkboxChecked]}>
                  {saveAddress && <Ionicons name="checkmark" size={13} color="#FFF" />}
                </View>
                <Text style={S.checkboxLabel}>Save delivery information for next time</Text>
              </TouchableOpacity>
            </View>

            {/* ── Payment Method ────────────────────────────────────────── */}
            <Text style={S.sectionTitle}>Payment Method</Text>
            <PaymentOption type="momo" label="Mobile Money" sub="MTN · Telecel · AT Money" />
            <PaymentOption type="card" label="Bank Card"    sub="Visa · Mastercard · AMEX" />

            {/* ── Place Order ───────────────────────────────────────────── */}
            <TouchableOpacity
              style={[S.placeOrderBtn, (isOrdering || isWithinRange === false) && { opacity: 0.6 }]}
              onPress={handlePlaceOrder}
              disabled={isOrdering || isWithinRange === false}
              activeOpacity={0.85}
            >
              <LinearGradient colors={[C.navy, C.navyMid]} style={S.placeOrderGradient}>
                {isOrdering
                  ? <ActivityIndicator color="#FFF" />
                  : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Ionicons name="bag-check-outline" size={20} color="#FFF" />
                      <Text style={S.placeOrderTxt}>Place Order · ₵{Number(total || 0).toFixed(2)}</Text>
                    </View>
                  )
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

// ─── Styles ──────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  centred:   { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  header:      { paddingBottom: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10 },
  backBtn:     { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#FFF' },

  scroll:       { padding: 16, backgroundColor: '#EEF2FF' },
  sectionTitle: { fontSize: 11, fontFamily: 'Montserrat-Bold', color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginTop: 18, marginBottom: 10 },

  // Receipt
  receiptOuter: {
    backgroundColor: C.cream,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: C.creamEdge,
    overflow: 'hidden',
    marginBottom: 4,
    // subtle shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
  },
  receiptInner:    { paddingHorizontal: 18, paddingVertical: 16, backgroundColor: C.receipt },
  receiptStoreName:{ fontFamily: 'Courier New', fontSize: 14, fontWeight: '700', color: '#1a1a1a', textAlign: 'center', letterSpacing: 2, textTransform: 'uppercase' },
  receiptDate:     { fontFamily: 'Courier New', fontSize: 10, color: C.receiptMuted, textAlign: 'center', marginTop: 3 },
  receiptDivider:  { borderTopWidth: 1, borderStyle: 'dashed', borderColor: C.receiptDivider, marginVertical: 10 },
  receiptTotalDivider: { borderTopWidth: 1.5, borderColor: '#1a1a1a', marginVertical: 10 },

  // Perforated
  perforated:       { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', paddingHorizontal: 4, height: 10, borderBottomWidth: 0.5, borderStyle: 'dashed', borderColor: C.receiptDivider, backgroundColor: C.cream },
  perforatedBottom: { borderBottomWidth: 0, borderTopWidth: 0.5, alignItems: 'flex-start' },
  perfDot:          { width: 10, height: 10, borderRadius: 5, backgroundColor: '#EEF2FF', marginBottom: -5 },
  perfDotBottom:    { marginBottom: 0, marginTop: -5 },

  // Receipt rows
  rRow:       { flexDirection: 'row', alignItems: 'baseline', marginBottom: 6 },
  rName:      { flex: 1, fontFamily: 'Courier New', fontSize: 12, color: '#333' },
  rQty:       { fontFamily: 'Courier New', fontSize: 11, color: C.receiptMuted, marginHorizontal: 8 },
  rPrice:     { fontFamily: 'Courier New', fontSize: 12, color: '#1a1a1a' },
  rMuted:     { color: C.receiptMuted },
  rTotalLabel:{ flex: 1, fontFamily: 'Courier New', fontSize: 13, fontWeight: '700', color: C.inkBlue },
  rTotalPrice:{ fontFamily: 'Courier New', fontSize: 15, fontWeight: '700', color: '#1F7A1F' },

  // Barcode
  barcodeWrap:  { alignItems: 'center', marginTop: 14, gap: 6 },
  barcodeLines: { flexDirection: 'row', gap: 2, alignItems: 'flex-end' },
  barcodeText:  { fontFamily: 'Courier New', fontSize: 9, color: '#aaa', letterSpacing: 1 },

  // Card (delivery)
  card: { backgroundColor: C.card, borderRadius: 18, padding: 16, marginBottom: 4, borderWidth: 1, borderColor: '#DCE3F6', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },

  // Input
  inputGroup:   { marginBottom: 16 },
  labelRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  inputLabel:   { fontSize: 12, fontFamily: 'Montserrat-Bold', color: C.muted },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 14 },
  input:        { flex: 1, paddingVertical: 13, fontSize: 14, fontFamily: 'Montserrat-Medium', color: C.body },

  // Profile badge / nudge
  profileBadge:     { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#F7FEE7', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20 },
  profileBadgeText: { fontSize: 10, fontFamily: 'Montserrat-SemiBold', color: '#65A30D' },
  profileNudge:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EFF6FF', borderRadius: 10, padding: 10, marginBottom: 14 },
  profileNudgeText: { flex: 1, fontSize: 12, fontFamily: 'Montserrat-Medium', color: C.navy },

  // Checkbox
  checkboxRow:    { flexDirection: 'row', alignItems: 'center' },
  checkbox:       { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: C.navy, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  checkboxChecked:{ backgroundColor: C.navy },
  checkboxLabel:  { fontSize: 13, fontFamily: 'Montserrat-Medium', color: C.muted },

  // Region chips
  regionChip:       { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#F1F5F9', marginRight: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  regionChipActive: { backgroundColor: C.navy, borderColor: C.navy },
  regionChipTxt:    { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: C.muted },
  regionChipTxtActive: { color: '#FFF' },

  // Payment cards
  payWrap:        { marginBottom: 12 },
  payCard:        { flexDirection: 'row', alignItems: 'center', backgroundColor: C.cardSoft, borderRadius: 20, padding: 14, borderWidth: 1.5, borderColor: '#DBE4FF', elevation: 1, gap: 14 },
  payCardActive:  { backgroundColor: C.inkBlue, borderColor: C.inkBlue },
  payHeroWrap:    { width: 64, height: 64, borderRadius: 14, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 1, borderColor: '#E5EAF8' },
  payHeroWrapActive:{ borderColor: 'rgba(255,255,255,0.35)', backgroundColor: 'rgba(255,255,255,0.94)' },
  payHeroImage:   { width: '90%', height: '90%' },
  payInfo:        { flex: 1 },
  payTitle:       { fontSize: 14, fontFamily: 'Montserrat-Bold', color: C.inkBlue },
  payTitleActive: { color: '#FFF' },
  paySub:         { fontSize: 11, fontFamily: 'Montserrat-Medium', color: C.muted, marginTop: 2 },
  paySubActive:   { color: 'rgba(255,255,255,0.7)' },

  // Radio
  radioOuter:       { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#CBD5E1', justifyContent: 'center', alignItems: 'center' },
  radioOuterActive: { borderColor: '#FFF' },
  radioInner:       { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FFF' },

  // Saved methods
  savedBox:      { backgroundColor: '#FFF', borderRadius: 14, borderWidth: 1, borderTopWidth: 0, borderColor: '#DBE4FF', padding: 8, marginTop: -6, paddingTop: 12 },
  savedItem:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, gap: 8 },
  savedItemActive:{ backgroundColor: '#F7FEE7' },
  savedTxt:      { fontSize: 13, fontFamily: 'Montserrat-Medium', color: C.muted },
  savedTxtActive:{ color: C.navy, fontFamily: 'Montserrat-SemiBold' },

  // Place order
  placeOrderBtn:      { borderRadius: 18, overflow: 'hidden', marginTop: 20 },
  placeOrderGradient: { paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
  placeOrderTxt:      { color: '#FFF', fontSize: 17, fontFamily: 'Montserrat-Bold' },

  // Error
  errorBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.errorBg, padding: 10, borderRadius: 10, gap: 8, marginTop: 4 },
  errorText:   { fontSize: 12, fontFamily: 'Montserrat-Medium', color: C.error, flex: 1 },
});
