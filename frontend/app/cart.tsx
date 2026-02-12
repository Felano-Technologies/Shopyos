// app/cart.tsx
import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, Dimensions, Platform, Alert, Modal, TextInput, ScrollView, KeyboardAvoidingView, Animated, PanResponder, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useNavigation } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useCart } from './context/CartContext';
import { createOrder } from '@/services/api';
const { width, height } = Dimensions.get('window');

export default function CartScreen() {
  const router = useRouter();
  const navigation = useNavigation();

  // Use Global Cart Context
  const { items: cartItems, removeFromCart, updateQuantity } = useCart();

  // Calculation States
  const [subtotal, setSubtotal] = useState(0);
  const [nhil, setNhil] = useState(0);
  const [getFund, setGetFund] = useState(0);
  const [vat, setVat] = useState(0);
  const [total, setTotal] = useState(0);

  const [modalVisible, setModalVisible] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'momo' | 'card'>('momo');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryPhone, setDeliveryPhone] = useState('');
  const [isOrdering, setIsOrdering] = useState(false);

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

  const handleCheckoutPress = () => {
    if (cartItems.length === 0) return;
    setModalVisible(true);
  };

  const handleFinalPayment = async () => {
    if (!deliveryAddress || !deliveryPhone) {
      Alert.alert("Error", "Please provide delivery address and phone number");
      return;
    }

    try {
      setIsOrdering(true);
      const res = await createOrder({
        deliveryAddress,
        deliveryCity: 'Accra', // For now hardcoded, can be dynamic
        deliveryCountry: 'Ghana',
        deliveryPhone,
        paymentMethod
      });

      if (res.success) {
        closeModal();
        Alert.alert(
          "Order Placed!",
          `Your order(s) have been placed successfully. Order #: ${res.orders[0].order_number}`,
          [{ text: "OK", onPress: () => router.push('/order') }]
        );
      } else {
        Alert.alert("Checkout Failed", res.error || "Something went wrong");
      }
    } catch (e: any) {
      console.error("Order error", e);
      Alert.alert("Error", e.message || "Failed to place order");
    } finally {
      setIsOrdering(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.cartItem}>
      {/* Handle Dynamic Images vs Static Requires */}
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
    <View style={[styles.container, { zIndex: 9999 }]}>
      <StatusBar style="light" backgroundColor="#0C1559" />
      <View style={StyleSheet.absoluteFillObject}>
        <View style={styles.bottomLogos}>
          <Image source={require('../assets/images/splash-icon.png')} style={styles.fadedLogo} />
        </View>
      </View>

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
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <View style={styles.handleArea}><View style={styles.modalHandle} /></View>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                <Text style={styles.modalTitle}>Payment Summary</Text>

                <View style={styles.billContainer}>
                  <View style={styles.billRow}><Text style={styles.billLabel}>Subtotal</Text><Text style={styles.billValue}>₵{subtotal.toFixed(2)}</Text></View>
                  <View style={styles.billRow}><Text style={styles.billLabel}>Delivery Fee</Text><Text style={styles.billValue}>₵{DELIVERY_FEE.toFixed(2)}</Text></View>
                  <View style={styles.billRow}><Text style={styles.billLabel}>Service Charge</Text><Text style={styles.billValue}>₵{SERVICE_CHARGE.toFixed(2)}</Text></View>
                  <View style={styles.divider} />
                  <Text style={styles.taxHeader}>Taxes & Levies</Text>
                  <View style={styles.billRowSmall}><Text style={styles.billLabelSmall}>NHIL (2.5%)</Text><Text style={styles.billValueSmall}>₵{nhil.toFixed(2)}</Text></View>
                  <View style={styles.billRowSmall}><Text style={styles.billLabelSmall}>GETFund (2.5%)</Text><Text style={styles.billValueSmall}>₵{getFund.toFixed(2)}</Text></View>
                  <View style={styles.billRowSmall}><Text style={styles.billLabelSmall}>VAT (15%)</Text><Text style={styles.billValueSmall}>₵{vat.toFixed(2)}</Text></View>
                  <View style={[styles.divider, { backgroundColor: '#000', marginVertical: 15 }]} />
                  <View style={styles.billRow}><Text style={styles.totalLabelLarge}>Total Payable</Text><Text style={styles.totalValueLarge}>₵{total.toFixed(2)}</Text></View>
                </View>

                <Text style={[styles.modalTitle, { marginTop: 20, marginBottom: 10, alignSelf: 'flex-start' }]}>Delivery Information</Text>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Delivery Address</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="House No, Street Name, Area"
                    value={deliveryAddress}
                    onChangeText={setDeliveryAddress}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Phone Number</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="024 XXX XXXX"
                    value={deliveryPhone}
                    onChangeText={setDeliveryPhone}
                    keyboardType="phone-pad"
                  />
                </View>

                <Text style={[styles.modalTitle, { marginTop: 20, marginBottom: 15 }]}>Payment Method</Text>

                <TouchableOpacity style={styles.optionRow} onPress={() => setPaymentMethod('momo')}>
                  <View style={styles.optionLeft}>
                    <View style={[styles.radioOuter, paymentMethod === 'momo' && { borderColor: '#84cc16' }]}>{paymentMethod === 'momo' && <View style={styles.radioInner} />}</View>
                    <Text style={styles.optionText}>Mobile money</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity style={styles.optionRow} onPress={() => setPaymentMethod('card')}>
                  <View style={styles.optionLeft}>
                    <View style={[styles.radioOuter, paymentMethod === 'card' && { borderColor: '#84cc16' }]}>{paymentMethod === 'card' && <View style={styles.radioInner} />}</View>
                    <Text style={styles.optionText}>Bank Card</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.payButton, isOrdering && { opacity: 0.7 }]}
                  onPress={handleFinalPayment}
                  disabled={isOrdering}
                >
                  {isOrdering ? <ActivityIndicator color="#FFF" /> : <Text style={styles.payButtonText}>Pay Now</Text>}
                </TouchableOpacity>
              </ScrollView>
            </KeyboardAvoidingView>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

