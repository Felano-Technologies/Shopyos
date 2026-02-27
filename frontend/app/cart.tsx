// app/cart.tsx
import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, Dimensions, Platform, Alert, Modal, TextInput, ScrollView, KeyboardAvoidingView, Animated, PanResponder, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useNavigation } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useCart } from './context/CartContext';
import { createOrder, addToCart as apiAddToCart, clearBackendCart, getUserData, getPaymentMethods } from '@/services/api';
import Toast from 'react-native-toast-message';
const { width, height } = Dimensions.get('window');

export default function CartScreen() {
  const router = useRouter();
  const navigation = useNavigation();

  // Use Global Cart Context
  const { items: cartItems, removeFromCart, updateQuantity, clearCart } = useCart();

  // Calculation States
  const [subtotal, setSubtotal] = useState(0);
  const [nhil, setNhil] = useState(0);
  const [getFund, setGetFund] = useState(0);
  const [vat, setVat] = useState(0);
  const [total, setTotal] = useState(0);

  const [modalVisible, setModalVisible] = useState(false);
  const [paymentMethodType, setPaymentMethodType] = useState<'momo' | 'card' | 'cod'>('momo');
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [savedMethods, setSavedMethods] = useState<any[]>([]);
  const [saveAddress, setSaveAddress] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryPhone, setDeliveryPhone] = useState('');
  const [isOrdering, setIsOrdering] = useState(false);
  const [isPreloading, setIsPreloading] = useState(false);

  const DELIVERY_FEE = 15.00;
  const SERVICE_CHARGE = 5.00;

  // --- Modal Animation ---
  const panY = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 0,
      onPanResponderMove: (_, gestureState) => { if (gestureState.dy > 0) panY.setValue(gestureState.dy); },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 150) closeModal();
        else Animated.spring(panY, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;

  const closeModal = () => {
    Animated.timing(panY, { toValue: height, duration: 300, useNativeDriver: true }).start(() => {
      setModalVisible(false);
      panY.setValue(0);
    });
  };

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false, tabBarStyle: { display: 'none' }, presentation: 'card' });
    navigation.getParent()?.setOptions({ tabBarStyle: { display: "none" } });
    return () => { navigation.getParent()?.setOptions({ tabBarStyle: { display: "flex" } }); };
  }, [navigation]);

  // --- Tax Calculations ---
  useEffect(() => {
    const baseTotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const nhilAmount = baseTotal * 0.025;
    const getFundAmount = baseTotal * 0.025;
    const vatAmount = baseTotal * 0.15;
    const finalTotal = baseTotal + nhilAmount + getFundAmount + vatAmount + DELIVERY_FEE + SERVICE_CHARGE;

    setSubtotal(baseTotal);
    setNhil(nhilAmount);
    setGetFund(getFundAmount);
    setVat(vatAmount);
    setTotal(finalTotal);
  }, [cartItems]);

  const handleCheckoutPress = async () => {
    if (cartItems.length === 0) return;

    // Pre-load user info and payment methods
    try {
      setIsPreloading(true);
      const [profileResponse, paymentResponse] = await Promise.all([
        getUserData(),
        getPaymentMethods()
      ]);

      const profile = profileResponse.user || profileResponse;
      if (profile) {
        setDeliveryAddress(profile.address_line1 || '');
        setDeliveryPhone(profile.phone || '');
      }

      if (paymentResponse && paymentResponse.success) {
        setSavedMethods(paymentResponse.data);
        const defaultMethod = paymentResponse.data.find((m: any) => m.is_default);
        if (defaultMethod) {
          setPaymentMethodType(defaultMethod.type);
          setSelectedMethodId(defaultMethod.id);
        }
      }
    } catch (error) {
      console.log('Error pre-loading checkout info:', error);
    } finally {
      setIsPreloading(false);
      setModalVisible(true);
    }
  };

  const handleFinalPayment = async () => {
    if (!deliveryAddress.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Address Required',
        text2: 'Please enter your delivery address before placing the order.',
      });
      return;
    }

    if (!deliveryPhone.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Phone Required',
        text2: 'Please enter your phone number for delivery.',
      });
      return;
    }

    try {
      setIsOrdering(true);

      // Sync local cart to backend for order processing
      try {
        await clearBackendCart().catch(() => { }); // Ignore clear error if cart empty
        for (const item of cartItems) {
          await apiAddToCart(item.id, item.quantity);
        }
      } catch (err) {
        console.log("Error syncing cart", err);
        throw new Error("Failed to prepare cart for checkout");
      }

      const res = await createOrder({
        deliveryAddress: deliveryAddress,
        deliveryCity: 'Accra',
        deliveryCountry: 'Ghana',
        deliveryPhone: deliveryPhone,
        paymentMethod: paymentMethodType,
        paymentMethodId: selectedMethodId
      });

      if (res.success) {
        closeModal();
        clearCart(); // Clear local cart after successful order

        // Also clear backend cart
        try {
          await clearBackendCart();
        } catch (clearErr) {
          console.warn('Failed to clear backend cart:', clearErr);
        }

        const orderId = res.orders[0].id;

        if (paymentMethodType === 'cod') {
          Alert.alert(
            "Order Placed!",
            `Your order has been placed successfully. Order #: ${res.orders[0].order_number}. You will pay on delivery.`,
            [{ text: "OK", onPress: () => router.push(`/order/${orderId}` as any) }]
          );
        } else {
          // Redirect to payment gateway
          console.log('🛒 Order created, redirecting to payment:', {
            orderId,
            orderNumber: res.orders[0].order_number,
            method: paymentMethodType,
            methodId: selectedMethodId
          });
          
          router.push({
            pathname: `/payment/${orderId}`,
            params: {
              method: paymentMethodType,
              methodId: selectedMethodId
            }
          } as any);
        }
      } else {
        Toast.show({
          type: 'error',
          text1: 'Checkout Failed',
          text2: res.error || 'Something went wrong',
        });
      }
    } catch (e: any) {
      console.error("Order error", e);
      Toast.show({
        type: 'error',
        text1: 'Order Failed',
        text2: e.message || 'Failed to place order. Please try again.',
      });
    } finally {
      setIsOrdering(false);
    }
  };

  const PaymentOption = ({ type, icon, label, sub }: { type: 'momo' | 'card' | 'cod', icon: any, label: string, sub: string }) => {
    const isSelected = paymentMethodType === type;
    const filteredSaved = savedMethods.filter(m => m.type === type);

    return (
      <View style={{ marginBottom: 12 }}>
        <TouchableOpacity
          style={[styles.paymentOption, isSelected && styles.paymentOptionSelected]}
          onPress={() => {
            setPaymentMethodType(type);
            if (filteredSaved.length > 0) {
              const defaultForType = filteredSaved.find(m => m.is_default) || filteredSaved[0];
              setSelectedMethodId(defaultForType.id);
            } else {
              setSelectedMethodId(null);
            }
          }}
        >
          <View style={[styles.optionIconContainer, isSelected && { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <MaterialCommunityIcons name={icon} size={24} color={isSelected ? '#FFF' : '#0C1559'} />
          </View>
          <View style={{ flex: 1, marginLeft: 15 }}>
            <Text style={[styles.optionLabel, isSelected && { color: '#FFF' }]}>{label}</Text>
            <Text style={[styles.optionSub, isSelected && { color: 'rgba(255,255,255,0.7)' }]}>{sub}</Text>
          </View>
          <View style={[styles.radioOuter, isSelected && { borderColor: '#FFF' }]}>
            {isSelected && <View style={[styles.radioInner, { backgroundColor: '#FFF' }]} />}
          </View>
        </TouchableOpacity>

        {/* Show Saved Methods for this type if selected */}
        {isSelected && filteredSaved.length > 0 && (
          <View style={styles.savedMethodsContainer}>
            {filteredSaved.map(m => (
              <TouchableOpacity
                key={m.id}
                style={[styles.savedMethodItem, selectedMethodId === m.id && styles.savedMethodItemActive]}
                onPress={() => setSelectedMethodId(m.id)}
              >
                <Ionicons
                  name={selectedMethodId === m.id ? "checkmark-circle" : "ellipse-outline"}
                  size={18}
                  color={selectedMethodId === m.id ? "#A3E635" : "#64748B"}
                />
                <Text style={[styles.savedMethodText, selectedMethodId === m.id && styles.savedMethodTextActive]}>
                  {m.title} ({m.type === 'card' ? `**** ${m.identifier.slice(-4)}` : m.identifier})
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.cartItem}>
      <Image source={typeof item.image === 'number' ? item.image : { uri: item.image }} style={styles.itemImage} />
      <View style={styles.itemDetails}>
        <View style={styles.titleRow}>
          <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
          <TouchableOpacity onPress={() => removeFromCart(item.id)} style={styles.deleteBtn}>
            <Feather name="trash-2" size={18} color="#EF4444" />
          </TouchableOpacity>
        </View>
        <Text style={styles.itemCategory}>{item.category}</Text>
        <View style={styles.priceControlRow}>
          <Text style={styles.itemPrice}>₵{item.price.toFixed(2)}</Text>
          <View style={styles.qtyContainer}>
            <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(item.id, -1)}>
              <Feather name="minus" size={14} color="#0C1559" />
            </TouchableOpacity>
            <Text style={styles.qtyText}>{item.quantity}</Text>
            <TouchableOpacity style={[styles.qtyBtn, styles.qtyBtnActive]} onPress={() => updateQuantity(item.id, 1)}>
              <Feather name="plus" size={14} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );

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


      {/* Cart List */}
      <FlatList
        data={cartItems}
        keyExtractor={item => item.id}
        renderItem={renderItem}
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

      {/* Footer Summary */}
      {cartItems.length > 0 && (
        <View style={styles.summaryContainer}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total (Inc. Taxes)</Text>
            <Text style={styles.totalValue}>₵{total.toFixed(2)}</Text>
          </View>
          <TouchableOpacity style={styles.checkoutBtn} onPress={handleCheckoutPress}>
            <LinearGradient colors={['#0C1559', '#1e3a8a']} style={styles.checkoutGradient}>
              <Text style={styles.checkoutText}>Checkout</Text>
              <Feather name="arrow-right" size={20} color="#FFF" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* Checkout Modal */}
      <Modal animationType="fade" transparent={true} visible={modalVisible} onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.modalContent, { transform: [{ translateY: panY }] }]} {...panResponder.panHandlers}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
              <View style={styles.handleArea}><View style={styles.modalHandle} /></View>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                <Text style={styles.modalTitle}>Checkout Details</Text>

                <View style={styles.billContainer}>
                  <View style={styles.billRow}><Text style={styles.billLabel}>Subtotal</Text><Text style={styles.billValue}>₵{subtotal.toFixed(2)}</Text></View>
                  <View style={styles.billRow}><Text style={styles.billLabel}>Delivery Fee</Text><Text style={styles.billValue}>₵{DELIVERY_FEE.toFixed(2)}</Text></View>
                  <View style={styles.billRow}><Text style={styles.billLabel}>Service Charge</Text><Text style={styles.billValue}>₵{SERVICE_CHARGE.toFixed(2)}</Text></View>
                  <View style={styles.divider} />
                  <Text style={styles.taxHeader}>Taxes & Levies</Text>
                  <View style={styles.billRowSmall}><Text style={styles.billLabelSmall}>NHIL (2.5%)</Text><Text style={styles.billValueSmall}>₵{nhil.toFixed(2)}</Text></View>
                  <View style={styles.billRowSmall}><Text style={styles.billLabelSmall}>GETFund (2.5%)</Text><Text style={styles.billValueSmall}>₵{getFund.toFixed(2)}</Text></View>
                  <View style={styles.billRowSmall}><Text style={styles.billLabelSmall}>VAT (15%)</Text><Text style={styles.billValueSmall}>₵{vat.toFixed(2)}</Text></View>
                  <View style={[styles.divider, { backgroundColor: '#E2E8F0', marginVertical: 15 }]} />
                  <View style={styles.billRow}><Text style={styles.totalLabelLarge}>Total Payable</Text><Text style={styles.totalValueLarge}>₵{total.toFixed(2)}</Text></View>
                </View>

                <Text style={[styles.modalSectionTitle, { marginTop: 20 }]}>Delivery Information</Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Delivery Address</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="location-outline" size={20} color="#64748B" style={styles.inputIcon} />
                    <TextInput
                      style={styles.modalInput}
                      placeholder="House No, Street Name, Area"
                      value={deliveryAddress}
                      onChangeText={setDeliveryAddress}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Phone Number</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="call-outline" size={20} color="#64748B" style={styles.inputIcon} />
                    <TextInput
                      style={styles.modalInput}
                      placeholder="024 XXX XXXX"
                      value={deliveryPhone}
                      onChangeText={setDeliveryPhone}
                      keyboardType="phone-pad"
                    />
                  </View>
                </View>

                <View style={styles.checkboxRow}>
                  <TouchableOpacity
                    style={[styles.checkbox, saveAddress && styles.checkboxChecked]}
                    onPress={() => setSaveAddress(!saveAddress)}
                  >
                    {saveAddress && <Ionicons name="checkmark" size={14} color="#FFF" />}
                  </TouchableOpacity>
                  <Text style={styles.checkboxLabel}>Save delivery information for next time</Text>
                </View>

                <Text style={styles.modalSectionTitle}>Payment Method</Text>

                <PaymentOption
                  type="momo"
                  icon="cellphone-nfc"
                  label="Mobile Money"
                  sub="MTN, Telecel, AT Money"
                />

                <PaymentOption
                  type="card"
                  icon="credit-card-outline"
                  label="Bank Card"
                  sub="Visa, Mastercard, AMEX"
                />

                <PaymentOption
                  type="cod"
                  icon="cash-multiple"
                  label="Cash on Delivery"
                  sub="Pay when you receive"
                />

                {paymentMethodType !== 'cod' && savedMethods.filter(m => m.type === paymentMethodType).length === 0 && (
                  <TouchableOpacity
                    style={styles.addPaymentPrompt}
                    onPress={() => {
                      closeModal();
                      router.push('/settings/paymentMethods' as any);
                    }}
                  >
                    <Ionicons name="add-circle-outline" size={20} color="#0C1559" />
                    <Text style={styles.addPaymentPromptText}>Add a new {paymentMethodType} payment method</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.payButton, isOrdering && { opacity: 0.7 }]}
                  onPress={handleFinalPayment}
                  disabled={isOrdering}
                >
                  <LinearGradient colors={['#0C1559', '#1e3a8a']} style={styles.payGradient}>
                    {isOrdering ? <ActivityIndicator color="#FFF" /> : <Text style={styles.payButtonText}>Place Order • ₵{total.toFixed(2)}</Text>}
                  </LinearGradient>
                </TouchableOpacity>
              </ScrollView>
            </KeyboardAvoidingView>
          </Animated.View>
        </View>
      </Modal>
      <Toast />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { paddingBottom: 25, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerSafe: { width: '100%' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10 },
  backBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12 },
  headerTitle: { fontSize: 20, fontFamily: 'Montserrat-Bold', color: '#FFF' },
  cartCountBadge: { backgroundColor: '#A3E635', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  cartCountText: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#0C1559' },

  listContent: { padding: 20, paddingBottom: 150 },
  cartItem: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 20, padding: 12, marginBottom: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  itemImage: { width: 85, height: 85, borderRadius: 15, backgroundColor: '#F1F5F9' },
  itemDetails: { flex: 1, marginLeft: 15, justifyContent: 'space-between' },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  itemTitle: { flex: 1, fontSize: 15, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
  deleteBtn: { padding: 5, backgroundColor: '#FEF2F2', borderRadius: 8 },
  itemCategory: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: '#94A3B8', marginTop: -2 },
  priceControlRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  itemPrice: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
  qtyContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 12, padding: 4, borderWidth: 1, borderColor: '#F1F5F9' },
  qtyBtn: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF' },
  qtyBtnActive: { backgroundColor: '#0C1559' },
  qtyText: { marginHorizontal: 12, fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#0F172A' },

  summaryContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFF', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: "#0C1559", shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 25 },
  summaryRow: { flex: 1 },
  summaryLabel: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: '#64748B' },
  totalValue: { fontSize: 22, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
  checkoutBtn: { borderRadius: 18, overflow: 'hidden', flex: 1, marginLeft: 20 },
  checkoutGradient: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 16, gap: 10 },
  checkoutText: { color: '#FFF', fontSize: 16, fontFamily: 'Montserrat-Bold' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(12, 21, 89, 0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 40, borderTopRightRadius: 40, paddingHorizontal: 24, height: '90%' },
  handleArea: { width: '100%', alignItems: 'center', paddingVertical: 15 },
  modalHandle: { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2 },
  modalTitle: { fontSize: 22, fontFamily: 'Montserrat-Bold', color: '#0C1559', marginBottom: 20, textAlign: 'center' },
  modalSectionTitle: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#64748B', textTransform: 'uppercase', marginBottom: 15, letterSpacing: 1 },

  billContainer: { backgroundColor: '#F8FAFC', padding: 20, borderRadius: 24, marginBottom: 10, borderWidth: 1, borderColor: '#F1F5F9' },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  billLabel: { fontSize: 14, color: '#64748B', fontFamily: 'Montserrat-Medium' },
  billValue: { fontSize: 14, color: '#0F172A', fontFamily: 'Montserrat-Bold' },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 10 },
  taxHeader: { fontSize: 11, color: '#94A3B8', fontFamily: 'Montserrat-Bold', marginBottom: 10, textTransform: 'uppercase' },
  billRowSmall: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  billLabelSmall: { fontSize: 12, color: '#94A3B8', fontFamily: 'Montserrat-Medium' },
  billValueSmall: { fontSize: 12, color: '#64748B', fontFamily: 'Montserrat-SemiBold' },
  totalLabelLarge: { fontSize: 18, color: '#0C1559', fontFamily: 'Montserrat-Bold' },
  totalValueLarge: { fontSize: 24, color: '#84cc16', fontFamily: 'Montserrat-Bold' },

  inputGroup: { marginBottom: 20 },
  inputLabel: { fontSize: 12, color: '#64748B', fontFamily: 'Montserrat-Bold', marginBottom: 8, marginLeft: 4 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9', paddingHorizontal: 15 },
  inputIcon: { marginRight: 10 },
  modalInput: { flex: 1, paddingVertical: 14, fontSize: 14, fontFamily: 'Montserrat-Medium', color: '#0F172A' },

  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 25, marginLeft: 4 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#0C1559', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  checkboxChecked: { backgroundColor: '#0C1559' },
  checkboxLabel: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: '#475569' },

  paymentOption: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9' },
  paymentOptionSelected: { backgroundColor: '#0C1559', borderColor: '#0C1559' },
  optionIconContainer: { width: 45, height: 45, borderRadius: 12, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 1 },
  optionLabel: { fontSize: 15, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
  optionSub: { fontSize: 11, fontFamily: 'Montserrat-Medium', color: '#64748B', marginTop: 2 },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#CBD5E1', justifyContent: 'center', alignItems: 'center' },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#0C1559' },

  savedMethodsContainer: {
    backgroundColor: '#FFF',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    padding: 10,
    marginTop: -10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderTopWidth: 0,
    marginBottom: 5,
  },
  savedMethodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 10,
  },
  savedMethodItemActive: {
    backgroundColor: '#F7FEE7',
  },
  savedMethodText: {
    fontSize: 13,
    fontFamily: 'Montserrat-Medium',
    color: '#64748B',
  },
  savedMethodTextActive: {
    color: '#0C1559',
    fontFamily: 'Montserrat-SemiBold',
  },
  addPaymentPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 15,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    borderRadius: 15,
    marginTop: 5,
  },
  addPaymentPromptText: {
    fontSize: 13,
    fontFamily: 'Montserrat-SemiBold',
    color: '#0C1559',
  },

  payButton: { borderRadius: 20, overflow: 'hidden', marginTop: 20, marginBottom: 30 },
  payGradient: { paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
  payButtonText: { color: '#FFF', fontSize: 18, fontFamily: 'Montserrat-Bold' },

  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
  emptyText: { fontSize: 18, fontFamily: 'Montserrat-SemiBold', color: '#94A3B8', marginTop: 20, marginBottom: 30 },
  shopBtn: { backgroundColor: '#0C1559', paddingHorizontal: 30, paddingVertical: 15, borderRadius: 20 },
  shopBtnText: { color: '#FFF', fontFamily: 'Montserrat-Bold' },
});