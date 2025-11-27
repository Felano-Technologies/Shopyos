// app/business/orderDetails.tsx
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

const { width } = Dimensions.get('window');

// --- Mock Data Store (Simulating Database) ---
const ORDERS_DB = [
  {
    id: 'o1',
    orderNumber: 'ORD-2481',
    status: 'Pending',
    date: '2024-06-16T12:30:00',
    customer: {
      name: 'John Doe',
      phone: '+233 54 123 4567',
      email: 'john.doe@example.com',
      address: '123 Independence Ave, Ridge, Accra',
    },
    items: [
      { id: 'p1', name: 'Nike Air Force 1', price: 61.00, quantity: 3, image: require('../../assets/images/products/nike.jpg'), variant: 'Size 42, White' },
    ],
    payment: { subtotal: 61.00, deliveryFee: 15.00, tax: 0.00, total: 76.00, method: 'Mobile Money' },
  },
  {
    id: 'o2',
    orderNumber: 'ORD-2482',
    status: 'Delivered',
    date: '2024-06-26T08:45:00',
    customer: {
      name: 'Psalm George',
      phone: '+233 20 987 6543',
      email: 'psalm@example.com',
      address: '45 Spintex Road, Accra',
    },
    items: [
      { id: 'p2', name: 'Artisan Jacket', price: 50.00, quantity: 2, image: require('../../assets/images/categories/jacket.jpg'), variant: 'Medium, Leather' },
    ],
    payment: { subtotal: 100.00, deliveryFee: 10.00, tax: 0.00, total: 110.00, method: 'Cash on Delivery' },
  },
  {
    id: 'o3',
    orderNumber: 'ORD-2483',
    status: 'Pending',
    date: '2024-06-18T15:00:00',
    customer: {
      name: 'Mike Johnson',
      phone: '+233 55 555 5555',
      email: 'mike.j@example.com',
      address: '77 Airport Hills, Accra',
    },
    items: [
      { id: 'p3', name: 'Wireless Headset', price: 147.50, quantity: 2, image: require('../../assets/images/categories/headset.jpg'), variant: 'Black, Noise Cancelling' },
    ],
    payment: { subtotal: 295.00, deliveryFee: 20.00, tax: 0.00, total: 315.00, method: 'Card' },
  },
  {
    id: 'o4',
    orderNumber: 'ORD-2484',
    status: 'Delivered',
    date: '2024-06-15T10:20:00',
    customer: {
      name: 'Sarah Williams',
      phone: '+233 24 000 1111',
      email: 'sarah.w@example.com',
      address: '10 East Legon, Accra',
    },
    items: [
      { id: 'p4', name: 'Digital Art Print', price: 0.00, quantity: 1, image: require('../../assets/images/categories/art.jpg'), variant: 'A3, Framed' },
    ],
    payment: { subtotal: 0.00, deliveryFee: 0.00, tax: 0.00, total: 0.00, method: 'Promo' },
  },
];

export default function OrderDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams(); // Grab the ID passed from OrdersScreen

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentStatus, setCurrentStatus] = useState<string>('');

  useEffect(() => {
    // Simulate API fetch delay
    setTimeout(() => {
        const foundOrder = ORDERS_DB.find(o => o.id === id);
        if (foundOrder) {
            setOrder(foundOrder);
            setCurrentStatus(foundOrder.status);
        } else {
            Alert.alert("Error", "Order not found");
            router.back();
        }
        setLoading(false);
    }, 500);
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

  const handleUpdateStatus = () => {
    Alert.alert('Update Status', 'Change order status to:', [
      { text: 'Processing', onPress: () => setCurrentStatus('Processing') },
      { text: 'Delivered', onPress: () => setCurrentStatus('Delivered') },
      { text: 'Cancelled', onPress: () => setCurrentStatus('Cancelled'), style: 'destructive' },
      { text: 'Cancel', style: 'cancel' },
    ]);
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
});