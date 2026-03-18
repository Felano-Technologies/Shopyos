import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  Linking,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { format } from 'date-fns';
import { getOrderDetails, updateOrderStatus, createDelivery } from '@/services/api';
import Toast from 'react-native-toast-message';
import { useSellerGuard } from '@/hooks/useSellerGuard';

const { width } = Dimensions.get('window');

export default function OrderDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentStatus, setCurrentStatus] = useState<string>('');
  const { isChecking, isVerified } = useSellerGuard();

    if (isChecking || !isVerified) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#0C1559" />
      </View>
    );
  }

  const fetchOrder = async () => {
    try {
      const data = await getOrderDetails(id as string);
      if (data && data.success !== false) {
        const o = data.order || data;

        // --- MAP ITEMS ---
        const mappedItems = o.order_items.map((i: any) => ({
          id: i.id,
          name: i.product_title || 'Product',
          price: parseFloat(i.price || 0), 
          quantity: i.quantity,
          image: i.product?.product_images?.[0]?.image_url 
            ? { uri: i.product.product_images[0].image_url } 
            : require('../../assets/images/icon.png'),
        }));

        // --- MAP CUSTOMER & LOCATION DETAILS ---
        const mappedOrder = {
          id: o.id,
          orderNumber: o.order_number,
          status: o.status, // Raw status for logic
          displayStatus: o.status.replace(/_/g, ' ').toUpperCase(),
          date: o.created_at,
          customer: {
            name: o.buyer?.user_profiles?.full_name || 'Guest Buyer',
            phone: o.buyer?.user_profiles?.phone || 'N/A',
            email: o.buyer?.email || 'N/A',
            // Fetching the specific location set by the buyer during checkout
            address: o.deliveries?.[0]?.delivery_address || o.delivery_address || 'No address provided',
            gps: o.deliveries?.[0]?.gps_coords || null
          },
          items: mappedItems,
          payment: {
            subtotal: parseFloat(o.subtotal_amount || 0),
            deliveryFee: parseFloat(o.delivery_fee || 0),
            total: parseFloat(o.total_amount || 0),
            method: o.payments?.[0]?.payment_method || 'MoMo / Card',
            isPaid: o.status !== 'pending' && o.status !== 'cancelled', // Logic for "Paid" indicator
            paymentStatus: o.payments?.[0]?.status || 'pending'
          }
        };
        
        setOrder(mappedOrder);
        setCurrentStatus(o.status);
      }
    } catch (e: any) {
      Alert.alert("Error", "Could not refresh order details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchOrder();
  }, [id]);

  const getStatusTheme = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'paid') return { color: '#059669', bg: '#DCFCE7', label: 'Payment Received' };
    if (s === 'pending') return { color: '#D97706', bg: '#FEF3C7', label: 'Awaiting Payment' };
    if (s === 'confirmed') return { color: '#1D4ED8', bg: '#DBEAFE', label: 'Confirmed' };
    if (s === 'ready_for_pickup') return { color: '#7C3AED', bg: '#F5F3FF', label: 'Ready' };
    return { color: '#64748B', bg: '#F1F5F9', label: status };
  };

  const statusTheme = getStatusTheme(currentStatus);

  const updateStatus = async (newStatus: string) => {
    try {
      setLoading(true);
      await updateOrderStatus(id as string, newStatus.toLowerCase());
      await fetchOrder();
      Toast.show({ type: 'success', text1: 'Success', text2: `Status updated to ${newStatus}` });
    } catch (e: any) {
      Alert.alert("Update Failed", e.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !order) return (
    <View style={styles.center}><ActivityIndicator size="large" color="#0C1559" /></View>
  );

  return (
    <View style={styles.mainContainer}>
      <StatusBar style="light" />

      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>

          {/* --- TOP HEADER --- */}
          <LinearGradient colors={['#0C1559', '#1e3a8a']} style={styles.headerContainer}>
            <View style={styles.headerRow}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={24} color="#FFF" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Order Details</Text>
              <TouchableOpacity onPress={fetchOrder}><Ionicons name="refresh" size={22} color="#FFF" /></TouchableOpacity>
            </View>

            <View style={styles.headerSummary}>
              <View>
                <Text style={styles.orderIdLabel}>Order Number</Text>
                <Text style={styles.orderIdText}>#{order.orderNumber}</Text>
              </View>
              <View style={styles.dateContainer}>
                <Text style={styles.dateText}>{format(new Date(order.date), "MMM dd, yyyy")}</Text>
                <Text style={styles.timeText}>{format(new Date(order.date), "hh:mm a")}</Text>
              </View>
            </View>
          </LinearGradient>

          {/* --- AUTOMATIC PAYMENT INDICATOR --- */}
          <View style={styles.statusCard}>
            <View style={styles.statusContent}>
               <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
                  <View style={[styles.statusDot, { backgroundColor: statusTheme.color }]} />
                  <Text style={styles.statusLabel}>Current Status</Text>
               </View>
               <Text style={[styles.statusValue, { color: statusTheme.color }]}>{statusTheme.label}</Text>
            </View>
            
            {/* If status is 'paid', show the verified badge automatically */}
            {(currentStatus === 'paid' || order.payment.paymentStatus === 'success') && (
                <View style={styles.paidBadge}>
                    <MaterialCommunityIcons name="shield-check" size={16} color="#059669" />
                    <Text style={styles.paidBadgeText}>PAID</Text>
                </View>
            )}
          </View>

          {/* --- CUSTOMER & LOCATION DETAILS --- */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionHeader}>Delivery Information</Text>
            <View style={styles.card}>
              <View style={styles.customerRow}>
                <View style={styles.avatarPlaceholder}><Text style={styles.avatarText}>{order.customer.name.charAt(0)}</Text></View>
                <View style={styles.customerInfo}>
                  <Text style={styles.customerName}>{order.customer.name}</Text>
                  <Text style={styles.customerPhone}>{order.customer.phone}</Text>
                </View>
                <TouchableOpacity style={styles.iconBtn} onPress={() => Linking.openURL(`tel:${order.customer.phone}`)}>
                  <Ionicons name="call" size={20} color="#0C1559" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.divider} />
              
              <View style={styles.addressSection}>
                 <View style={styles.addressHeader}>
                    <Ionicons name="location" size={18} color="#EF4444" />
                    <Text style={styles.addressTitle}>Buyer's Set Location</Text>
                 </View>
                 <Text style={styles.addressText}>{order.customer.address}</Text>
                 
                 <TouchableOpacity 
                    style={styles.mapBtn} 
                    onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.customer.address)}`)}
                 >
                    <Feather name="map" size={14} color="#0C1559" />
                    <Text style={styles.mapBtnText}>Open in Maps</Text>
                 </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* --- QUICK ACTIONS --- */}
          <View style={styles.sectionContainer}>
              <Text style={styles.sectionHeader}>Workflow Actions</Text>
              <View style={styles.actionGrid}>
                  {currentStatus === 'paid' && (
                      <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#DBEAFE' }]} onPress={() => updateStatus('confirmed')}>
                          <Text style={[styles.actionBtnText, { color: '#1D4ED8' }]}>Confirm Order</Text>
                      </TouchableOpacity>
                  )}
                  {currentStatus === 'confirmed' && (
                      <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#F0FDF4' }]} onPress={() => updateStatus('ready_for_pickup')}>
                          <Text style={[styles.actionBtnText, { color: '#15803D' }]}>Mark Ready</Text>
                      </TouchableOpacity>
                  )}
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#F1F5F9' }]} onPress={() => updateStatus('cancelled')}>
                      <Text style={[styles.actionBtnText, { color: '#64748B' }]}>Cancel</Text>
                  </TouchableOpacity>
              </View>
          </View>

          {/* --- ITEMS --- */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionHeader}>Order Items</Text>
            <View style={styles.card}>
              {order.items.map((item: any, index: number) => (
                <View key={item.id}>
                  <View style={styles.itemRow}>
                    <Image source={item.image} style={styles.itemImage} />
                    <View style={styles.itemDetails}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <Text style={styles.itemPrice}>₵{item.price.toFixed(2)} x {item.quantity}</Text>
                    </View>
                    <Text style={styles.itemTotal}>₵{(item.price * item.quantity).toFixed(2)}</Text>
                  </View>
                  {index < order.items.length - 1 && <View style={styles.divider} />}
                </View>
              ))}
            </View>
          </View>

          {/* --- BILLING --- */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionHeader}>Billing Summary</Text>
            <View style={styles.card}>
              <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Subtotal</Text><Text style={styles.summaryValue}>₵{order.payment.subtotal.toFixed(2)}</Text></View>
              <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Delivery</Text><Text style={styles.summaryValue}>₵{order.payment.deliveryFee.toFixed(2)}</Text></View>
              <View style={styles.divider} />
              <View style={styles.summaryRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>₵{order.payment.total.toFixed(2)}</Text>
              </View>
              <View style={styles.methodCard}>
                 <MaterialCommunityIcons name="cellphone-check" size={20} color="#0C1559" />
                 <Text style={styles.methodText}>Paid via {order.payment.method}</Text>
              </View>
            </View>
          </View>

        </ScrollView>
      </SafeAreaView>
      <Toast />
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  safeArea: { flex: 1 },
  headerContainer: { paddingTop: 50, paddingBottom: 40, paddingHorizontal: 20, borderBottomLeftRadius: 35, borderBottomRightRadius: 35 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#FFF' },
  headerSummary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  orderIdLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontFamily: 'Montserrat-Medium' },
  orderIdText: { color: '#FFF', fontSize: 24, fontFamily: 'Montserrat-Bold' },
  dateContainer: { alignItems: 'flex-end' },
  dateText: { color: '#FFF', fontSize: 13, fontFamily: 'Montserrat-Medium' },
  timeText: { color: 'rgba(255,255,255,0.6)', fontSize: 11 },
  statusCard: { backgroundColor: '#FFF', marginHorizontal: 20, marginTop: -30, borderRadius: 20, padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 10, shadowColor: "#0C1559", shadowOpacity: 0.1, shadowRadius: 10 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusContent: { flex: 1 },
  statusLabel: { fontSize: 10, color: '#94A3B8', fontFamily: 'Montserrat-Bold', textTransform: 'uppercase' },
  statusValue: { fontSize: 18, fontFamily: 'Montserrat-Bold', marginTop: 2 },
  paidBadge: { backgroundColor: '#DCFCE7', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: '#86EFAC' },
  paidBadgeText: { color: '#059669', fontSize: 12, fontFamily: 'Montserrat-Bold' },
  sectionContainer: { marginTop: 25, paddingHorizontal: 20 },
  sectionHeader: { fontSize: 12, fontFamily: 'Montserrat-Bold', color: '#94A3B8', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  card: { backgroundColor: '#FFF', borderRadius: 24, padding: 20, elevation: 2, shadowColor: "#000", shadowOpacity: 0.02 },
  customerRow: { flexDirection: 'row', alignItems: 'center' },
  avatarPlaceholder: { width: 45, height: 45, borderRadius: 15, backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  avatarText: { fontSize: 20, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
  customerInfo: { flex: 1 },
  customerName: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
  customerPhone: { fontSize: 13, color: '#64748B', fontFamily: 'Montserrat-Medium' },
  iconBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9' },
  addressSection: { marginTop: 5 },
  addressHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  addressTitle: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
  addressText: { fontSize: 14, color: '#475569', fontFamily: 'Montserrat-Medium', lineHeight: 22 },
  mapBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, backgroundColor: '#F1F5F9', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  mapBtnText: { fontSize: 12, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 15 },
  itemRow: { flexDirection: 'row', alignItems: 'center' },
  itemImage: { width: 50, height: 50, borderRadius: 12, marginRight: 12, backgroundColor: '#F8FAFC' },
  itemDetails: { flex: 1 },
  itemName: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
  itemPrice: { fontSize: 12, color: '#64748B', marginTop: 2 },
  itemTotal: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  summaryLabel: { fontSize: 14, color: '#64748B', fontFamily: 'Montserrat-Medium' },
  summaryValue: { fontSize: 14, color: '#0F172A', fontFamily: 'Montserrat-Bold' },
  totalLabel: { fontSize: 16, color: '#0F172A', fontFamily: 'Montserrat-Bold' },
  totalValue: { fontSize: 20, color: '#0C1559', fontFamily: 'Montserrat-Bold' },
  methodCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 12, borderRadius: 15, marginTop: 15, justifyContent: 'center', gap: 10 },
  methodText: { fontSize: 12, color: '#475569', fontFamily: 'Montserrat-Bold' },
  actionGrid: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  actionBtnText: { fontSize: 13, fontFamily: 'Montserrat-Bold' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },

});