// ... Copy your styles from the previous cart response here ...
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4FC', height: height },
  header: { paddingBottom: 20, zIndex: 10 },
  headerSafe: { width: '100%' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10 },
  backBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12 },
  headerTitle: { fontSize: 20, fontFamily: 'Montserrat-Bold', color: '#FFF' },
  cartCountBadge: { backgroundColor: '#A3E635', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  cartCountText: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
  deliveryBanner: { backgroundColor: '#84cc16', paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomLeftRadius: 20, borderBottomRightRadius: 20, marginTop: -15, zIndex: 5, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  deliveryLabel: { color: '#FFF', fontSize: 12, fontFamily: 'Montserrat-Bold' },
  deliveryAddress: { color: '#FFF', fontSize: 13, fontFamily: 'Montserrat-Medium' },
  listContent: { padding: 20, paddingBottom: 150 },
  cartItem: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 16, padding: 12, marginBottom: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  itemImage: { width: 90, height: 90, borderRadius: 12, backgroundColor: '#F1F5F9' },
  itemDetails: { flex: 1, marginLeft: 14, justifyContent: 'space-between', paddingVertical: 2 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  itemTitle: { flex: 1, fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginRight: 8 },
  deleteBtn: { padding: 4 },
  itemCategory: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: '#64748B', marginTop: -4 },
  priceControlRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  itemPrice: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#84cc16' },
  qtyContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 20, padding: 4 },
  qtyBtn: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF', shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 1, elevation: 1 },
  qtyBtnActive: { backgroundColor: '#0C1559' },
  qtyText: { marginHorizontal: 12, fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
  summaryContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFF', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: "#0C1559", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 20, zIndex: 999 },
  summaryRow: { marginBottom: 0 },
  summaryLabel: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: '#64748B' },
  totalValue: { fontSize: 20, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
  checkoutBtn: { borderRadius: 16, overflow: 'hidden', width: '50%' },
  checkoutGradient: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 14, gap: 8 },
  checkoutText: { color: '#FFF', fontSize: 16, fontFamily: 'Montserrat-Bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, height: '90%' },
  handleArea: { width: '100%', alignItems: 'center', paddingVertical: 10, marginBottom: 10 },
  modalHandle: { width: 50, height: 6, backgroundColor: '#E2E8F0', borderRadius: 3 },
  modalTitle: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#000', marginBottom: 15, alignSelf: 'center' },
  billContainer: { backgroundColor: '#F8FAFC', padding: 20, borderRadius: 16, marginBottom: 10 },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  billLabel: { fontSize: 14, color: '#334155', fontFamily: 'Montserrat-Medium' },
  billValue: { fontSize: 14, color: '#0F172A', fontFamily: 'Montserrat-SemiBold' },
  divider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 10 },
  taxHeader: { fontSize: 12, color: '#64748B', fontFamily: 'Montserrat-Bold', marginBottom: 8, marginTop: 5, textTransform: 'uppercase' },
  billRowSmall: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  billLabelSmall: { fontSize: 12, color: '#64748B', fontFamily: 'Montserrat-Regular' },
  billValueSmall: { fontSize: 12, color: '#334155', fontFamily: 'Montserrat-Medium' },
  totalLabelLarge: { fontSize: 18, color: '#0C1559', fontFamily: 'Montserrat-Bold' },
  totalValueLarge: { fontSize: 22, color: '#0C1559', fontFamily: 'Montserrat-Bold' },
  optionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingVertical: 5 },
  optionLeft: { flexDirection: 'row', alignItems: 'center' },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#0C1559', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#84cc16' },
  optionText: { fontSize: 16, fontFamily: 'Montserrat-SemiBold', color: '#0C1559' },
  payButton: { backgroundColor: '#0C1559', paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginTop: 10 },
  payButtonText: { color: '#FFF', fontSize: 18, fontFamily: 'Montserrat-Bold' },
  closeModalBtn: { alignItems: 'center', marginTop: 15, marginBottom: 30 },
  closeText: { color: '#64748B', fontFamily: 'Montserrat-Medium' },
  emptyState: { alignItems: 'center', marginTop: 80 },
  emptyText: { marginTop: 16, fontSize: 16, fontFamily: 'Montserrat-Medium', color: '#64748B', marginBottom: 24 },
  shopBtn: { paddingVertical: 12, paddingHorizontal: 24, backgroundColor: '#EBF2FF', borderRadius: 20 },
  shopBtnText: { color: '#0C1559', fontFamily: 'Montserrat-Bold' },
  bottomLogos: { position: 'absolute', bottom: 250, left: -20 },
  fadedLogo: { width: 200, height: 200, resizeMode: 'contain', opacity: 0.05 },
  inputGroup: { marginBottom: 15 },
  inputLabel: { fontSize: 12, color: '#64748B', fontFamily: 'Montserrat-Bold', marginBottom: 6, marginLeft: 4 },
  modalInput: { backgroundColor: '#F8FAFC', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, fontFamily: 'Montserrat-Medium', color: '#0F172A', borderWidth: 1, borderColor: '#E2E8F0' },
});