import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Platform, ActivityIndicator, Alert, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { CustomInAppToast } from "@/components/InAppToastHost";

import { useCart } from '@/context/CartContext';
import {
  createOrder, addToCart as apiAddToCart, clearBackendCart,
  getUserData, getPaymentMethods,
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
  const { items: cartItems, clearCart } = useCart();

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const [paymentMethodType, setPaymentMethodType] = useState<'momo' | 'card'>('momo');
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [savedMethods, setSavedMethods] = useState<any[]>([]);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryPhone, setDeliveryPhone] = useState('');
  const [saveAddress, setSaveAddress] = useState(false);
  const [isOrdering, setIsOrdering] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [prefilled, setPrefilled] = useState({ address: false, phone: false });

  useEffect(() => {
    (async () => {
      try {
        const [profileResponse, paymentResponse] = await Promise.all([
          getUserData(),
          getPaymentMethods(),
        ]);

        const profile = profileResponse.user || profileResponse;
        if (profile) {
          const addr = profile.address_line1 || '';
          const phone = profile.fullPhoneNumber || profile.phone || '';
          setDeliveryAddress(addr);
          setDeliveryPhone(phone);
          setPrefilled({ address: !!addr, phone: !!phone });
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
        deliveryCountry: 'Ghana',
        deliveryPhone,
        paymentMethod: paymentMethodType,
        paymentMethodId: selectedMethodId,
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

  const PaymentOption = ({ type, icon, label, sub }: { type: 'momo' | 'card'; icon: any; label: string; sub: string }) => {
    const isSelected = paymentMethodType === type;
    const filteredSaved = savedMethods.filter((m) => m.type === type);

    return (
      <View style={{ marginBottom: 12 }}>
        <TouchableOpacity
          style={[S.paymentOption, isSelected && S.paymentOptionSelected]}
          onPress={() => {
            setPaymentMethodType(type);
            const def = filteredSaved.find((m) => m.is_default) || filteredSaved[0];
            setSelectedMethodId(def?.id ?? null);
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
                onPress={() => setSelectedMethodId(m.id)}
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
                  <Text style={S.summaryItemPrice}>₵{(item.price * item.quantity).toFixed(2)}</Text>
                </View>
              ))}
              <View style={S.divider} />
              <View style={S.summaryRow}>
                <Text style={[S.summaryItemName, { fontFamily: 'Montserrat-Bold', color: C.navy }]}>Total Payable</Text>
                <Text style={[S.summaryItemPrice, { fontSize: 18, color: C.lime, fontFamily: 'Montserrat-Bold' }]}>₵{subtotal.toFixed(2)}</Text>
              </View>
            </View>

            {/* Delivery Info */}
            <Text style={S.sectionTitle}>Delivery Information</Text>
            <View style={S.card}>
              <View style={S.inputGroup}>
                <View style={S.labelRow}>
                  <Text style={S.inputLabel}>Delivery Address</Text>
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
                  <Text style={S.inputLabel}>Phone Number</Text>
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
              {!prefilled.address && !deliveryAddress && (
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
            <PaymentOption type="momo" icon="cellphone-nfc" label="Mobile Money" sub="MTN, Telecel, AT Money" />
            <PaymentOption type="card" icon="credit-card-outline" label="Bank Card" sub="Visa, Mastercard, AMEX" />

            {/* Place Order */}
            <TouchableOpacity
              style={[S.placeOrderBtn, isOrdering && { opacity: 0.7 }]}
              onPress={handlePlaceOrder}
              disabled={isOrdering}
            >
              <LinearGradient colors={[C.navy, C.navyMid]} style={S.placeOrderGradient}>
                {isOrdering
                  ? <ActivityIndicator color="#FFF" />
                  : <Text style={S.placeOrderTxt}>Place Order · ₵{subtotal.toFixed(2)}</Text>
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
});
