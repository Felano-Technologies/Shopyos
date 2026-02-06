import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Image,
  FlatList,
  Dimensions,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { Ionicons, FontAwesome5, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

import { getAvailableDeliveries, assignDriver } from '@/services/api';

export default function Dashboard() {
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);

  // Toggle Online Status
  const toggleOnline = () => {
    setIsOnline(!isOnline);
    if (!isOnline) { // Turning ON
      fetchRequests();
    } else {
      setRequests([]);
    }
  };

  const fetchRequests = async () => {
    try {
      const res = await getAvailableDeliveries();
      if (res.success) {
        // Map backend delivery objects to UI format
        const mapped = res.deliveries.map((d: any) => ({
          id: d._id,
          restaurant: d.pickupAddress, // Or d.order?.store?.name if populated
          destination: d.deliveryAddress,
          price: 25.0, // Standard delivery fee or d.deliveryFee
          distance: '3.5 km', // Placeholder or calculation
          time: '15 mins',
          items: 1 // Placeholder
        }));
        setRequests(mapped);
      }
    } catch (e) {
      console.log("Error fetching deliveries", e);
    }
  };

  useEffect(() => {
    let interval: any;
    if (isOnline) {
      fetchRequests();
      interval = setInterval(fetchRequests, 10000); // Poll every 10s
    }
    return () => clearInterval(interval);
  }, [isOnline]);

  const handleAccept = async (id: string) => {
    try {
      await assignDriver(id);
      router.push({ pathname: '/driver/activeOrder', params: { deliveryId: id } } as any);
    } catch (e) {
      alert("Failed to accept order");
    }
  };

  const RequestCard = ({ item }: { item: any }) => (
    <View style={styles.requestCard}>
      <View style={styles.cardHeader}>
        <View style={styles.priceTag}>
          <Text style={styles.priceText}>₵{item.price.toFixed(2)}</Text>
        </View>
        <Text style={styles.distanceText}>{item.distance} • {item.time}</Text>
      </View>

      <View style={styles.routeContainer}>
        {/* Timeline dots */}
        <View style={styles.timeline}>
          <View style={styles.dot} />
          <View style={styles.line} />
          <View style={[styles.dot, { backgroundColor: '#A3E635' }]} />
        </View>

        <View style={styles.addresses}>
          <View style={styles.addressBlock}>
            <Text style={styles.addressLabel}>Pick Up</Text>
            <Text style={styles.addressTitle}>{item.restaurant}</Text>
          </View>
          <View style={[styles.addressBlock, { marginTop: 15 }]}>
            <Text style={styles.addressLabel}>Drop Off</Text>
            <Text style={styles.addressTitle}>{item.destination}</Text>
          </View>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.itemBadge}>
          <Feather name="package" size={14} color="#64748B" />
          <Text style={styles.itemText}>{item.items} Items</Text>
        </View>
        <TouchableOpacity
          style={styles.acceptBtn}
          onPress={() => handleAccept(item.id)}
        >
          <Text style={styles.acceptText}>Accept Order</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor="#0C1559" />

      {/* --- HEADER --- */}
      <View style={styles.header}>
        <SafeAreaView edges={['top', 'left', 'right']}>
          <View style={styles.headerTop}>
            <View style={styles.profileRow}>
              <Image
                source={{ uri: 'https://api.dicebear.com/9.x/adventurer/png?seed=Driver' }}
                style={styles.avatar}
              />
              <View>
                <Text style={styles.greeting}>Hello, Williams</Text>
                <Text style={styles.statusText}>
                  {isOnline ? 'You are Online' : 'You are Offline'}
                </Text>
              </View>
            </View>

            {/* Online Toggle */}
            <View style={styles.toggleContainer}>
              <Text style={[styles.toggleLabel, { color: isOnline ? '#A3E635' : '#94A3B8' }]}>
                {isOnline ? 'ON' : 'OFF'}
              </Text>
              <Switch
                trackColor={{ false: '#334155', true: 'rgba(163, 230, 53, 0.3)' }}
                thumbColor={isOnline ? '#A3E635' : '#f4f3f4'}
                onValueChange={toggleOnline}
                value={isOnline}
              />
            </View>
          </View>

          {/* Daily Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Today's Earnings</Text>
              <Text style={styles.statValue}>₵145.50</Text>
            </View>
            <View style={styles.verticalDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Rides</Text>
              <Text style={styles.statValue}>8</Text>
            </View>
            <View style={styles.verticalDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Time Online</Text>
              <Text style={styles.statValue}>4h 20m</Text>
            </View>
          </View>
        </SafeAreaView>
      </View>

      {/* --- CONTENT --- */}
      <View style={styles.contentContainer}>
        {!isOnline ? (
          <View style={styles.offlineState}>
            <View style={styles.offlineIconCircle}>
              <MaterialCommunityIcons name="motorbike-off" size={60} color="#94A3B8" />
            </View>
            <Text style={styles.offlineTitle}>You are currently offline</Text>
            <Text style={styles.offlineSub}>Go online to start receiving delivery requests nearby.</Text>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Available Requests</Text>
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>Live</Text>
              </View>
            </View>

            {requests.length === 0 ? (
              <View style={styles.searchingState}>
                <ActivityIndicator size="large" color="#0C1559" />
                <Text style={styles.searchingText}>Searching for orders...</Text>
              </View>
            ) : (
              <FlatList
                data={requests}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => <RequestCard item={item} />}
                contentContainerStyle={{ paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },

  // Header
  header: {
    backgroundColor: '#0C1559',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    paddingBottom: 25,
    paddingHorizontal: 20,
    zIndex: 10,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25, marginTop: 10 },
  profileRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: '#A3E635', marginRight: 12, backgroundColor: '#FFF' },
  greeting: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#FFF' },
  statusText: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: '#CBD5E1' },
  toggleContainer: { alignItems: 'center' },
  toggleLabel: { fontSize: 10, fontFamily: 'Montserrat-Bold', marginBottom: 2 },

  // Stats
  statsContainer: {
    flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16, padding: 15, justifyContent: 'space-between', alignItems: 'center'
  },
  statBox: { alignItems: 'center', flex: 1 },
  statLabel: { color: '#94A3B8', fontSize: 11, fontFamily: 'Montserrat-Medium', marginBottom: 4 },
  statValue: { color: '#FFF', fontSize: 18, fontFamily: 'Montserrat-Bold' },
  verticalDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.2)' },

  // Content
  contentContainer: { flex: 1, padding: 20 },

  // Offline State
  offlineState: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: -50 },
  offlineIconCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  offlineTitle: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginBottom: 8 },
  offlineSub: { fontSize: 14, fontFamily: 'Montserrat-Regular', color: '#64748B', textAlign: 'center', width: '80%' },

  // Online State
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#DC2626', marginRight: 6 },
  liveText: { color: '#DC2626', fontSize: 10, fontFamily: 'Montserrat-Bold' },

  searchingState: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50 },
  searchingText: { marginTop: 15, fontFamily: 'Montserrat-Medium', color: '#64748B' },

  // Request Card
  requestCard: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 },
  priceTag: { backgroundColor: '#ECFCCB', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  priceText: { color: '#0C1559', fontFamily: 'Montserrat-Bold', fontSize: 16 },
  distanceText: { color: '#64748B', fontFamily: 'Montserrat-SemiBold', fontSize: 13, marginTop: 5 },

  routeContainer: { flexDirection: 'row', marginBottom: 20 },
  timeline: { alignItems: 'center', marginRight: 12, marginTop: 5 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#0C1559' },
  line: { width: 2, height: 35, backgroundColor: '#E2E8F0', marginVertical: 2 },

  addresses: { flex: 1 },
  addressBlock: { height: 42, justifyContent: 'center' },
  addressLabel: { fontSize: 10, fontFamily: 'Montserrat-Bold', color: '#94A3B8', textTransform: 'uppercase' },
  addressTitle: { fontSize: 14, fontFamily: 'Montserrat-SemiBold', color: '#0F172A' },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 15 },
  itemBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  itemText: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: '#475569', marginLeft: 6 },
  acceptBtn: { backgroundColor: '#0C1559', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  acceptText: { color: '#A3E635', fontFamily: 'Montserrat-Bold', fontSize: 13 }
});