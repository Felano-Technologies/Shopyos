// app/business/orderDetails.tsx
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
import { router, useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { format } from 'date-fns';
import { getOrderDetails, updateOrderStatus, createDelivery } from '@/services/api';

const { width } = Dimensions.get('window');



export default function OrderDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams(); // Grab the ID passed from OrdersScreen

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentStatus, setCurrentStatus] = useState<string>('');

  const fetchOrder = async () => {
    try {
      const data = await getOrderDetails(id as string);
      if (data && data.success !== false) {
        // The controller returns { success: true, order }
        const o = data.order || data;

        // Map items
        const mappedItems = o.order_items.map((i: any) => ({
          id: i.id,
          name: i.product_title || 'Product',
          price: parseFloat(i.price),
          quantity: i.quantity,
          image: i.product?.product_images?.[0]?.image_url ? { uri: i.product.product_images[0].image_url } : require('../../assets/images/icon.png'),
          variant: '' // Details if available
        }));

        // Map Payments
        const mappedPayment = {
          subtotal: mappedItems.reduce((sum: number, i: any) => sum + (i.price * i.quantity), 0),
          deliveryFee: 0, // Need to implement delivery fee logic
          tax: 0,
          total: parseFloat(o.total_amount || 0),
          method: o.payments?.[0]?.payment_method || 'N/A'
        };

        const mappedOrder = {
          id: o.id,
          orderNumber: o.order_number,
          status: o.status.charAt(0).toUpperCase() + o.status.slice(1),
          date: o.created_at,
          customer: {
            name: o.buyer?.user_profiles?.full_name || 'Guest',
            phone: o.buyer?.user_profiles?.phone || 'N/A',
            email: 'N/A', // Email not in buyer relation?
            address: o.deliveries?.[0]?.delivery_address || 'N/A'
          },
          items: mappedItems,
          payment: mappedPayment
        };
        setOrder(mappedOrder);
        setCurrentStatus(mappedOrder.status);
      } else {
        Alert.alert("Error", "Order not found");
        router.back();
      }
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to fetch order");
      router.back();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchOrder();
  }, [id]);

  if (loading) {
    return (
      <View style={[styles.mainContainer, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#0C1559" />
      </View>
    );
  }

  if (!order) return null;

  // Helper for Status Colors
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending': return '#F59E0B';
      case 'Processing': return '#3B82F6';
      case 'Delivered': return '#10B981';
      case 'Cancelled': return '#EF4444';
      default: return '#64748B';
    }
  };

  const statusColor = getStatusColor(currentStatus);

  // Actions
  const handleCallCustomer = () => {
    Linking.openURL(`tel:${order.customer.phone}`);
  };

  const updateStatus = async (newStatus: string) => {
    try {
      setLoading(true);
      await updateOrderStatus(id as string, newStatus.toLowerCase());
      setCurrentStatus(newStatus);
      await fetchOrder();
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to update status");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = () => {
    Alert.alert('Update Status', 'Change order status to:', [
      { text: 'Confirmed', onPress: () => updateStatus('Confirmed') },
      { text: 'Preparing', onPress: () => updateStatus('Preparing') },
      { text: 'Ready for Pickup', onPress: () => updateStatus('Ready_for_pickup') },
      { text: 'Delivered', onPress: () => updateStatus('Delivered') },
      { text: 'Cancelled', onPress: () => updateStatus('Cancelled'), style: 'destructive' },
      { text: 'Close', style: 'cancel' }
    ]);
  };

  const handleRequestDriver = async () => {
    try {
      setLoading(true);
      // Assuming we use store address for pickup and customer address for delivery
      // These can be more sophisticated later
      const res = await createDelivery({
        orderId: id as string,
        pickupAddress: order.store?.address || 'Store Location',
        deliveryAddress: order.customer.address,
      });

      if (res.success) {
        Alert.alert("Success", "Driver request sent successfully!");
        fetchOrder();
      } else {
        if (res.error === "Delivery already exists for this order") {
          Alert.alert("Info", "Driver already requested for this order.");
        } else {
          Alert.alert("Error", res.error || "Failed to request driver");
        }
      }
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to request driver");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.mainContainer}>
      <StatusBar style="light" />

      {/* --- Background Watermark --- */}
      <View style={StyleSheet.absoluteFillObject}>
        <View style={styles.bottomLogos}>
          <Image
            source={require('../../assets/images/splash-icon.png')}
            style={styles.fadedLogo}
          />
        </View>
      </View>

      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

          {/* --- Header Section --- */}
          <LinearGradient
            colors={['#0C1559', '#1e3a8a']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.headerContainer}
          >
            <View style={styles.headerRow}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={24} color="#FFF" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Order Details</Text>
              <View style={{ width: 40 }} />
            </View>

            {/* Order Summary in Header */}
            <View style={styles.headerSummary}>
              <View>
                <Text style={styles.orderIdLabel}>Order ID</Text>
                <Text style={styles.orderIdText}>#{order.orderNumber}</Text>
              </View>
              <View style={styles.dateContainer}>
                <Text style={styles.dateText}>{format(new Date(order.date), "MMM dd, yyyy")}</Text>
                <Text style={styles.timeText}>{format(new Date(order.date), "hh:mm a")}</Text>
              </View>
            </View>
          </LinearGradient>

          {/* --- Status Banner --- */}
          <View style={styles.statusCard}>
            <View style={[styles.statusIndicator, { backgroundColor: statusColor }]} />
            <View style={styles.statusContent}>
              <Text style={styles.statusLabel}>Current Status</Text>
              <Text style={[styles.statusValue, { color: statusColor }]}>{currentStatus}</Text>
            </View>
            <TouchableOpacity style={[styles.statusBtn, { borderColor: statusColor }]} onPress={handleUpdateStatus}>
              <Text style={[styles.statusBtnText, { color: statusColor }]}>Update Status</Text>
            </TouchableOpacity>
          </View>

          {/* Status Actions */}
          {currentStatus !== 'Completed' && currentStatus !== 'Cancelled' && (
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionHeader}>Quick Actions</Text>
              <View style={styles.actionGrid}>
                {currentStatus === 'Pending' && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#E0E7FF' }]}
                    onPress={() => updateStatus('Paid')}
                  >
                    <Ionicons name="card-outline" size={20} color="#4338CA" />
                    <Text style={[styles.actionBtnText, { color: '#4338CA' }]}>Mark as Paid</Text>
                  </TouchableOpacity>
                )}
                {(currentStatus === 'Pending' || currentStatus === 'Paid') && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#DBEAFE' }]}
                    onPress={() => updateStatus('Confirmed')}
                  >
                    <Ionicons name="checkmark-circle-outline" size={20} color="#1D4ED8" />
                    <Text style={[styles.actionBtnText, { color: '#1D4ED8' }]}>Confirm Order</Text>
                  </TouchableOpacity>
                )}
                {currentStatus === 'Confirmed' && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#F0FDF4' }]}
                    onPress={() => updateStatus('ready_for_pickup')}
                  >
                    <Feather name="package" size={20} color="#15803D" />
                    <Text style={[styles.actionBtnText, { color: '#15803D' }]}>Mark Ready for Pickup</Text>
                  </TouchableOpacity>
                )}
                {['Pending', 'Paid', 'Confirmed'].includes(currentStatus) && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#FEF2F2' }]}
                    onPress={() => {
                      Alert.alert('Cancel Order', 'Are you sure you want to cancel this order?', [
                        { text: 'No' },
                        { text: 'Yes, Cancel', style: 'destructive', onPress: () => updateStatus('Cancelled') }
                      ]);
                    }}
                  >
                    <Ionicons name="close-circle-outline" size={20} color="#B91C1C" />
                    <Text style={[styles.actionBtnText, { color: '#B91C1C' }]}>Cancel Order</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Request Driver moved here for flow */}
              {currentStatus === 'Ready_for_pickup' && (
                <TouchableOpacity style={[styles.requestDriverBtn, { marginTop: 12 }]} onPress={handleRequestDriver}>
                  <LinearGradient colors={['#84cc16', '#65a30d']} style={styles.requestDriverGradient}>
                    <MaterialCommunityIcons name="moped" size={24} color="#FFF" />
                    <Text style={styles.requestDriverText}>Assign to Driver</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* --- Customer Details --- */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionHeader}>Customer Details</Text>
            <View style={styles.card}>
              <View style={styles.customerRow}>
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>{order.customer.name.charAt(0)}</Text>
                </View>
                <View style={styles.customerInfo}>
                  <Text style={styles.customerName}>{order.customer.name}</Text>
                  <Text style={styles.customerEmail}>{order.customer.email}</Text>
                </View>
                <TouchableOpacity style={styles.iconBtn} onPress={handleCallCustomer}>
                  <Ionicons name="call" size={20} color="#0C1559" />
                </TouchableOpacity>
              </View>

              <View style={styles.divider} />

              <View style={styles.addressRow}>
                <View style={styles.addressIconBox}>
                  <Ionicons name="location" size={18} color="#64748B" />
                </View>
                <Text style={styles.addressText}>{order.customer.address}</Text>
              </View>
            </View>
          </View>

          {/* --- Items List --- */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionHeader}>Ordered Items ({order.items.length})</Text>
            <View style={styles.card}>
              {order.items.map((item: any, index: number) => (
                <View key={item.id}>
                  <View style={styles.itemRow}>
                    <Image source={item.image} style={styles.itemImage} />
                    <View style={styles.itemDetails}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <Text style={styles.itemVariant}>{item.variant}</Text>
                      <View style={styles.priceRow}>
                        <Text style={styles.itemPrice}>₵{item.price.toFixed(2)}</Text>
                        <Text style={styles.itemQuantity}>x{item.quantity}</Text>
                      </View>
                    </View>
                    <Text style={styles.itemTotal}>₵{(item.price * item.quantity).toFixed(2)}</Text>
                  </View>
                  {index < order.items.length - 1 && <View style={styles.divider} />}
                </View>
              ))}
            </View>
          </View>

          {/* --- Payment Summary --- */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionHeader}>Payment Summary</Text>
            <View style={styles.card}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>₵{order.payment.subtotal.toFixed(2)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Delivery Fee</Text>
                <Text style={styles.summaryValue}>₵{order.payment.deliveryFee.toFixed(2)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Tax (0%)</Text>
                <Text style={styles.summaryValue}>₵{order.payment.tax.toFixed(2)}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.summaryRow}>
                <Text style={styles.totalLabel}>Total Amount</Text>
                <Text style={styles.totalValue}>₵{order.payment.total.toFixed(2)}</Text>
              </View>

              <View style={styles.paymentMethod}>
                <Ionicons name="card-outline" size={16} color="#64748B" />
                <Text style={styles.methodText}>Paid via {order.payment.method}</Text>
              </View>
            </View>
          </View>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  safeArea: {
    flex: 1,
  },

  // Background
  bottomLogos: {
    position: 'absolute',
    bottom: 20,
    left: -20,
  },
  fadedLogo: {
    width: 150,
    height: 150,
    resizeMode: 'contain',
    opacity: 0.08,
  },

  // Header
  headerContainer: {
    paddingTop: 50,
    paddingBottom: 40,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Montserrat-Bold',
    color: '#FFF',
  },
  headerSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  orderIdLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontFamily: 'Montserrat-Regular',
  },
  orderIdText: {
    color: '#FFF',
    fontSize: 24,
    fontFamily: 'Montserrat-Bold',
  },
  dateContainer: {
    alignItems: 'flex-end',
  },
  dateText: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: 'Montserrat-Medium',
  },
  timeText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontFamily: 'Montserrat-Regular',
  },

  // Status Card
  statusCard: {
    backgroundColor: '#FFF',
    marginHorizontal: 20,
    marginTop: -25,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 5,
  },
  statusIndicator: {
    width: 4,
    height: '100%',
    borderRadius: 2,
    marginRight: 16,
  },
  statusContent: {
    flex: 1,
  },
  statusLabel: {
    fontSize: 11,
    color: '#64748B',
    fontFamily: 'Montserrat-Medium',
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 16,
    fontFamily: 'Montserrat-Bold',
  },
  statusBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusBtnText: {
    fontSize: 11,
    fontFamily: 'Montserrat-Bold',
  },

  // Sections
  sectionContainer: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
    color: '#64748B',
    marginBottom: 12,
    marginLeft: 4,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 16,
  },

  // Customer
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E0E7FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 20,
    fontFamily: 'Montserrat-Bold',
    color: '#0C1559',
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontFamily: 'Montserrat-SemiBold',
    color: '#0F172A',
    marginBottom: 2,
  },
  customerEmail: {
    fontSize: 12,
    fontFamily: 'Montserrat-Regular',
    color: '#64748B',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  addressIconBox: {
    marginTop: 2,
    marginRight: 8,
  },
  addressText: {
    flex: 1,
    fontSize: 13,
    color: '#334155',
    fontFamily: 'Montserrat-Medium',
    lineHeight: 20,
  },

  // Items
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    marginRight: 12,
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontFamily: 'Montserrat-SemiBold',
    color: '#0F172A',
    marginBottom: 4,
  },
  itemVariant: {
    fontSize: 11,
    color: '#94A3B8',
    fontFamily: 'Montserrat-Regular',
    marginBottom: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemPrice: {
    fontSize: 13,
    color: '#0C1559',
    fontFamily: 'Montserrat-Bold',
    marginRight: 8,
  },
  itemQuantity: {
    fontSize: 12,
    color: '#64748B',
    fontFamily: 'Montserrat-Medium',
  },
  itemTotal: {
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
    color: '#0F172A',
  },

  // Payment
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#64748B',
    fontFamily: 'Montserrat-Medium',
  },
  summaryValue: {
    fontSize: 13,
    color: '#0F172A',
    fontFamily: 'Montserrat-SemiBold',
  },
  totalLabel: {
    fontSize: 15,
    color: '#0F172A',
    fontFamily: 'Montserrat-Bold',
  },
  totalValue: {
    fontSize: 18,
    color: '#0C1559',
    fontFamily: 'Montserrat-Bold',
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
    marginTop: 16,
    justifyContent: 'center',
  },
  methodText: {
    fontSize: 12,
    color: '#64748B',
    fontFamily: 'Montserrat-Medium',
    marginLeft: 6,
  },
  requestDriverBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: "#84cc16",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  requestDriverGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  requestDriverText: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'Montserrat-Bold',
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionBtn: {
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: (width - 64) / 2,
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  actionBtnText: {
    fontSize: 12,
    fontFamily: 'Montserrat-Bold',
    marginTop: 6,
  },
});