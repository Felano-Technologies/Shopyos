import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Image,
  ScrollView,
  Alert
} from 'react-native';
import { Ionicons, FontAwesome5, Feather, MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getDeliveryDetails, updateDeliveryStatus } from '@/services/api';

const { width, height } = Dimensions.get('window');

const ORDER_STEPS = ['Go to Restaurant', 'Confirm Pickup', 'Go to Customer', 'Confirm Delivery'];

export default function ActiveOrderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const deliveryId = params.deliveryId as string;
  const [step, setStep] = useState(0);
  const [delivery, setDelivery] = useState<any>(null);

  useEffect(() => {
    if (deliveryId) {
      getDeliveryDetails(deliveryId).then(d => {
        if (d.success) setDelivery(d.delivery);
      }).catch(console.error);
    }
  }, [deliveryId]);

  const handleProgress = async () => {
    try {
      if (step === 1) {
        // Confirm Pickup
        await updateDeliveryStatus(deliveryId, 'picked_up');
      } else if (step === 3) {
        // Complete Delivery
        await updateDeliveryStatus(deliveryId, 'delivered');
        Alert.alert("Order Completed", "Great job! You received ₵25.00", [
          { text: "OK", onPress: () => router.back() }
        ]);
        return;
      }
      setStep(step + 1);
    } catch (e) {
      Alert.alert("Error", "Failed to update status");
      console.error(e);
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

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* --- MAP PLACEHOLDER (Top Half) --- */}
      <View style={styles.mapContainer}>
        {/* Placeholder Map Image - Use an actual MapView in production */}
        <Image
          source={{ uri: 'https://i.imgur.com/83g2v6z.png' }} // Generic Map Image
          style={styles.mapImage}
        />

        {/* Floating Back Button */}
        <SafeAreaView style={styles.safeMapOverlay}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#0F172A" />
          </TouchableOpacity>
        </SafeAreaView>
      </View>

      {/* --- BOTTOM SHEET (Order Details) --- */}
      <View style={styles.bottomSheet}>
        <View style={styles.handleBar} />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>

          {/* Status Header */}
          <View style={styles.statusRow}>
            <Text style={styles.statusTitle}>{ORDER_STEPS[step]}</Text>
            <Text style={styles.timeRemaining}>~ 8 mins</Text>
          </View>

          {/* Address Info */}
          <View style={styles.locationCard}>
            <View style={styles.iconCircle}>
              <MaterialIcons name={step <= 1 ? "storefront" : "location-pin"} size={24} color="#0C1559" />
            </View>
            <View style={{ flex: 1, marginLeft: 15 }}>
              <Text style={styles.locationLabel}>{step <= 1 ? "Pick Up At" : "Deliver To"}</Text>
              <Text style={styles.locationName}>
                {step <= 1
                  ? (delivery?.order?.store?.name || "KFC - Asokwa Branch")
                  : (delivery?.order?.buyer?.name || "KNUST Campus, Brunei")}
              </Text>
              <Text style={styles.locationAddress}>
                {step <= 1
                  ? (delivery?.pickupAddress || "Kumasi - Accra Rd, near City Mall")
                  : (delivery?.deliveryAddress || "Room 4B, Block C")}
              </Text>
            </View>
            <TouchableOpacity style={styles.navBtn}>
              <FontAwesome5 name="location-arrow" size={18} color="#FFF" />
            </TouchableOpacity>
          </View>

          {/* Customer/Restaurant Contact */}
          <View style={styles.contactRow}>
            <View style={styles.customerInfo}>
              <Image source={{ uri: 'https://randomuser.me/api/portraits/women/44.jpg' }} style={styles.customerImg} />
              <View>
                <Text style={styles.customerName}>{delivery?.order?.buyer?.name || "Sarah Mensah"}</Text>
                <Text style={styles.customerRole}>Customer</Text>
              </View>
            </View>
            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.circleBtn}>
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
            <Text style={styles.summaryTitle}>Order Details</Text>
            <View style={styles.orderItem}>
              <Text style={styles.qty}>2x</Text>
              <Text style={styles.itemName}>Streetwise 2 with Chips</Text>
            </View>
            <View style={styles.orderItem}>
              <Text style={styles.qty}>1x</Text>
              <Text style={styles.itemName}>Coke (500ml)</Text>
            </View>
          </View>

          <View style={{ height: 80 }} />
        </ScrollView>

        {/* --- MAIN ACTION BUTTON --- */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.mainBtn, step === 3 && styles.completeBtn]}
            onPress={handleProgress}
            activeOpacity={0.8}
          >
            <Text style={[styles.mainBtnText, step === 3 && { color: '#FFF' }]}>
              {getButtonText()}
            </Text>
            <Feather name="arrow-right" size={20} color={step === 3 ? "#FFF" : "#0C1559"} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },

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
  timeRemaining: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#16A34A', backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },

  // Location Card
  locationCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC',
    padding: 16, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#F1F5F9'
  },
  iconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E0E7FF', justifyContent: 'center', alignItems: 'center' },
  locationLabel: { fontSize: 12, color: '#64748B', fontFamily: 'Montserrat-Medium', marginBottom: 2 },
  locationName: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
  locationAddress: { fontSize: 13, color: '#475569', fontFamily: 'Montserrat-Regular' },
  navBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#0C1559', justifyContent: 'center', alignItems: 'center' },

  // Contact Row
  contactRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  customerInfo: { flexDirection: 'row', alignItems: 'center' },
  customerImg: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  customerName: { fontSize: 15, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
  customerRole: { fontSize: 12, color: '#64748B', fontFamily: 'Montserrat-Medium' },
  actionButtons: { flexDirection: 'row', gap: 12 },
  circleBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },

  divider: { height: 1, backgroundColor: '#F1F5F9', marginBottom: 20 },

  // Order Summary
  orderSummary: { marginBottom: 20 },
  summaryTitle: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginBottom: 10 },
  orderItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  qty: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#A3E635', marginRight: 10, backgroundColor: '#0C1559', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  itemName: { fontSize: 14, fontFamily: 'Montserrat-Medium', color: '#334155' },

  // Footer
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFF', padding: 20, borderTopWidth: 1, borderTopColor: '#F1F5F9'
  },
  mainBtn: {
    backgroundColor: '#A3E635', flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    paddingVertical: 16, borderRadius: 16, shadowColor: "#A3E635", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, elevation: 5, gap: 10
  },
  completeBtn: { backgroundColor: '#0C1559' },
  mainBtnText: { color: '#0C1559', fontSize: 16, fontFamily: 'Montserrat-Bold' }
});