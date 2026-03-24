import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Image,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { Ionicons, FontAwesome5, Feather, MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useDeliveryDetails, useUpdateDeliveryStatus } from '@/hooks/useDelivery';
import { CustomInAppToast } from '@/services/api';

const { width, height } = Dimensions.get('window');

const ORDER_STEPS = ['Go to Restaurant', 'Confirm Pickup', 'Go to Customer', 'Confirm Delivery'];

export default function ActiveOrderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const deliveryId = params.deliveryId as string;
  const [step, setStep] = useState(0);

  // --- TanStack Query Hooks ---
  const { data, isLoading, refetch } = useDeliveryDetails(deliveryId);
  const delivery = data?.delivery;
  const updateStatusMutation = useUpdateDeliveryStatus();

  // Sync step with delivery status
  useEffect(() => {
    if (delivery) {
      const status = delivery.status;
      if (status === 'picked_up' || status === 'in_transit') {
        setStep(2);
      } else if (status === 'delivered') {
        router.replace('/driver/dashboard');
      } else {
        setStep(0);
      }
    }
  }, [delivery?.status]);

  const handleProgress = async () => {
    try {
      if (step === 0) {
        setStep(1);
      } else if (step === 1) {
        await updateStatusMutation.mutateAsync({ deliveryId, status: 'picked_up' });
        setStep(2);
      } else if (step === 2) {
        await updateStatusMutation.mutateAsync({ deliveryId, status: 'in_transit' });
        setStep(3);
      } else if (step === 3) {
        await updateStatusMutation.mutateAsync({ deliveryId, status: 'delivered' });
        CustomInAppToast.show({ 
          type: 'success', 
          title: 'Order Completed', 
          message: 'Great job! Your earnings have been updated.' 
        });
        router.replace('/driver/dashboard');
        return;
      }
    } catch (e: any) {
      CustomInAppToast.show({ 
        type: 'error', 
        title: 'Error', 
        message: e.message || 'Failed to update status' 
      });
    }
  };

  const getButtonText = () => {
    switch (step) {
      case 0: return "Arrived at Restaurant";
      case 1: return "Confirm Pickup";
      case 2: return "Arrived at Customer";
      case 3: return "Complete Delivery";
      default: return "Complete";
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0C1559" />
      </View>
    );
  }

  if (!delivery) {
    return (
      <View style={styles.centerContainer}>
        <Text>Order not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
          <Text style={{ color: '#0C1559', fontWeight: 'bold' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const buyerProfile = delivery.order?.buyer?.user_profiles;
  const storeDetails = delivery.order?.store;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* --- MAP PLACEHOLDER --- */}
      <View style={styles.mapContainer}>
        <Image
          source={{ uri: 'https://i.imgur.com/83g2v6z.png' }}
          style={styles.mapImage}
        />
        <SafeAreaView style={styles.safeMapOverlay}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#0F172A" />
          </TouchableOpacity>
        </SafeAreaView>
      </View>

      {/* --- BOTTOM SHEET --- */}
      <View style={styles.bottomSheet}>
        <View style={styles.handleBar} />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

          <View style={styles.statusRow}>
            <Text style={styles.statusTitle}>{ORDER_STEPS[step]}</Text>
            <Text style={styles.timeRemaining}>~ {delivery?.estimated_time || (step === 0 ? '5' : '15')} mins</Text>
          </View>

          {/* Address Info */}
          <View style={styles.locationCard}>
            <View style={styles.iconCircle}>
              <MaterialIcons name={step <= 1 ? "storefront" : "location-pin"} size={24} color="#0C1559" />
            </View>
            <View style={{ flex: 1, marginLeft: 15 }}>
              <Text style={styles.locationLabel}>{step <= 1 ? "Pick Up At" : "Deliver To"}</Text>
              <Text style={styles.locationName}>
                {step <= 1 ? (storeDetails?.store_name || "Store") : (buyerProfile?.full_name || "Customer")}
              </Text>
              <Text style={styles.locationAddress} numberOfLines={2}>
                {step <= 1 ? (delivery.pickup_address) : (delivery.delivery_address)}
              </Text>
            </View>
            <TouchableOpacity style={styles.navBtn}>
              <FontAwesome5 name="location-arrow" size={18} color="#FFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.contactRow}>
            <View style={styles.customerInfo}>
              <Image
                source={{ uri: (step <= 1 ? storeDetails?.logo_url : buyerProfile?.avatar_url) || 'https://api.dicebear.com/9.x/avataaars/png?seed=Sarah' }}
                style={styles.customerImg}
              />
              <View>
                <Text style={styles.customerName}>
                  {step <= 1 ? (storeDetails?.store_name || "Store Contact") : (buyerProfile?.full_name || "Customer")}
                </Text>
                <Text style={styles.customerRole}>{step <= 1 ? "Seller" : "Customer"}</Text>
              </View>
            </View>
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.circleBtn}
                onPress={() => {
                  const targetId = step <= 1 ? delivery.order?.store?.owner_id : delivery.order?.buyer_id;
                  if (targetId) {
                    router.push(`/chat/${targetId}` as any);
                  }
                }}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={22} color="#0C1559" />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.circleBtn, { backgroundColor: '#E0E7FF' }]}>
                <Ionicons name="call-outline" size={22} color="#0C1559" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Order Items Summary */}
          <View style={styles.orderSummary}>
            <Text style={styles.summaryTitle}>Order Details #{delivery.order?.order_number}</Text>
            {delivery.order?.order_items?.map((item: any, index: number) => (
              <View key={index} style={styles.orderItem}>
                <Text style={styles.qty}>{item.quantity}x</Text>
                <Text style={styles.itemName}>{item.product_title}</Text>
              </View>
            ))}
            {(!delivery.order?.order_items || delivery.order.order_items.length === 0) && (
              <Text style={styles.noItems}>No item details available</Text>
            )}
          </View>

        </ScrollView>

        {/* --- MAIN ACTION BUTTON --- */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.mainBtn, step === 3 && styles.completeBtn, updateStatusMutation.isPending && { opacity: 0.8 }]}
            onPress={handleProgress}
            activeOpacity={0.8}
            disabled={updateStatusMutation.isPending}
          >
            {updateStatusMutation.isPending ? (
              <ActivityIndicator color={step === 3 ? "#FFF" : "#0C1559"} />
            ) : (
              <>
                <Text style={[styles.mainBtnText, step === 3 && { color: '#FFF' }]}>
                  {getButtonText()}
                </Text>
                <Feather name="arrow-right" size={20} color={step === 3 ? "#FFF" : "#0C1559"} />
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Map Section
  mapContainer: { height: height * 0.45, width: '100%', backgroundColor: '#E2E8F0' },
  mapImage: { width: '100%', height: '100%', resizeMode: 'cover', opacity: 0.8 },
  safeMapOverlay: { position: 'absolute', top: 0, left: 20 },
  backBtn: { backgroundColor: '#FFF', padding: 10, borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5, elevation: 3 },

  // Bottom Sheet
  bottomSheet: {
    flex: 1, backgroundColor: '#FFF', borderTopLeftRadius: 30, borderTopRightRadius: 30,
    marginTop: -30, paddingHorizontal: 24, paddingTop: 10
  },
  handleBar: { width: 40, height: 4, backgroundColor: '#CBD5E1', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },

  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  statusTitle: { fontSize: 20, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
  timeRemaining: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: '#16A34A', backgroundColor: '#DCFCE7', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },

  // Location Card
  locationCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC',
    padding: 16, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#F1F5F9'
  },
  iconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E0E7FF', justifyContent: 'center', alignItems: 'center' },
  locationLabel: { fontSize: 11, color: '#64748B', fontFamily: 'Montserrat-Bold', marginBottom: 2, textTransform: 'uppercase' },
  locationName: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
  locationAddress: { fontSize: 13, color: '#475569', fontFamily: 'Montserrat-Regular' },
  navBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#0C1559', justifyContent: 'center', alignItems: 'center' },

  // Contact Row
  contactRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  customerInfo: { flexDirection: 'row', alignItems: 'center' },
  customerImg: { width: 45, height: 45, borderRadius: 22.5, marginRight: 12, backgroundColor: '#F1F5F9' },
  customerName: { fontSize: 15, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
  customerRole: { fontSize: 12, color: '#64748B', fontFamily: 'Montserrat-Medium' },
  actionButtons: { flexDirection: 'row', gap: 12 },
  circleBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },

  divider: { height: 1, backgroundColor: '#F1F5F9', marginBottom: 20 },

  // Order Summary
  orderSummary: { marginBottom: 20 },
  summaryTitle: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#64748B', marginBottom: 15, textTransform: 'uppercase' },
  orderItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  qty: { fontSize: 12, fontFamily: 'Montserrat-Bold', color: '#A3E635', marginRight: 12, backgroundColor: '#0C1559', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  itemName: { fontSize: 14, fontFamily: 'Montserrat-Medium', color: '#334155' },
  noItems: { fontSize: 14, color: '#94A3B8', fontFamily: 'Montserrat-Medium' },

  // Footer
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFF', padding: 20, borderTopWidth: 1, borderTopColor: '#F1F5F9'
  },
  mainBtn: {
    backgroundColor: '#A3E635', flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    paddingVertical: 18, borderRadius: 16, shadowColor: "#A3E635", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, elevation: 5, gap: 10
  },
  completeBtn: { backgroundColor: '#0C1559' },
  mainBtnText: { color: '#0C1559', fontSize: 16, fontFamily: 'Montserrat-Bold' }
});