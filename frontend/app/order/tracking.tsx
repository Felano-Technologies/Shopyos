import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  ActivityIndicator,
  Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';

const { width } = Dimensions.get('window');

// --- Enhanced Mock Data ---
const MOCK_ORDER = {
  id: 'ORD-2026-8943',
  date: 'Feb 23, 2026',
  estimatedDelivery: '12:45 PM - 1:15 PM',
  status: 'out_for_delivery', // 'placed', 'processing', 'out_for_delivery', 'delivered'
  driver: {
    name: 'Samuel Osei',
    vehicle: 'Honda Delivery Bike',
    plate: 'GT-4592-23',
    phone: '+233540000000',
    avatar: 'https://i.pravatar.cc/150?u=samuel'
  },
  address: 'KNUST Campus, Republic Hall, Room 45',
  items: [
    { 
      id: 'i1', 
      name: 'Wireless Headset Pro Max', 
      qty: 1, 
      price: 450, 
      image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200&q=80' 
    },
    { 
      id: 'i2', 
      name: 'Ergonomic Office Mouse', 
      qty: 2, 
      price: 120, 
      image: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=200&q=80' 
    },
  ],
  total: 690, // 450 + (120 * 2)
};

const STATUS_STEPS = [
  { id: 'placed', title: 'Order Placed', desc: 'We have received your order.' },
  { id: 'processing', title: 'Processing', desc: 'The seller is preparing your items.' },
  { id: 'out_for_delivery', title: 'Out for Delivery', desc: 'Your order is on the way.' },
  { id: 'delivered', title: 'Delivered', desc: 'Order handed over to you.' },
];

