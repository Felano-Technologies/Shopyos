import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useNavigation } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useCart } from '@/context/CartContext';
import { useOnboarding } from '@/context/OnboardingContext';
import { SpotlightTour } from '@/components/ui/SpotlightTour';
const { width } = (require('react-native')).Dimensions.get('window');

export default function CartScreen() {
  const router = useRouter();
  const navigation = useNavigation();

  const { items: cartItems, removeFromCart, updateQuantity } = useCart();

  const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  // --- Onboarding ---
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
  }, [cartItems.length]);

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

  const handleOnboardingComplete = () => {
    markCompleted('cart');
  };


  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor="#0C1559" />

      <LinearGradient colors={['#0C1559', '#1e3a8a']} style={styles.header}>
        <SafeAreaView edges={['top', 'left', 'right']} style={styles.headerSafe}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Ionicons name="arrow-back" size={24} color="#FFF" /></TouchableOpacity>
            <Text style={styles.headerTitle}>My Cart</Text>
            <View style={styles.cartCountBadge}><Text style={styles.cartCountText}>{cartItems.length}</Text></View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <FlatList
        data={cartItems}
        keyExtractor={item => item.id}
        renderItem={({ item, index }) => (
          <View style={styles.cartItem}>
            <Image source={typeof item.image === 'number' ? item.image : { uri: item.image }} style={styles.itemImage} />
            <View style={styles.itemDetails}>
              <View style={styles.titleRow}>
                <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
                <TouchableOpacity onPress={() => removeFromCart(item.id)} style={styles.deleteBtn}><Feather name="trash-2" size={18} color="#EF4444" /></TouchableOpacity>
              </View>
              <Text style={styles.itemCategory}>{item.category}</Text>
              <View style={styles.priceControlRow}>
                <Text style={styles.itemPrice}>₵{item.price.toFixed(2)}</Text>
                <View 
                  style={styles.qtyContainer}
                  ref={index === 0 ? refQty : undefined}
                  onLayout={index === 0 ? () => measureElement(refQty, 'qty') : undefined}
                >
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(item.id, -1)}><Feather name="minus" size={14} color="#0C1559" /></TouchableOpacity>
                  <Text style={styles.qtyText}>{item.quantity}</Text>
                  <TouchableOpacity style={[styles.qtyBtn, styles.qtyBtnActive]} onPress={() => updateQuantity(item.id, 1)}><Feather name="plus" size={14} color="#FFF" /></TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="cart-outline" size={80} color="#CBD5E1" /><Text style={styles.emptyText}>Your cart is empty</Text>
            <TouchableOpacity style={styles.shopBtn} onPress={() => router.back()}><Text style={styles.shopBtnText}>Start Shopping</Text></TouchableOpacity>
          </View>
        }
      />

      {cartItems.length > 0 && (
        <View style={styles.summaryContainer}>
          <View style={styles.summaryRow}>
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
      )}

      <SpotlightTour 
        visible={isTourActive && activeScreen === 'cart'} 
        steps={onboardingSteps}
        onComplete={handleOnboardingComplete}
      />
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
  cartItem: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 20, padding: 12, marginBottom: 16, elevation: 2 },
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
  summaryContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFF', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 25 },
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
  modalSectionTitle: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#64748B', textTransform: 'uppercase', marginBottom: 15 },
  billContainer: { backgroundColor: '#F8FAFC', padding: 20, borderRadius: 24, marginBottom: 10, borderWidth: 1, borderColor: '#F1F5F9' },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  billLabel: { fontSize: 14, color: '#64748B', fontFamily: 'Montserrat-Medium' },
  billValue: { fontSize: 14, color: '#0F172A', fontFamily: 'Montserrat-Bold' },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 10 },
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
  optionIconContainer: { width: 45, height: 45, borderRadius: 12, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
  optionLabel: { fontSize: 15, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
  optionSub: { fontSize: 11, fontFamily: 'Montserrat-Medium', color: '#64748B', marginTop: 2 },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#CBD5E1', justifyContent: 'center', alignItems: 'center' },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#0C1559' },
  savedMethodsContainer: { backgroundColor: '#FFF', borderBottomLeftRadius: 20, borderBottomRightRadius: 20, padding: 10, marginTop: -10, borderWidth: 1, borderColor: '#F1F5F9', borderTopWidth: 0, marginBottom: 5 },
  savedMethodItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, gap: 10 },
  savedMethodItemActive: { backgroundColor: '#F7FEE7' },
  savedMethodText: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: '#64748B' },
  savedMethodTextActive: { color: '#0C1559', fontFamily: 'Montserrat-SemiBold' },
  payButton: { borderRadius: 20, overflow: 'hidden', marginTop: 20, marginBottom: 30 },
  payGradient: { paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
  payButtonText: { color: '#FFF', fontSize: 18, fontFamily: 'Montserrat-Bold' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
  emptyText: { fontSize: 18, fontFamily: 'Montserrat-SemiBold', color: '#94A3B8', marginTop: 20, marginBottom: 30 },
  shopBtn: { backgroundColor: '#0C1559', paddingHorizontal: 30, paddingVertical: 15, borderRadius: 20 },
  shopBtnText: { color: '#FFF', fontFamily: 'Montserrat-Bold' },
});