export default function OrderTrackingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams(); 

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);

  useEffect(() => {
    // Simulate API fetch
    setTimeout(() => {
      setOrder(MOCK_ORDER);
      setLoading(false);
    }, 1000);
  }, []);

  const getCurrentStepIndex = () => {
    if (!order) return 0;
    const index = STATUS_STEPS.findIndex(step => step.id === order.status);
    return index === -1 ? 0 : index;
  };

  const handleCallDriver = () => {
    if (order?.driver?.phone) {
      Linking.openURL(`tel:${order.driver.phone}`);
    }
  };

  if (loading) {
    return (
      <View style={[styles.mainContainer, styles.centered]}>
        <ActivityIndicator size="large" color="#0C1559" />
      </View>
    );
  }

  const currentStepIndex = getCurrentStepIndex();

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
        
        {/* --- Header --- */}
        <View style={styles.headerWrapper}>
          <LinearGradient
            colors={['#0C1559', '#1e3a8a']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.headerGradient}
          >
            <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
              <View style={styles.headerContent}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                  <Ionicons name="arrow-back" size={24} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Track Order</Text>
                <View style={{ width: 40 }} />
              </View>
            </SafeAreaView>
          </LinearGradient>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          
          {/* Order Summary Card */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
                <View>
                    <Text style={styles.summaryLabel}>Order ID</Text>
                    <Text style={styles.summaryValue}>{order.id}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.summaryLabel}>Total Amount</Text>
                    <Text style={styles.summaryAmount}>₵{order.total.toFixed(2)}</Text>
                </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
                <View style={styles.etaBox}>
                    <Feather name="clock" size={18} color="#84cc16" />
                    <View style={{ marginLeft: 10 }}>
                        <Text style={styles.summaryLabel}>Estimated Delivery</Text>
                        <Text style={styles.summaryValue}>{order.estimatedDelivery}</Text>
                    </View>
                </View>
            </View>
          </View>

          {/* Timeline Section */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Order Status</Text>
            
            <View style={styles.timelineContainer}>
                {STATUS_STEPS.map((step, index) => {
                    const isCompleted = index <= currentStepIndex;
                    const isActive = index === currentStepIndex;
                    const isLast = index === STATUS_STEPS.length - 1;

                    return (
                        <View key={step.id} style={styles.timelineStep}>
                            {/* Left Side: Icon & Line */}
                            <View style={styles.timelineIndicator}>
                                <View style={[
                                    styles.timelineDot,
                                    isCompleted ? styles.timelineDotCompleted : styles.timelineDotPending,
                                    isActive && styles.timelineDotActive
                                ]}>
                                    {isCompleted ? (
                                        <Ionicons name="checkmark" size={14} color="#FFF" />
                                    ) : (
                                        <View style={styles.timelineDotInner} />
                                    )}
                                </View>
                                {!isLast && (
                                    <View style={[
                                        styles.timelineLine,
                                        isCompleted ? styles.timelineLineCompleted : styles.timelineLinePending
                                    ]} />
                                )}
                            </View>

                            {/* Right Side: Text */}
                            <View style={styles.timelineContent}>
                                <Text style={[
                                    styles.stepTitle,
                                    isCompleted ? styles.stepTitleCompleted : styles.stepTitlePending
                                ]}>
                                    {step.title}
                                </Text>
                                <Text style={styles.stepDesc}>{step.desc}</Text>
                            </View>
                        </View>
                    );
                })}
            </View>
          </View>

          {/* Items Ordered Section */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Items Ordered</Text>
            {order.items.map((item: any, index: number) => {
              const isLastItem = index === order.items.length - 1;
              return (
                <View key={item.id}>
                  <View style={styles.itemRow}>
                    <Image source={{ uri: item.image }} style={styles.itemImage} />
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                      <Text style={styles.itemQty}>Qty: {item.qty}</Text>
                    </View>
                    <Text style={styles.itemPrice}>₵{(item.price * item.qty).toFixed(2)}</Text>
                  </View>
                  {!isLastItem && <View style={styles.itemDivider} />}
                </View>
              );
            })}
          </View>

          {/* Driver Info (Only show if out for delivery) */}
          {order.status === 'out_for_delivery' && order.driver && (
            <View style={styles.driverCard}>
                <Text style={styles.sectionTitle}>Your Driver</Text>
                <View style={styles.driverRow}>
                    <Image source={{ uri: order.driver.avatar }} style={styles.driverAvatar} />
                    <View style={styles.driverInfo}>
                        <Text style={styles.driverName}>{order.driver.name}</Text>
                        <Text style={styles.driverVehicle}>{order.driver.vehicle} • {order.driver.plate}</Text>
                    </View>
                    <View style={styles.driverActions}>
                        <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/chat')}>
                            <Ionicons name="chatbubble-ellipses" size={20} color="#0C1559" />
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.iconButton, { backgroundColor: '#0C1559' }]} onPress={handleCallDriver}>
                            <Ionicons name="call" size={20} color="#FFF" />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
          )}

          {/* Delivery Details */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Delivery Details</Text>
            <View style={styles.detailRow}>
                <View style={styles.detailIconBox}>
                    <Ionicons name="location" size={20} color="#0C1559" />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.detailLabel}>Delivery Address</Text>
                    <Text style={styles.detailValue}>{order.address}</Text>
                </View>
            </View>
          </View>

          {/* Map Placeholder */}
          {order.status === 'out_for_delivery' && (
            <View style={styles.mapPlaceholder}>
                <MaterialCommunityIcons name="map-marker-path" size={40} color="#94A3B8" />
                <Text style={styles.mapText}>Live tracking map will appear here</Text>
            </View>
          )}

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#F8FAFC' },
  safeArea: { flex: 1 },
  centered: { justifyContent: 'center', alignItems: 'center' },

  // Background Watermark
  bottomLogos: { position: 'absolute', bottom: 20, left: -20 },
  fadedLogo: { width: 150, height: 150, resizeMode: 'contain', opacity: 0.08 },

  // Header
  headerWrapper: { marginBottom: 10 },
  headerGradient: { paddingBottom: 25, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerSafeArea: { paddingHorizontal: 20 },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, marginTop: 10 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontFamily: 'Montserrat-Bold', color: '#FFF' },

  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },

  // Summary Card
  summaryCard: {
      backgroundColor: '#0C1559',
      borderRadius: 20,
      padding: 20,
      marginBottom: 20,
      shadowColor: "#0C1559",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.2,
      shadowRadius: 10,
      elevation: 6,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { color: '#94A3B8', fontSize: 12, fontFamily: 'Montserrat-Medium', marginBottom: 4 },
  summaryValue: { color: '#FFF', fontSize: 15, fontFamily: 'Montserrat-Bold' },
  summaryAmount: { color: '#84cc16', fontSize: 18, fontFamily: 'Montserrat-Bold' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 15 },
  etaBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(132, 204, 22, 0.1)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },

  // Section Cards
  sectionCard: {
      backgroundColor: '#FFF',
      borderRadius: 20,
      padding: 20,
      marginBottom: 20,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 6,
      elevation: 2,
  },
  sectionTitle: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginBottom: 20 },

  // Timeline
  timelineContainer: { marginLeft: 10 },
  timelineStep: { flexDirection: 'row', minHeight: 70 },
  timelineIndicator: { alignItems: 'center', width: 30, marginRight: 15 },
  timelineDot: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', zIndex: 2 },
  timelineDotCompleted: { backgroundColor: '#84cc16' }, // Lime Green
  timelineDotActive: { backgroundColor: '#0C1559', borderWidth: 4, borderColor: '#E0E7FF' },
  timelineDotPending: { backgroundColor: '#F1F5F9', borderWidth: 2, borderColor: '#CBD5E1' },
  timelineDotInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#CBD5E1' },
  timelineLine: { width: 2, flex: 1, position: 'absolute', top: 24, bottom: -10, zIndex: 1 },
  timelineLineCompleted: { backgroundColor: '#84cc16' },
  timelineLinePending: { backgroundColor: '#F1F5F9' },
  timelineContent: { flex: 1, paddingBottom: 30, paddingTop: 2 },
  stepTitle: { fontSize: 15, fontFamily: 'Montserrat-Bold', marginBottom: 4 },
  stepTitleCompleted: { color: '#0F172A' },
  stepTitlePending: { color: '#94A3B8' },
  stepDesc: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: '#64748B', lineHeight: 18 },

  // Items Ordered
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
  },
  itemImage: {
    width: 55,
    height: 55,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    marginRight: 15,
  },
  itemInfo: {
    flex: 1,
    justifyContent: 'center',
    paddingRight: 10,
  },
  itemName: {
    fontSize: 14,
    fontFamily: 'Montserrat-SemiBold',
    color: '#0F172A',
    marginBottom: 4,
  },
  itemQty: {
    fontSize: 12,
    fontFamily: 'Montserrat-Medium',
    color: '#64748B',
  },
  itemPrice: {
    fontSize: 15,
    fontFamily: 'Montserrat-Bold',
    color: '#0C1559',
  },
  itemDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },

  // Driver Card
  driverCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  driverRow: { flexDirection: 'row', alignItems: 'center' },
  driverAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#F1F5F9' },
  driverInfo: { flex: 1, marginLeft: 15 },
  driverName: { fontSize: 15, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginBottom: 4 },
  driverVehicle: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: '#64748B' },
  driverActions: { flexDirection: 'row', gap: 10 },
  iconButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },

  // Delivery Details
  detailRow: { flexDirection: 'row', alignItems: 'center' },
  detailIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F0F4FC', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  detailLabel: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: '#64748B', marginBottom: 4 },
  detailValue: { fontSize: 14, fontFamily: 'Montserrat-SemiBold', color: '#0F172A', lineHeight: 20 },

  // Map Placeholder
  mapPlaceholder: {
      height: 150,
      backgroundColor: '#F1F5F9',
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: '#E2E8F0',
      borderStyle: 'dashed',
      marginBottom: 20,
  },
  mapText: {
      marginTop: 10,
      fontSize: 13,
      fontFamily: 'Montserrat-Medium',
      color: '#94A3B8'
  }
});